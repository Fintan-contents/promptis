import * as vscode from "vscode";

/**
 * VSCode 拡張設定から特定のパスや設定を取得するためのユーティリティクラス
 */
export class Config {
  // ワークスペースの存在をチェックするヘルパーメソッド
  private static isWorkspaceAvailabile(): boolean {
    if (!vscode.workspace) {
      // ワークスペースが見つからなかった場合のデバッグログ
      console.debug("No workspace found");
      return false;
    }
    return true;
  }

  /**
   * 指定されたキーに対応する設定のパスを取得する
   * @param key 設定キー
   * @returns 設定パス、または未定義
   */
  static getPath(key: string): string | undefined {
    console.debug(`Getting path for ${key}: ` + Config.isWorkspaceAvailabile());
    if (!Config.isWorkspaceAvailabile()) {
      return undefined;
    }
    const value = vscode.workspace.getConfiguration().get<string>(key);
    if (!value) {
      vscode.commands.executeCommand("workbench.action.openSettings", key);
      vscode.window.showErrorMessage(`Path is not defined for setting key: ${key}`);
    }
    return value;
  }

  /**
   * コード規約観点でのコードレビュープロンプト用ディレクトリのパスを取得する
   * @returns ディレクトリパス、または未定義
   */
  static getCodeReviewStandardPath(): string | undefined {
    return Config.getPath("codeReview.codeStandardPath");
  }

  /**
   * 機能観点でのコードレビュープロンプト用ディレクトリのパスを取得する
   * @returns ディレクトリパス、または未定義
   */
  static getCodeReviewFunctionalPath(): string | undefined {
    return Config.getPath("codeReview.functionalPath");
  }

  /**
   * 非機能観点でのコードレビュープロンプト用ディレクトリのパスを取得する
   * @returns ディレクトリパス、または未定義
   */
  static getCodeReviewNonFunctionalPath(): string | undefined {
    return Config.getPath("codeReview.nonFunctionalPath");
  }

  /**
   * リバースエンジニアリング用プロンプト格納ディレクトリのパスを取得します。
   * @returns ディレクトリパス、または未定義
   */
  static getReverseEngineeringPromptPath(): string | undefined {
    return Config.getPath("reverseEngineering.promptsPath");
  }

  /**
   * コードを元に図式を生成するためのプロンプト格納ディレクトリのパスを取得します。
   * @returns ディレクトリパス、または未定義
   */
  static getDrawDiagramsPromptPath(): string | undefined {
    return Config.getPath("drawDiagrams.promptsPath");
  }

  /**
   * 除外するプロンプトファイルを指定するリストを取得します。
   * @returns 除外ファイルパターンの配列
   */
  static getPromptExcludeFilePatterns(): string[] {
    return vscode.workspace.getConfiguration().get<string[]>("prompt.excludeFilePatterns") || [];
  }

  /**
   * チャット出力ディレクトリのパスを取得します。
   * @returns チャット出力ディレクトリのパス、または未定義
   */
  static getChatOutputDirPath(): string | undefined {
    return Config.getPath("chat.outputPath");
  }

  /**
   * Promptisのテレメトリが有効になっているかどうかを取得します。
   * @returns テレメトリが有効な場合はtrue、それ以外はfalse
   */
  static getTelemetryEnabled(): boolean {
    return vscode.workspace.getConfiguration().get<boolean>("telemetry.enable", false);
  }
}
