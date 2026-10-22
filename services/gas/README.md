# services/gas

LearningPlatform MVP のバックエンド実装本体です。

この配下は `clasp` で管理する Google Apps Script 用ソースを置きます。

## 役割

- Web App の `doGet` `doPost`
- action ベースの API 入口
- LINE webhook の受信と reply
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

## LINE webhook

`doPost` は次の 2 系統を受ける。

- LIFF / GitHub Pages からの `action` ベース API
- LINE Messaging API からの webhook event

LINE webhook の場合は `events` 配列を検出して自動で webhook 処理へ分岐し、reply API に対して最小の Flex とテキストを返す。

必要な Script Properties:

- `LINE_CHANNEL_ACCESS_TOKEN`
- `LIFF_ID`
- `APP_BASE_URL`

返事は1通のカードにまとめ、次の操作をクイックリプライで出す（「5問」「記録」「ヘルプ」「導入相談」）。

- `SYSTEM_ADMIN_LINE_USER_ID` の人にだけ、「管理」と送ったときに学習者の一覧（`APP_BASE_URL` の `admin.html`）への案内と、クイックリプライの「📊 学習者の一覧」を出す。ほかの人には出さない
- カードを LINE が受けつけなかったときは、同じ中身を文字だけで返す。原因は Script Properties の `LAST_LINE_ERRORS`（新しい順に5件）に残る

## テスト

ボットの返事の形（1通のカード・クイックリプライの数と長さ・管理者だけの案内・文字だけの返事）を、GAS の外で確かめる。

```bash
node --test services/gas/test
```

`src` の中身を全部つなげて、偽物の `PropertiesService`・`UrlFetchApp` の上で動かす。画面（`docs`）と LINE アプリの中の動きは、手で確かめる。

