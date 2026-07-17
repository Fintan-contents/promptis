import fs from "fs";
import path from "path";
import * as vscode from "vscode";
import { postUsage } from "./api";
import { FileChatResponseStreamWrapper } from "./chatutil";
import { Config } from "./config";
import * as gitDiff from "./gitDiff";
import { OutputStrategyFactory } from "./output";
import { extractTargetFiles, filterPromptsByTarget, findPromptFiles, parsePromptFile, timestampAsString, type PromptMetadata } from "./util";

type CommandPromptPathMap = Map<string, () => string | undefined>;
const commandPromptDirectoryMap: CommandPromptPathMap = new Map([
  ["codereviewCodeStandards", Config.getCodeReviewStandardPath],
  ["codereviewFunctional", Config.getCodeReviewFunctionalPath],
  ["codereviewNonFunctional", Config.getCodeReviewNonFunctionalPath],
  ["codereviewDiff", Config.getCodeReviewDiffPath],
  ["reverseEngineering", Config.getReverseEngineeringPromptPath],
  ["drawDiagrams", Config.getDrawDiagramsPromptPath],
]);

/**
 * ユーザからのChat Requestを処理するハンドラ
 *
 * @param request - ユーザからの Chat Request
 * @param context - Chat Historyを持つコンテキスト
 * @param stream - ユーザに回答するための Chat Response Stream
 * @param token - やりとりをキャンセルする時に使用するトークン
 * @returns
 *
 * この関数は以下の手順で処理を行い、ユーザに回答を返す
 * 1. Chatに使用する AI Model を選択する
 * 2. ユーザから、コマンドが指定されているか確認する
 * 3. コマンドに対応するプロンプトの格納ディレクトリを取得する。
 * 4. 格納ディレクトリからプロンプトのファイルを取得する
 * 5. リクエストからターゲットファイルを抽出し、存在する場合はそれらを処理する
 * 6. ターゲットファイルが存在しない場合は、エディタで選択された内容を処理する
 * 7. デバッグ用にリクエストの詳細をコンソールに出力する。
 */
export const chatHandler: vscode.ChatRequestHandler = async (request, context, stream, token) => {
  // ユーザから、コマンドが指定されているか確認する
  const command = request.command;
  if (!command) {
    return createErrorResponse("No command specified", stream);
  }
  console.log(`Command: ${command}`);

  await postUsage(command);

  // コマンドに対応するプロンプトの格納ディレクトリを取得する。
  const promptDir = getPromptDirectory(command);
  if (!promptDir) {
    return createErrorResponse(`No prompt path found for command: ${command}`, stream);
  }
  console.info(`Prompt directory: ${promptDir}`);

  // 格納ディレクトリからプロンプトのファイルを取得する
  const promptFiles = findPromptFiles(promptDir, Config.getPromptExcludeFilePatterns());
  if (promptFiles.length === 0) {
    return createErrorResponse(`No prompt files found in ${promptDir}`, stream);
  }

  // プロンプトファイルのメタデータを解析
  const promptMetadata = promptFiles.map(parsePromptFile);

  const outputDirPath = Config.getChatOutputDirPath();
  const outputMode = Config.getOutputMode();

  // file-onlyモードでoutputPathが未設定の場合に警告
  warnIfFileOnlyWithoutOutputPath(outputMode, outputDirPath);

  // file-onlyモードの場合のみファイル出力を有効化
  if (outputMode === "file-only" && outputDirPath && outputDirPath.length > 0) {
    // ResponseStream をラップして、ファイルに保存するようにする
    stream = new FileChatResponseStreamWrapper(stream, makeChatFilePath(outputDirPath));
  }

  if (command === "codereviewDiff") {
    return processGitDiffReview(request, promptMetadata, request.model, token, stream);
  }

  // ユーザの Chat Request 中で指定されたレビュー対象ファイルを取得する
  const targetFiles = await extractTargetFiles(request, stream);
  if (targetFiles.length > 0) {
    // ファイル指定があれば、当該ファイルをレビューする
    await processSourceFiles(targetFiles, promptMetadata, request.model, token, stream);
  } else {
    // ファイル指定がなければ、エディタで選択されている内容をレビューする
    await processSelectedContent(promptMetadata, request.model, token, stream);
  }
};

export function getPromptDirectory(command: string): string | undefined {
  const dir = commandPromptDirectoryMap.get(command)?.();
  return dir;
}

export async function processGitDiffReview(
  request: vscode.ChatRequest,
  promptMetadata: PromptMetadata[],
  model: vscode.LanguageModelChat,
  token: vscode.CancellationToken,
  stream: vscode.ChatResponseStream,
): Promise<void | vscode.ChatResult> {
  const range = gitDiff.extractDiffRange(request.prompt, Config.getGitDiffDefaultRange());
  let repo: gitDiff.GitRepository | undefined;
  let diffFiles: gitDiff.GitDiffFile[];

  try {
    repo = await gitDiff.getGitRepository();
    if (!repo) {
      return createErrorResponse("No Git repository found in the current workspace.", stream);
    }

    diffFiles = await gitDiff.getDiffFiles(repo, range);
  } catch (error) {
    return createErrorResponse(`Failed to get Git diff for range ${range}: ${errorToMessage(error)}`, stream);
  }

  if (diffFiles.length === 0) {
    stream.markdown(`No Git diff found for \`${range}\`.\n`);
    return;
  }

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? repo.rootUri.fsPath;
  const processableFiles: Array<{ diffFile: gitDiff.GitDiffFile; applicablePrompts: PromptMetadata[] }> = [];
  const skippedFiles: string[] = [];

  for (const diffFile of diffFiles) {
    if (diffFile.changeType === "deleted") {
      skippedFiles.push(`${diffFile.relativePath} (deleted file has no new side)`);
      continue;
    }

    if (!gitDiff.hasReviewableHunks(diffFile)) {
      skippedFiles.push(`${diffFile.relativePath} (no reviewable hunks)`);
      continue;
    }

    const applicablePrompts = filterPromptsByTarget(promptMetadata, diffFile.filePath, workspaceRoot);
    if (applicablePrompts.length === 0) {
      skippedFiles.push(`${diffFile.relativePath} (no matching prompts)`);
      continue;
    }

    processableFiles.push({ diffFile, applicablePrompts });
  }

  if (processableFiles.length === 0) {
    stream.markdown(`No reviewable Git diff files found for \`${range}\`.\n`);
    outputSkippedDiffFiles(skippedFiles, stream);
    return;
  }

  const strategy = OutputStrategyFactory.create(Config.getOutputMode());
  let processedCount = 0;

  stream.markdown(`Reviewing ${processableFiles.length} Git diff file(s) for \`${range}\`.\n\n`);
  for (const { diffFile, applicablePrompts } of processableFiles) {
    strategy.outputProgress(processedCount, processableFiles.length, stream);
    stream.markdown(`Applying ${applicablePrompts.length} prompt(s) to diff ${diffFile.relativePath}\n`);
    await processContent(gitDiff.formatDiffForReview(diffFile, range), diffFile.filePath, applicablePrompts, model, token, stream);
    processedCount++;
  }

  outputSkippedDiffFiles(skippedFiles, stream);
}

/**
 * 指定されたソースファイルを処理する非同期関数。
 *
 * @param {string[]} sourcePaths - 処理するソースファイルのパスの配列。
 * @param {PromptMetadata[]} promptMetadata - プロンプトメタデータの配列。
 * @param {vscode.LanguageModelChat} model - 使用するChat Model
 * @param {vscode.CancellationToken} token - キャンセルトークン。
 * @param {vscode.ChatResponseStream} stream - チャット用の Response Stream
 * @returns {Promise<void>} 処理が完了したことを示すPromise
 */
export async function processSourceFiles(
  sourcePaths: string[],
  promptMetadata: PromptMetadata[],
  model: vscode.LanguageModelChat,
  token: vscode.CancellationToken,
  stream: vscode.ChatResponseStream,
): Promise<void> {
  const outputMode = Config.getOutputMode();
  const strategy = OutputStrategyFactory.create(outputMode);

  // ワークスペースルートを取得
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";

  // まずフィルタリングを行い、処理対象とスキップ対象を分類
  const processableFiles: Array<{ sourcePath: string; applicablePrompts: PromptMetadata[] }> = [];
  const skippedFiles: string[] = [];

  for (const sourcePath of sourcePaths) {
    const applicablePrompts = filterPromptsByTarget(promptMetadata, sourcePath, workspaceRoot);
    if (applicablePrompts.length === 0) {
      // ワークスペースルートからの相対パスで記録
      const relativePath = workspaceRoot ? path.relative(workspaceRoot, sourcePath) : sourcePath;
      skippedFiles.push(relativePath);
    } else {
      processableFiles.push({ sourcePath, applicablePrompts });
    }
  }

  // 処理対象ファイルの総数
  const totalProcessable = processableFiles.length;

  // ソースファイルを軸にして、プロンプトを適用していく
  let processedCount = 0;
  for (const { sourcePath, applicablePrompts } of processableFiles) {
    strategy.outputProgress(processedCount, totalProcessable, stream);

    const content = fs.readFileSync(sourcePath, { encoding: "utf8" });

    stream.markdown(`Applying ${applicablePrompts.length} prompt(s) to ${path.basename(sourcePath)}\n`);
    await processContent(content, sourcePath, applicablePrompts, model, token, stream);
    processedCount++;
  }

  // スキップされたファイルをまとめて表示
  if (skippedFiles.length > 0) {
    stream.markdown(`\n⚠️ Skipped ${skippedFiles.length} file(s) with no matching prompts:\n`);
    for (const fileName of skippedFiles) {
      stream.markdown(`  - ${fileName}\n`);
    }
  }
}

/**
 * エディタ上で選択した内容をプロンプトで処理する
 *
 * @param {PromptMetadata[]} promptMetadata - プロンプトメタデータの配列。
 * @param {vscode.LanguageModelChat} model - 使用するChat Model
 * @param {vscode.CancellationToken} token - キャンセルトークン。
 * @param {vscode.ChatResponseStream} stream - チャット用の Response Stream
 * @returns {Promise<void | vscode.ChatResult>} 処理が完了したことを示すPromise、またはエラーが発生した場合はエラー情報を含む ChatResult
 */
export async function processSelectedContent(
  promptMetadata: PromptMetadata[],
  model: vscode.LanguageModelChat,
  token: vscode.CancellationToken,
  stream: vscode.ChatResponseStream,
): Promise<void | vscode.ChatResult> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return createErrorResponse("No active editor", stream);
  }

  const selection = editor.selection;
  if (selection.isEmpty) {
    return createErrorResponse("No selection found", stream);
  }

  // 対象ファイルのパスを取得
  const contentFilePath = editor.document.uri.fsPath;
  // 選択された領域の内容を取得
  const content = editor.document.getText(selection);
  if (!content) {
    return createErrorResponse("No content found", stream);
  }

  // ワークスペースルートを取得
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";

  // アクティブエディタのファイルパスを取得してフィルタリング
  const applicablePrompts = filterPromptsByTarget(promptMetadata, contentFilePath, workspaceRoot);

  if (applicablePrompts.length === 0) {
    stream.markdown(`⚠️ No prompts matched for file: ${path.basename(contentFilePath)}\n`);
    return;
  }

  stream.markdown(`Applying ${applicablePrompts.length} prompt(s) to selection\n`);
  await processContent(content, contentFilePath, applicablePrompts, model, token, stream);
}

/**
 * 指定されたコンテンツをプロンプトで処理し、その結果を Chat Viewに返却する
 *
 * @param {string} content - 処理対象の文字列
 * @param {string} contentFilePath - 処理対象となるファイルパス
 * @param {PromptMetadata[]} promptMetadata - プロンプトメタデータの配列。
 * @param {vscode.LanguageModelChat} model - 使用する Chat Model
 * @param {vscode.CancellationToken} token - キャンセルトークン。
 * @param {vscode.ChatResponseStream} stream -
 * @returns {Promise<void>} 処理が完了したことを示すプロミス。
 */
export async function processContent(
  content: string,
  contentFilePath: string,
  promptMetadata: PromptMetadata[],
  model: vscode.LanguageModelChat,
  token: vscode.CancellationToken,
  stream: vscode.ChatResponseStream,
): Promise<void> {
  const outputMode = Config.getOutputMode();
  const strategy = OutputStrategyFactory.create(outputMode);

  for (const meta of promptMetadata) {
    const promptFile = meta.filePath;
    const promptContent = meta.content;
    const messages = [
      vscode.LanguageModelChatMessage.User(promptContent),
      vscode.LanguageModelChatMessage.User(content),
    ];

    try {
      stream.markdown(`## Review Details \n\n`);

      // Workspaceのroot pathから相対パスで出力
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (workspaceRoot) {
        stream.markdown(`- Prompt: ${path.relative(workspaceRoot, promptFile)}\n`);
        stream.markdown(`- Target: ${path.relative(workspaceRoot, contentFilePath)}\n`);
      } else {
        stream.markdown(`- Prompt: ${promptFile}\n`);
        stream.markdown(`- Target: ${contentFilePath}\n`);
      }
      stream.markdown(`----\n`);

      // プロンプトを送信し、GitHub Copilot の AI モデルから応答を受信、出力する
      const res = await model.sendRequest(messages, {}, token);
      await strategy.outputReviewResult(res.text, stream);
    } catch (error) {
      if (error instanceof vscode.LanguageModelError) {
        switch (error.code) {
          case vscode.LanguageModelError.Blocked().code:
            console.error("Request blocked:", error);
            stream.markdown("Request blocked");
            break;

          case vscode.LanguageModelError.NoPermissions().code:
            console.error("No permissions:", error);
            stream.markdown("No permissions");
            break;

          case vscode.LanguageModelError.NotFound().code:
            console.error("Not found:", error);
            stream.markdown("Not found");
            break;

          default:
            console.error("Error processing content:", error.cause);
            stream.markdown(`Error processing content: ${error.cause}`);
        }
      }
      console.error("Error processing content:", error);
      stream.markdown(`Error processing content: ${error}`);
    } finally {
      stream.markdown("\n\n");
      if (stream instanceof FileChatResponseStreamWrapper) {
        stream.writeToFile();
        // writeToFile()内で既にclearContent()が呼ばれているが、
        // 明示的なリソース解放パターンとして、また将来的に
        // ファイルハンドル等の追加リソース管理の可能性を考慮してdispose()を呼び出す
        stream.dispose();
      }
    }
  }
}

/**
 * file-onlyモードでoutputPathが未設定の場合に警告を表示
 * @param {string} outputMode - 出力モード
 * @param {string | undefined} outputDirPath - 出力ディレクトリパス
 */
export function warnIfFileOnlyWithoutOutputPath(
  outputMode: "chat-only" | "file-only",
  outputDirPath: string | undefined,
): void {
  if (outputMode === "file-only" && (!outputDirPath || outputDirPath.length === 0)) {
    vscode.window
      .showWarningMessage(
        "Output mode is set to 'file-only' but 'chat.outputPath' is not configured. Results will be displayed in chat window instead.",
        "Open Settings",
      )
      .then((selection) => {
        if (selection === "Open Settings") {
          vscode.commands.executeCommand("workbench.action.openSettings", "chat.outputPath");
        }
      });
  }
}

/**
 * チャット内容の保存先となるファイルパスを生成する
 *
 * @param {string} dirPath - 出力先ディレクトリのパス
 * @returns {string} 生成したファイルパス
 */
export function makeChatFilePath(dirPath: string): string {
  const timestamp = timestampAsString();

  return path.join(dirPath, `Promptis_${timestamp}.md`);
}

export function createErrorResponse(message: string, stream: vscode.ChatResponseStream): vscode.ChatResult {
  console.debug(message);
  stream.markdown(message);
  return { errorDetails: { message } };
}

function outputSkippedDiffFiles(skippedFiles: string[], stream: vscode.ChatResponseStream): void {
  if (skippedFiles.length === 0) {
    return;
  }

  stream.markdown(`\nSkipped ${skippedFiles.length} Git diff file(s):\n`);
  for (const skippedFile of skippedFiles) {
    stream.markdown(`  - ${skippedFile}\n`);
  }
}

function errorToMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
