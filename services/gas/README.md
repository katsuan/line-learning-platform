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
5. `action=health` と `action=getSetupStatus` を確認する
6. 下の「使う前の確かめ」で `qCheckAll` を動かす

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
  準備ができているか（`DEFAULT_TENANT_ID` の教室と問題があるか）だけを返す
- `action=getMe`
  LINE でログインした本人の情報（LIFF の画面から、ID トークンを付けて呼ぶ）

## だれが何をできるか

- だれでも：`health`・`getSetupStatus`（個人の情報は返さない）
- 学習者：`getMe`・`getHome`・`bootstrapLearning`・`resolveDailySession`・`createAnswerEvent`・`createShareReceipt`。LINE の ID トークン（`lineIdToken`）を LINE に確かめた本人として動く。自分の回・自分の答えだけ。正誤と点数はサーバーで決める
  - 初めての人は、ふだんの教室（`DEFAULT_TENANT_ID`）に学習者として入る。ほかの教室は、`memberships` にいる人だけ
- 管理者：`listAdminLearners`・`getAdminLearnerDetail`。`SYSTEM_ADMIN_LINE_USER_ID` の人か、その教室で役割が ADMIN / OWNER の人
- LINE の Webhook：Script Properties に `WEBHOOK_KEY` を入れ、LINE Developers の Webhook の URL の終わりに `?key=<同じ値>` を付けると、合言葉が合わない知らせには何もしない

シートに書く文字は、すべて `safeCell()`（`src/setup/selfcheck.js`）を通す。`debug_logs` の LINE のユーザー ID は、SHA-256 の頭だけを残す。

## 使う前の確かめ

`clasp push` のあとや、Script Properties・シートを変えたあとは、GAS エディタで `qCheckAll` を実行し、実行ログを見る（✅ だいじょうぶ／⚠️ 見てほしい／❌ 直す）。

- 確かめること（`src/setup/self_check_config.js` の `Q_SELF_CHECK`）：要る Script Properties があるか・鍵がコードに書かれていないか・シートと見出し・シートに外につながる式がないか・LINE の鍵と Webhook・ボットの返事のカードが LINE に受けつけられる形か
- 何も書きこまず、LINE にも送らない（カードは LINE の「確かめるだけ」の API に渡す）
- `src/setup/selfcheck.js` は、q-oqrn の `tools/qtest/selfcheck.gs` を写したもの

## debug_logs の古い行を消す

`debug_logs` は、`DEBUG_LOG_KEEP_DAYS`（Script Properties。なければ 30）日より古い行を、毎日1回消す。どれもこのリポジトリの GAS（ライブラリのほう）のエディタで動かす。

- `installDebugLogCleanupTrigger`：毎日 4 時ごろに `cleanupOldDebugLogs` が動くトリガーを作る。**最初に GAS エディタで一度動かす**（何度動かしても1つだけ）
- `cleanupOldDebugLogs`：古い行を消す（トリガーで動く）。動いた時刻を残すので、`qCheckAll` で 26 時間以内に動いたかを見られる
- `purgeLegacyDebugLogs`：LINE のユーザー ID や送られた文がそのまま入った、前の形の行を消す。一度だけ動かす。消した行の数が実行ログに出る

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
- カードを LINE が受けつけなかったときは、同じ中身を文字だけで送りなおす（返事の合図は1回しか使えないので push で。1回の操作につき1回だけ）。原因は Script Properties の `LAST_LINE_ERRORS`（新しい順に5件）に残る
- カードのボタンは、画面（LIFF・管理の画面）を開くものだけ。次の操作はクイックリプライ（押すと言葉が送られ、いつ押されても同じ返事になる）

## テスト

GAS の外で、`src` をそのまま動かして確かめる。

```bash
node --test services/gas/test
```

- `line_webhook.test.js`：ボットの返事の形（1通のカード・クイックリプライの数と長さ・管理者だけの案内・文字だけの返事）
- `admin_access.test.js`：管理の API は、LINE でログインした管理者だけ
- `security.test.js`：すべての action について、本人確認なし・ほかの人・ほかの教室・管理者でない人が断られること（表で確かめる）。外の文字が式のままシートに入らないこと。ボットの返事が LINE に受けつけられる形であること。q-oqrn の `tools/qtest/fake-gas.js`（GAS の偽物）を使うので、q-oqrn をとなりのフォルダに置く（ないときは飛ばす）

危ない書き方は `node ../q-oqrn/tools/qtest/check-code.mjs .` でも探す（リポジトリの一番上で）。

画面（`docs`）と LINE アプリの中の動きは、手で確かめる。

