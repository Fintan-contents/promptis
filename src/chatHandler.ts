import fs from "fs";
import moment from "moment";
import path from "path";
import * as vscode from "vscode";
import { postUsage } from "./api";
import { FileChatResponseStream } from "./chatutil";
import { Config } from "./config";
import { extractTargetFiles, findPromptFiles } from "./util";

export interface IPromptisChatResult extends vscode.ChatResult {}

type CommandPromptPathMap = Map<string, () => string | undefined>;
const commandPromptDirectoryMap: CommandPromptPathMap = new Map([
  ["codereviewCodeStandards", Config.getCodeReviewStandardPath],
  ["codereviewFunctional", Config.getCodeReviewFunctionalPath],
  ["codereviewNonFunctional", Config.getCodeReviewNonFunctionalPath],
  ["reverseEngineeringPromptPath", Config.getReverseEngineeringPromptPath],
  ["drowDiagrams", Config.getDrawDiagramsPromptPath],
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
export const chatHandler: vscode.ChatRequestHandler = async (
  request: vscode.ChatRequest,
  context: vscode.ChatContext,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken,
): Promise<IPromptisChatResult> => {
  // chatに使用するAIモデルを選択する
  const chatModel = await selectChatModel();
  if (!chatModel) {
    return createErrorResponse("No chat model found", stream);
  }

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

  // ユーザの Chat Request 中で指定されたレビュー対象ファイルを取得する
  const targetFiles = extractTargetFiles(request);
  if (targetFiles.length > 0) {
    // ファイル指定があれば、当該ファイルをレビューする
    await processSourceFiles(targetFiles, promptFiles, chatModel, token, stream);
  } else {
    // ファイル指定がなければ、エディタで選択されている内容をレビューする
    await processSelectedContent(promptFiles, chatModel, token, stream);
  }

  return {};
};

export function getPromptDirectory(command: string): string | undefined {
  const dir = commandPromptDirectoryMap.get(command)?.();
  return dir;
}

/**
 * Copilotベンダーの Chat Modelを選択する
 *
 * @returns {Promise<vscode.LanguageModelChat | null>} 選択されたChat Model。modelが見つからなかった場合やエラーが発生した場合はnullを返す。
 */
export async function selectChatModel(): Promise<vscode.LanguageModelChat | null> {
  try {
    // CopilotベンダーのGPT-4oファミリーのチャットモデルを選択する
    const models = await vscode.lm.selectChatModels({
      vendor: "copilot",
      family: "gpt-4o",
    });

    // 見つかったチャットモデルの数をデバッグ出力する
    console.debug(`Found ${models.length} chat models`);

    // チャットモデルが見つからなかった場合のエラーハンドリング
    if (models.length === 0) {
      console.error("No chat models found");
      vscode.window.showErrorMessage("No chat models found");
      return null;
    }

    // 最初のチャットモデルを返す
    return models[0];
  } catch (error) {
    // エラーハンドリング
    console.error("Error selecting chat models", error);
    vscode.window.showErrorMessage("Error selecting chat models");
    return null;
  }
}

/**
 * 指定されたソースファイルを処理する非同期関数。
 *
 * @param {string[]} sourcePaths - 処理するソースファイルのパスの配列。
 * @param {string[]} promptPaths - プロンプトファイルのパスの配列。
 * @param {vscode.LanguageModelChat} model - 使用するChat Model
 * @param {vscode.CancellationToken} token - キャンセルトークン。
 * @param {vscode.ChatResponseStream} stream - チャット用の Response Stream
 * @returns {Promise<void>} 処理が完了したことを示すPromise
 */
export async function processSourceFiles(
  sourcePaths: string[],
  promptPaths: string[],
  model: vscode.LanguageModelChat,
  token: vscode.CancellationToken,
  stream: vscode.ChatResponseStream,
) {
  // ソースファイルを軸にして、プロンプトを適用していく
  for (const sourcePath of sourcePaths) {
    stream.progress(`Processing ${sourcePath} ...\n`);
    console.debug(`Processing ${sourcePath} ...`);

    const content = fs.readFileSync(sourcePath, { encoding: "utf8" });
    await processContent(content, sourcePath, promptPaths, model, token, stream);
  }
}

/**
 * エディタ上で選択した内容をプロンプトで処理する
 *
 * @param {string[]} promptFiles - プロンプトファイルのパスの配列。
 * @param {vscode.LanguageModelChat} model - 使用するChat Model
 * @param {vscode.CancellationToken} token - キャンセルトークン。
 * @param {vscode.ChatResponseStream} stream - チャット用の Response Stream
 * @returns {Promise<void>} 処理が完了したことを示すPromise
 */
export async function processSelectedContent(
  promptFiles: string[],
  model: vscode.LanguageModelChat,
  token: vscode.CancellationToken,
  stream: vscode.ChatResponseStream,
) {
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

  await processContent(content, contentFilePath, promptFiles, model, token, stream);
}

/**
 * 指定されたコンテンツをプロンプトで処理し、その結果を Chat Viewに返却する
 *
 * @param {string} content - 処理対象の文字列
 * @param {string} contentFilePath - 処理対象となるファイルパス
 * @param {string[]} promptFiles - プロンプトファイルのパスの配列。
 * @param {vscode.LanguageModelChat} model - 使用する Chat Model
 * @param {vscode.CancellationToken} token - キャンセルトークン。
 * @param {vscode.ChatResponseStream} stream -
 * @returns {Promise<void>} 処理が完了したことを示すプロミス。
 */
export async function processContent(
  content: string,
  contentFilePath: string,
  promptFiles: string[],
  model: vscode.LanguageModelChat,
  token: vscode.CancellationToken,
  stream: vscode.ChatResponseStream,
) {
  // チャット内容保存ディレクトリを取得。有効な値が存在している場合は、ファイルに保存するようにする
  const outputDirPath = Config.getChatOutputDirPath();
  if (outputDirPath && outputDirPath.length > 0) {
    // ResponseStream をラップして、ファイルに保存するようにする
    stream = new FileChatResponseStream(stream, makeChatFilePath(outputDirPath, contentFilePath));
  }

  try {
    for (const promptFile of promptFiles) {
      const promptContent = fs.readFileSync(promptFile, "utf8");
      const messages = [
        vscode.LanguageModelChatMessage.User(promptContent),
        vscode.LanguageModelChatMessage.User(content),
      ];

      try {
        stream.markdown(`## Prompt file: ${path.basename(promptFile)}\n\n`);

        // プロンプトを送信し、GitHub Copilot の AI モデルから応答を受信、出力する
        const res = await model.sendRequest(messages, {}, token);
        for await (const fragment of res.text) {
          stream.markdown(fragment);
        }
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
      }
    }
  } finally {
    if (stream instanceof FileChatResponseStream) {
      stream.writeToFile();
    }
  }
}

/**
 * チャット内容の保存先となるファイルパスを生成する
 *
 * @param {string} dirPath - 出力先ディレクトリのパス
 * @param {string} sourceFilePath - 処理対象ファイルのパス
 * @returns {string} 生成したファイルパス
 */
export function makeChatFilePath(dirPath: string, sourceFilePath: string) {
  const basename = path.basename(sourceFilePath, path.extname(sourceFilePath));
  const timestamp = moment().format("YYYYMMDD-HHmmss");
  return path.join(dirPath, `${basename}_${timestamp}.md`);
}

export function createErrorResponse(message: string, stream: vscode.ChatResponseStream): IPromptisChatResult {
  console.debug(message);
  stream.markdown(message);
  return { errorDetails: { message } };
}
