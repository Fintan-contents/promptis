# promptis README

![test](https://github.com/Fintan-contents/promptis/actions/workflows/test.yaml/badge.svg?label=新しい)

GitHub Copilot Chatは実装に関する質問をプロンプトで行うことができますが、このプロンプトを逐一打ち込む負荷が高いことによって次のような問題が生じていました。

- **時間と生産性の問題**
  - 頻繁なプロンプト入力によりコーディングが中断され、集中力の低下や生産性の減少が発生する
  - コンテキストの再説明に時間を要し、作業フローの非効率化につながる
- **品質と一貫性の問題**
  - 短いプロンプトでは開発者の意図を完全に伝えきれず、生成されるコードの品質や適切性が低下する
  - 異なるプロンプトの使用により、生成されるコードのスタイルや方針に一貫性がなくなり、プロジェクト全体の統一性が損なわれる

Promptisは、これらの問題を解決するために、GitHub Copilot Chatを活用してプロンプト実行を半自動化するVS Code Extensionです。

## Features

- **半自動化されたプロンプト実行**: 事前に準備したプロンプトを連続して実行可能
- **一貫性のあるコード生成**: プロンプトの統一により、コードの品質と一貫性を向上
- **生産性の向上**: 頻繁なプロンプト入力の手間を削減し、コーディングに集中できる

## Usage

VSCodeのチャットから `@promptis` に対してコマンド実行を指示してください。

指示できるコマンドは次のとおりです。プロンプトを事前に（複数）準備しておけば、それを連続実行可能です。

## コマンドマップ

| コマンド名                      | 実行内容                                      |
|---------------------------------|-----------------------------------------------|
| `codereviewCodeStandards`       | コード基準に関する一連のコードレビューを行う |
| `codereviewFunctional`          | 機能観点のコードレビューを行う |
| `codereviewNonFunctional`       | 非機能観点のコードレビューを行う |
| `reverseEngineeringPromptPath`  | ソースコードに対するリバースエンジニアリングを行う |
| `drowDiagrams`                  | ソースコードから図式を作成する |

## Requirements

- [VS Code](https://code.visualstudio.com/) が[version.1.91.0](https://code.visualstudio.com/updates/v1_91)以降
  - Chat、Language Model APIを利用するため
- 次のExtensionがインストール済であること
  - [GitHub Copilot Extension](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot)
  - [GitHub Copilot Chat](https://marketplace.visualstudio.com/items?itemName=GitHub.copilot-chat)

## Extension Settings

| 設定項目 | type | デフォルト値 | 設定内容 |
|--|--|--|--|
| `codeReview.codeStandardPath`     | string   |  | コードレビュープロンプト格納ディレクトリの絶対パス（コード規約観点） |
| `codeReview.functionalPath`       | string   |  | コードレビュープロンプト格納ディレクトリの絶対パス（機能観点） |
| `codeReview.nonFunctionalPath`    | string   |  | コードレビュープロンプト格納ディレクトリの絶対パス（非機能観点） |
| `reverseEngineering.promptsPath`  | string   |  | リバースエンジニアリング用プロンプト格納ディレクトリの絶対パス |
| `drawDiagrams.promptsPath`        | string   |  | 図式生成用のプロンプト用ディレクトリの絶対パス |
| `prompt.excludeFilePatterns`      | array of string | | プロンプト格納ディレクトリ配下のプロンプトファイルのうち、実行しないファイル名のパターン（ex., `**/dir/*.md`）。記述できるパターンは[minimatch-cheat-sheet](https://github.com/motemen/minimatch-cheat-sheet)を参照。 |
| `chat.outputPath`                 | string   |  | チャット内容のバックアップ出力先ディレクトリの絶対パス |

## Known Issues

現在、既知の問題はありません。

## Release Notes

## For more information
