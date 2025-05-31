import fs from "fs";
import { minimatch } from "minimatch";
import path from "path";
import * as vscode from "vscode";

/**
 * 指定したディレクトリ内のファイルを再帰的に取得する関数
 *
 * @param {string} directoryPath - ファイル一覧を取得するディレクトリのパス
 * @returns {fs.Dirent[]} - ディレクトリ内のファイルエントリの配列
 *
 * @example
 * const files = getFilesInDirectory('/path/to/directory');
 *
 * @throws {Error} - ディレクトリの読み取りに失敗した場合
 */
function getFilesInDirectory(directoryPath: string): fs.Dirent[] {
  try {
    const entries = fs.readdirSync(directoryPath, {
      withFileTypes: true,
      recursive: true,
    });

    // ディレクトリ内の全エントリの中からファイルのみを返す;
    return entries.filter((entry) => entry.isFile());
  } catch (error) {
    console.error("Failed to read directory:", error);
    vscode.window.showErrorMessage("Failed to read directory: " + error);
    return [];
  }
}

/**
 * 指定されたディレクトリ配下にある、拡張子が.mdのファイルを抽出し、指定されたignoreパターンにマッチしないファイルを返す関数。
 *
 * @param {string} directoryPath - ファイル一覧を取得するディレクトリのパス
 * @param {string[]} ignorePatterns - 無視するファイルパターンの配列
 * @returns {string[]} - .mdファイルのパスの配列（ignoreパターンにマッチしないもの）
 *
 * @example
 * const promptFiles = findPromptFiles('/path/to/directory', ['node_modules/**', '*.test.md']);
 * console.log(promptFiles);
 */
export function findPromptFiles(directoryPath: string, ignorePatterns: string[]): string[] {
  const files = getFilesInDirectory(directoryPath);

  console.log(`Found ${files.length} files in ${directoryPath}`);
  console.log("Ignore patterns:", JSON.stringify(ignorePatterns));
  // .mdファイル、かつ ignore パターンにマッチしないファイルを抽出する
  const promptFiles = files
    // プロンプトファイルの拡張子は.mdとする
    .filter((file) => file.name.endsWith(".md"))
    .map((file) => path.join(file.parentPath, file.name))
    // ignorePatternsにマッチしないファイルのみを残す
    .filter((p) => ignorePatterns.every((pattern) => !minimatch(p, pattern)));

  return promptFiles;
}

/**
 * URIをファイルパスに変換する関数。
 * URIのスキームがfileの場合はfsPathを、それ以外の場合はpathを返す。
 * @param {vscode.Uri} uri - 変換するURI
 * @returns {string} - ファイルパス
 * @example
 * const uri = vscode.Uri.file('/path/to/file');
 * const path = uriToPath(uri);
 * console.log(path);
 */
function uriToPath(uri: vscode.Uri): string {
  // 基本的にはfsPathを使うべき。ただし、Linuxの場合はfsPathが渡されないため、pathを使う
  return uri.fsPath ?? uri.path;
}

/**
 * 指定されたディレクトリ内のファイルを取得し、そのパスを返す関数。
 * @param {string} filterPattern - フィルタリングパターン
 * @param {vscode.ChatResponseStream} stream - Chat Response Stream
 * @returns {string[]} - ファイルのパスの配列
 * @example
 * const files = await extractFilesInDirectory('/path/to/directory', stream);
 * console.log(files);
 */
export async function extractFilesInDirectory(
  req: vscode.ChatRequest,
  filterPattern: string,
  stream: vscode.ChatResponseStream,
): Promise<string[]> {
  // 処理対象ソースファイルのパスを格納する配列
  const srcPaths: string[] = [];

  // ディレクトリが明示的に指定されている場合は非 undefined となる
  let dirUri = getUserSpecifiedDirectory(req);
  if (!dirUri) {
    const dirUris = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: "Select Directory",
    });
    if (!dirUris || dirUris.length === 0) {
      return [];
    }

    dirUri = dirUris[0];
  }

  const dirPath = uriToPath(dirUri);
  stream.markdown(
    `You specified \`#dir\`, so the following files under the specified directory \`${dirPath}\` will be added as targets for prompt application.\n\n`,
  );

  // 指定されたディレクトリの全ファイルを対象とする
  const fileUris = await vscode.workspace.findFiles(new vscode.RelativePattern(dirUri, filterPattern));
  for (const fileUri of fileUris) {
    const fileRelPath = path.relative(dirPath, uriToPath(fileUri));
    stream.markdown(`- ${path.join(path.basename(dirPath), fileRelPath)}\n`);
    srcPaths.push(uriToPath(fileUri));
  }

  return srcPaths;
}

/**
 * ユーザの Chat Request 中で指定されたレビュー対象ファイルを取得する関数。
 *
 * @param {vscode.ChatRequest} req - ユーザの Chat Request
 * @param {vscode.ChatResponseStream} stream - Chat Response Stream
 * @returns {string[]} - 処理対象ファイルのパスの配列
 *
 * @example
 * const targetFiles = await extractTargetFiles(request, stream);
 * console.log(targetFiles);
 */
export async function extractTargetFiles(
  req: vscode.ChatRequest,
  stream: vscode.ChatResponseStream,
): Promise<string[]> {
  // 処理対象ソースファイルのパスを格納する配列
  const srcPaths: string[] = [];

  let filterPattern = "**/*"; // デフォルトのフィルタリングパターン
  const match = req.prompt.match(/#filter:(\S+)/);
  if (match) {
    filterPattern = match[1];
  }

  // チャットの中で #dir を指定された時に、ディレクトリを選択させる
  // 選択されたディレクトリ配下のファイルをプロンプト処理対象とする
  if (req.prompt.includes("#dir")) {
    const paths = await extractFilesInDirectory(req, filterPattern, stream);
    srcPaths.push(...paths);
  }

  console.info(JSON.stringify(req.references, null, 2));

  for (let i = 0; i < req.references.length; i++) {
    const ref = req.references[i];

    // referenceがファイルの場合、当該ファイルの内容を返す
    // 単にVSCodeでファイルを開いており自動的にコンテキストに含まれるファイルは対象としない
    // (この場合は、ChatImplicitContext 型になる
    //  https://github.com/microsoft/vscode/blob/5a4e405ee0e6ff91e17ac6bf3f3b7efd34353ca1/src/vs/workbench/contrib/chat/browser/contrib/chatImplicitContext.ts#L200C14-L200C33 )
    //
    // value は型としては unknown だが、実体は vscode.Uri 型
    // ref.id は不定なので、instanceof で型を確認する
    if (ref.value && ref.value instanceof vscode.Uri) {
      const uri = ref.value as vscode.Uri;
      const filePath = uriToPath(uri);

      if (fs.statSync(filePath).isDirectory()) {
        stream.markdown(
          `The following files under the specified directory \`${filePath}\` will be added as targets for prompt application.\n\n`,
        );
        // 指定されたディレクトリの全ファイルを対象とする
        const fileUris = await vscode.workspace.findFiles(new vscode.RelativePattern(uri, filterPattern));
        for (const fileUri of fileUris) {
          const fileRelPath = path.relative(filePath, uriToPath(fileUri));
          stream.markdown(`- ${path.join(path.basename(filePath), fileRelPath)}\n`);
          srcPaths.push(uriToPath(fileUri));
        }
      } else {
        srcPaths.push(uriToPath(uri));
      }
    }
  }
  const uniqueSrcPaths = srcPaths.filter((item, index) => srcPaths.indexOf(item) === index);

  // 処理対象ファイルを出力し終えたことを示すために、区切り線を表示する
  stream.markdown(`----\n\n`);
  return uniqueSrcPaths;
}

/**
 * プロンプト内で #dir: を用いる形でユーザーが指定したディレクトリを取得する
 *
 * @param req - ユーザーからのプロンプトを含む `vscode.ChatRequest` オブジェクト。
 * @returns ユーザーが指定したディレクトリの `vscode.Uri` オブジェクト、またはディレクトリが見つからない場合は `undefined` を返す。
 *
 * ユーザーが指定するディレクトリは、`#dir:` プレフィックスに続くダブルクォートで囲まれた文字列、または非空白文字列として認識される
 * 指定されたディレクトリが絶対パスの場合、そのパスが存在するかどうかを確認する
 * 指定されたディレクトリが相対パスの場合、ワークスペースルートからの相対パスとして存在確認を行う
 *
 * ワークスペースが開かれていない場合、エラーメッセージを表示し、`undefined` を返す
 * ディレクトリが見つからない場合もエラーメッセージを表示し、`undefined` を返します。
 */
export function getUserSpecifiedDirectory(req: vscode.ChatRequest): vscode.Uri | undefined {
  // ダブルクォートで囲まれた1つ以上の任意の文字列にマッチ、
  // あるいは、1つ以上の非空白文字列にマッチ
  const dirMatch = req.prompt.match(/#dir:(?:"([^"]+)"|(\S+))?/);
  console.info(`dirMatch: ${dirMatch}`);

  if (!dirMatch) {
    return undefined;
  }

  const dirPath = dirMatch[1] || dirMatch[2];
  console.info(`User specified directory: ${dirPath}`);

  let absDirPath: string;

  if (path.isAbsolute(dirPath)) {
    absDirPath = dirPath;
  } else {
    // 相対パスの場合は、ワークスペースルートからの相対パスとして存在確認を実施
    // ワークスペースは複数開いている可能性があるが、Clineでも最初の1つを取得していたため、まずはそれに合わせる
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    if (!workspaceRoot) {
      vscode.window.showErrorMessage("No workspace is opened.");
      return undefined;
    }
    absDirPath = path.join(workspaceRoot, dirPath);
  }

  // ディレクトリ存在チェック
  if (!fs.existsSync(absDirPath)) {
    // ディレクトリが存在しない場合はエラーとする
    vscode.window.showErrorMessage(`Directory not found: ${absDirPath}`);
    return undefined;
  }
  return vscode.Uri.file(absDirPath);
}

/**
 * タイムスタンプをYYYYMMDD-HHmmss形式の文字列で返す関数。
 *
 * @param {Date} date - タイムスタンプを取得する日時。省略した場合は現在時刻を使用する。
 * @returns {string} - YYYYMMDD-HHmmss形式の文字列
 */
export function timestampAsString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}-${hour}${minute}${second}`;
}
