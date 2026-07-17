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
  private static getPath(key: string): string | undefined {
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
   * Git差分レビュー用プロンプトディレクトリのパスを取得する
   * 未設定の場合はコード規約レビュー用プロンプトを利用する
   * @returns ディレクトリパス、または未定義
   */
  static getCodeReviewDiffPath(): string | undefined {
    const diffPath = vscode.workspace.getConfiguration().get<string>("codeReview.diffPath");
    if (diffPath) {
      return diffPath;
    }

    return Config.getCodeReviewStandardPath();
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
    return vscode.workspace.getConfiguration().get<string[]>("prompt.excludeFilePatterns") ?? [];
  }

  /**
   * チャット出力ディレクトリのパスを取得します。
   * @returns チャット出力ディレクトリのパス、または未定義
   */
  static getChatOutputDirPath(): string | undefined {
    // 未設定はユーザが意図しているケースがあるため、
    // 未設定の場合に設定画面を表示するgetPathは使わない
    return vscode.workspace.getConfiguration().get<string>("chat.outputPath");
  }

  /**
   * Promptisのテレメトリが有効になっているかどうかを取得します。
   * @returns テレメトリが有効な場合はtrue、それ以外はfalse
   */
  static getTelemetryEnabled(): boolean {
    return vscode.workspace.getConfiguration().get<boolean>("telemetry.enable", false);
  }

  /**
   * 出力モードを取得します。
   * @returns 出力モード（"chat-only" | "file-only"）
   */
  static getOutputMode(): "chat-only" | "file-only" {
    return vscode.workspace.getConfiguration().get<"chat-only" | "file-only">("promptis.output.mode", "chat-only");
  }

  /**
   * Git差分レビューで使用するデフォルトの差分範囲を取得します。
   * @returns デフォルトのGit差分範囲
   */
  static getGitDiffDefaultRange(): string {
    return vscode.workspace.getConfiguration().get<string>("promptis.git.defaultDiffRange", "origin/main...HEAD");
  }
}
