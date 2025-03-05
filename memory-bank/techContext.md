# 技術コンテキスト

## 使用されている技術
- **プログラミング言語**: TypeScript
- **フレームワーク**: Visual Studio Code API
- **ライブラリ**:
  - `vscode`: VS Code拡張機能の開発に使用
  - `fs`: ファイルシステム操作に使用
  - `path`: パス操作に使用
  - `minimatch`: ファイルパターンマッチングに使用

## 開発環境
- **エディタ**: Visual Studio Code
- **Node.js**: バージョンは指定されていないが、一般的に最新のLTSバージョンを推奨

## 技術的制約
- VS Codeのバージョンは`^1.93.0`以上が必要
- プロジェクトはApache-2.0ライセンスの下で提供される

## 依存関係
- **開発依存関係**:
  - `@openapitools/openapi-generator-cli`: OpenAPI仕様からTypeScriptコードを生成するために使用
  - `eslint`: コードの静的解析とスタイルチェックに使用
  - `typescript`: TypeScriptのコンパイラ
  - その他、テストやビルドに関連するライブラリが含まれる
