#!/bin/bash
## 最新の3つのVSCodeのバージョンでテストを実行する

set -eo pipefail

# VSCodeのバージョン情報を取得する
versions=$(curl -s https://api.github.com/repos/microsoft/vscode/releases | jq -r .[].tag_name)
# 最新3つのminorバージョンを持つ semvar を取得
latest_versions=$(echo "$versions" | sort -rV | awk -F. '!seen[$1"."$2]++' | head -n 3)

for version in $latest_versions; do
  # バージョン情報を表示
  echo "Testing with VSCode version: $version"
  xvfb-run -a npx vscode-test --code-version "$version"
done
