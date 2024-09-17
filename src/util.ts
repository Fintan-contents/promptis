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

export function extractTargetFiles(req: vscode.ChatRequest): string[] {
  // references は出現順の逆順になるため、末尾から処理する
  const ret: string[] = [];
  for (let i = req.references.length - 1; i >= 0; i--) {
    const ref = req.references[i];

    // チャットの中で #file: として指定された時の request.references の例
    // [{"id":"vscode.file","name":"file:.bashrc","range":[12,25],"value":{"$mid":1,"path":"/home/node/.bashrc","scheme":"file"}}]
    // value は型としては unknown だが、実体は vscode.Uri 型になっている

    // referenceがファイルの場合、当該ファイルの内容を返す
    if (ref.id === "vscode.file") {
      const uri = ref.value as vscode.Uri;
      ret.push(uri.path);
    }
  }
  return ret;
}
