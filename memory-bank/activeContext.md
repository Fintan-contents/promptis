# アクティブコンテキスト

Chat Windowへの出力制御コマンド（suppressOutput/verboseOutput）を実装し、パフォーマンス問題に対処しました。

## 実装の詳細

- `suppressOutput`: 大量のファイルを処理する際にChat Windowへの出力を抑制し、処理時間を短縮
- `verboseOutput`: デフォルトの動作モードとして、詳細な出力を提供

## 成果

- 大量のファイルを処理する際の所要時間を約半分に短縮
- ユーザーが必要に応じて出力モードを切り替え可能
