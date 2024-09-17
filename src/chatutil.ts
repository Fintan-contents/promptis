import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

/**
 * @interface
 * 拡張されたチャットレスポンスストリーム。ファイルに書き込む機能を追加している
 */
interface IFileChatResponseStream extends vscode.ChatResponseStream {
  writeToFile(filePath: string): void;
}

/**
 * 拡張されたファイルチャットレスポンスストリームの実装。
 * コンストラクタで指定されたファイルに対し、ChatResponseStream に書き込まれた内容を書き込む
 *
 */
export class FileChatResponseStream implements IFileChatResponseStream {
  private originalStream: vscode.ChatResponseStream;
  private content: string[] = [];
  private filePath: string;

  /**
   * コンストラクタ。
   * @param {vscode.ChatResponseStream} originalStream - 元のチャットレスポンスストリーム
   * @param {string} filePath - コンテンツの保存先ファイルパス
   */
  constructor(originalStream: vscode.ChatResponseStream, filePath: string) {
    this.originalStream = originalStream;
    this.filePath = filePath;
  }

  anchor(value: vscode.Uri | vscode.Location, title?: string): void {
    this.originalStream.anchor(value, title);
  }
  button(command: vscode.Command): void {
    this.originalStream.button(command);
  }
  filetree(value: vscode.ChatResponseFileTree[], baseUri: vscode.Uri): void {
    this.originalStream.filetree(value, baseUri);
  }
  progress(value: string): void {
    this.originalStream.progress(value);
  }
  reference(
    value: vscode.Uri | vscode.Location,
    iconPath?: vscode.Uri | vscode.ThemeIcon | { light: vscode.Uri; dark: vscode.Uri },
  ): void {
    this.originalStream.reference(value, iconPath);
  }
  push(part: vscode.ChatResponsePart): void {
    this.originalStream.push(part);
  }

  /**
   * Markdown形式のテキストを保存対象に追加し、元のストリームにも書き出す
   * @param {string} text - Markdown形式のテキスト
   */
  markdown(text: string): void {
    this.content.push(text);
    this.originalStream.markdown(text);
  }

  /**
   * 保存用に累積したコンテンツをファイルに書き込む
   */
  writeToFile(): void {
    try {
      // ファイルパスを絶対パスに変換
      const fullPath = path.resolve(this.filePath);
      // コンテンツをファイルに書き込む
      fs.writeFileSync(fullPath, this.content.join(""), "utf8");
    } catch (error) {
      console.error("Failed to write file:", error);
      vscode.window.showErrorMessage("Failed to write file: " + error);
      throw error;
    }
  }
}
