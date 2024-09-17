import * as vscode from "vscode";
import { chatHandler } from "./chatHandler";

export const PREFIX = "promptis";
const PARTICIPANT_ID = "promptis.promptis";

export function activate(context: vscode.ExtensionContext) {
  // Participantと、当該Participantへのメンションに反応するハンドラを設定
  const promptis = vscode.chat.createChatParticipant(PARTICIPANT_ID, chatHandler);

  // Participantのアイコンパスを設定する
  promptis.iconPath = vscode.Uri.joinPath(context.extensionUri, "images", "icon.gif");

  // コマンドをVSCodeに登録し、それぞれのコマンド実行時の動作を設定
  for (const [key, value] of Object.entries(commandMap)) {
    context.subscriptions.push(vscode.commands.registerCommand(value.id, (...args) => value.execute(context, ...args)));
  }
}

export function deactivate() {}

/**
 * コマンドIDと対応する実行関数をもつInterface
 *
 * @interface Command
 * @property {string} id - コマンドの識別子
 * @property {(context: vscode.ExtensionContext, ...args: any[]) => void} f - コマンドが実行されたときに呼び出される関数
 * @param {vscode.ExtensionContext} context - 拡張機能のライフサイクルを管理するためのコンテキストオブジェクト
 * @param {...any[]} args - コマンドに渡される追加の引数
 */
export interface Command {
  id: string;
  execute: (context: vscode.ExtensionContext, ...args: any[]) => void;
}

/**
 * コマンドのマッピングを保持するオブジェクト。
 * 各コマンドは一意のキーで識別され、対応するコマンドオブジェクトを持つ。
 *
 * @type {{ [key: string]: Command }}
 * @property {Command} selectPromptDirectory - プロンプトディレクトリを選択するコマンド。
 */
export const commandMap: { [key: string]: Command } = {};

/**
 * コマンドを VSCode へ登録します。
 *
 * @param {vscode.ExtensionContext} context - 拡張機能のライフサイクルを管理するためのコンテキストオブジェクト
 */
export function registerCommands(context: vscode.ExtensionContext, commandMap: { [key: string]: Command }) {
  for (const [key, value] of Object.entries(commandMap)) {
    context.subscriptions.push(vscode.commands.registerCommand(value.id, (...args) => value.execute(context, ...args)));
  }
}
