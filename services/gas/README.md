# services/gas

LearningPlatform MVP のバックエンド実装本体です。

この配下は `clasp` で管理する Google Apps Script 用ソースを置きます。

## 役割

- Web App の `doGet` `doPost`
- action ベースの API 入口
- Membership 解決
- Tenant 境界チェック
- Session 取得 / 生成
- 自動採点
- Spreadsheet 保存

## ディレクトリ

- `src/entry`
  GAS公開入口
- `src/router`
  action 振り分け
- `src/usecase`
  ユースケース
- `src/domain`
  enum、判定ポリシー
- `src/infra`
  Spreadsheet、Properties、LockService
- `src/presenter`
  JSON応答
- `src/setup`
  シート初期化

## 運用前提

- Apps Script エディタを正本にしない
- `appsscript.json` を含めてリポジトリ管理する
- Script ID や Spreadsheet ID はコードへ直書きしない
- `Script Properties` を設定値の正本にする

## clasp 導線

初回はこのディレクトリで `clasp create --type standalone --title "LearningPlatform MVP" --rootDir .` を実行し、生成された `.clasp.json` を接続ファイルとして使う。

承認や認証の都合ですぐ create できない場合は、`.clasp.json.example` を `.clasp.json` にコピーして `scriptId` を入れてもよい。

主なコマンド:

- `clasp push`
- `clasp deploy`
- `clasp open`

`SPREADSHEET_ID` や `DEFAULT_TENANT_ID` などの設定値は、push 後に Script Properties へ設定する。
雛形は `script-properties.example.json` を参照する。

## 初回セットアップ

初回は次の順で進めると、`health` と `getMe` までの動作を確認しやすい。

1. `Script Properties` に `script-properties.example.json` 相当の値を設定する
2. `setupLearningPlatformSheets()` を実行してシートを作る
3. `seedLearningPlatformMvp()` を実行して最小 seed を投入する
4. まとめて実行したい場合は `initializeLearningPlatformMvp()` を実行する
5. `action=health` と `action=getMe&tenantId=<DEFAULT_TENANT_ID>` を確認する

補助関数:

- `setupLearningPlatformScriptProperties()`
  開発用の初期プロパティをまとめて入れる
- `setupLearningPlatformSheets()`
  MVPで使う主要シートを作る
- `seedLearningPlatformMvp()`
  `tenants` `users` `memberships` `feature_entitlements` に最小 seed を投入する
- `initializeLearningPlatformMvp()`
  シート作成と seed 投入をまとめて行う

確認用 action:

- `action=health`
  GAS Web App の疎通確認
- `action=getSetupStatus`
  初期化状態、シート件数、`DEFAULT_TENANT_ID` 解決状態の確認
- `action=getMe&tenantId=<DEFAULT_TENANT_ID>`
  初期 seed での最小取得確認
