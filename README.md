# promptis README

![test](https://github.com/Fintan-contents/promptis/actions/workflows/test.yaml/badge.svg?label=新しい)

> [!NOTE]
> For English version, please refer to [README-en.md](https://github.com/Fintan-contents/promptis/blob/main/README-en.md).

GitHub Copilot Chatは実装に関する質問をプロンプトで行うことができますが、このプロンプトを逐一打ち込む負荷が高いことによって次のような問題が生じていました。

- **時間と生産性の問題**
  - 頻繁なプロンプト入力によりコーディングが中断され、集中力の低下や生産性の減少が発生する
  - コンテキストの再説明に時間を要し、作業フローの非効率化につながる
- **品質と一貫性の問題**
  - 短いプロンプトでは開発者の意図を完全に伝えきれず、生成されるコードの品質や適切性が低下する
  - 異なるプロンプトの使用により、生成されるコードのスタイルや方針に一貫性がなくなり、プロジェクト全体の統一性が損なわれる

Promptisは、これらの問題を解決するために、GitHub Copilot Chatを活用してプロンプト実行を半自動化するVisual Studio Code (VS Code) Extensionです。

- TODO: GIF動画を貼る

## Merits

- **半自動化されたプロンプト実行**: 事前に準備したプロンプトを連続して実行可能
- **一貫性のあるコード生成**: プロンプトの統一により、コードの品質と一貫性を向上
- **生産性の向上**: 頻繁なプロンプト入力の手間を削減し、コーディングに集中できる

## How to Install

### インターネット経由でインストールする場合

[Extensions for Visual Studio Code](https://marketplace.visualstudio.com/vscode)のPromptis[^1]からインストールしてください。

[^1]: TODO:Publish次第、リンクを貼る

### インターネットに接続できない端末にインストールする場合

[Release](https://github.com/Fintan-contents/promptis/releases)ページから、Extensionの実体である`.vsix`ファイルをダウンロードしてください。VS Codeへのインストールは、VS Codeの「拡張機能」メニューの「VSIX からのインストール」から可能です。
詳細は[Install from a VSIX](https://code.visualstudio.com/docs/editor/extension-marketplace#_install-from-a-vsix)を参照してください。

## Usage

Promptisは、GitHub Copilot Chatを利用してプロンプト実行を半自動化するためのExtensionです。

ソースコードや設定ファイルに対するレビュー観点等のプロンプトをMarkdownファイル（群）としてディレクトリに準備しておき、
Chatウィンドウから @promptis に対して指示（コマンド）を出すことで、そのコマンドに対応するプロンプトを連続して実行することができます。例えば、`chatHandler.ts`と`api.ts`に対してコード基準を満たしているかをレビューさせる場合は、次のように指示します。

@promptis /codereviewCodeStandards #file:chatHandler.ts #file:api.ts

`/codereviewCodeStandards`のコマンドと、プロンプト格納ディレクトリが1:1に対応しており、その配下にあるプロンプトファイル（拡張子: `.md`)をPromptisが再帰的に読み込み、連続実行します。

指示できるコマンドは次のとおりです。

### コマンドマップ

| コマンド名                      | 実行内容                                      |
|---------------------------------|-----------------------------------------------|
| `codereviewCodeStandards`       | コード基準に関する一連のコードレビューを行う |
| `codereviewFunctional`          | 機能観点のコードレビューを行う |
| `codereviewNonFunctional`       | 非機能観点のコードレビューを行う |
| `reverseEngineeringPromptPath`  | ソースコードに対するリバースエンジニアリングを行う |
| `drawDiagrams`                  | ソースコードから図式を作成する |

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
| `telemetry.enable`                | boolean  | true | 利用状況を示すテレメトリ情報の送信可否 |

## Telemetry

本Extensionは、利用状況を収集し本Extensionの改善を図る目的で、テレメトリを弊社サーバに送信します。収集するデータは次のとおりで、個人を特定する情報は含まれません。

| 項目名 | 説明 | 具体例 |
|--|--|--|
| 実行コマンド | 上述の「コマンドマップ」で示すコマンド名 | `codereviewCodeStandards` |
| 言語設定 | ユーザのVS Codeの言語設定 | `en` |
| VS Codeのバージョン | ユーザのVS Codeのバージョン | `1.94.1` |
| OS | ユーザのOS | `linux` |
| 本拡張のID | 本拡張のID | `tis.promptis` |
| 本拡張のバージョン | 本拡張のバージョン | `1.0.0` |
| マシンID | VS Codeをインストールしたマシンを識別するID[^2] | `3917c36ba8b94f2521fda9b5f94b783364a838148a87e5cfa3506eb6690e69a5` |

[^2]: マシンIDは、ユーザのプライバシーを保護するため、VS Codeが生成するハッシュ化された値を使用しています。

なお、テレメトリ送信はユーザ設定で無効化できます。

- VS Code全体でテレメトリを無効にしたい場合は[`telemetry.telemetryLevel`](https://code.visualstudio.com/docs/getstarted/telemetry)を参照の上、望む値へ変更してください。
- 本Extensionのテレメトリのみ無効にしたい場合は、Promptisの`telemetry.enable`設定を`false`に変更してください。

## Support

- VS Codeの最新バージョンを含め２世代前までのバージョンをサポートします
- 本Extensionのバグや機能要望については、[Issues](https://github.com/Fintan-contents/promptis/issues)にて受け付けています

## License

[Apache-2.0 License](./LICENSE)

## Release Notes
