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
async function extractFilesInDirectory(filterPattern: string, stream: vscode.ChatResponseStream): Promise<string[]> {
  // 処理対象ソースファイルのパスを格納する配列
  const srcPaths: string[] = [];

  const dirUris = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: "Select Directory",
  });
  if (!dirUris || dirUris.length === 0) {
    return [];
  }

  const dirUri = dirUris[0];
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
    const paths = await extractFilesInDirectory(filterPattern, stream);
    srcPaths.push(...paths);
  }

  // references は出現順の逆順になるため、末尾から処理する
  for (let i = req.references.length - 1; i >= 0; i--) {
    const ref = req.references[i];

    // チャットの中で #file: として指定された時の request.references の例
    //   Linuxの場合:   {"id":"vscode.file","name":"file:.bashrc","range":[12,25],"value":{"$mid":1,"path":"/home/node/.bashrc","scheme":"file"}}]
    //   Windowsの場合: {"id":"vscode.file","name":"file:util.ts","range":[0,13], "value":{"$mid":1,"fsPath":"c:\\path\\to\\util.ts","_sep":1,"external":"file:///path/to/util.ts","path":"/c:/path/to/util.ts","scheme":"file"}}
    // value は型としては unknown だが、実体は vscode.Uri 型になっている

    // referenceがファイルの場合、当該ファイルの内容を返す
    if (ref.id === "vscode.file") {
      const uri = ref.value as vscode.Uri;
      srcPaths.push(uriToPath(uri));
    }
  }

  // 処理対象ファイルを出力し終えたことを示すために、区切り線を表示する
  stream.markdown(`----\n\n`);
  return srcPaths;
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
