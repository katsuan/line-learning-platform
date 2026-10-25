/**
 * 人が GAS エディタから実行する関数（Learning Platform）。ここだけ見ればよいように、いちばん上に置く。
 * 上の関数の欄でえらんで「実行」する。結果は実行ログに出る。ボットや画面の動きの中からは呼ばれない。
 * 本番の Web アプリは、別のプロジェクトがこのプロジェクトをライブラリとして読んでいるので、関数の名前は変えない。
 *
 * どの順に何を実行するか
 *   ふだん（直したあと・おかしいとき）
 *     1. checkAll … 自己点検。設定・シート・LINE・カード・トリガーのようすを ✅⚠️❌ で出す（何も書かない）
 *        トークでは、管理者が「#テスト」と送ると、同じ点検と返事の見本を試せる
 *   はじめて使うとき（一度だけ）
 *     1. setupLearningPlatformScriptProperties … 見本の設定を Script Properties に入れる（あとで本物の値に直す）
 *     2. initializeLearningPlatformMvp … シートを作り、見本の教室・問題を入れる（＝ 3 と 4 をまとめて）
 *     3. setupLearningPlatformSheets … シートがなければ作る（シートを手で消したときにも）
 *     4. seedLearningPlatformMvp … 見本の教室・問題を入れる。⚠️ 学習の記録（回・答え・提出コード）を全部消すので、本番では実行しない
 *     5. installDebugLogCleanupTrigger … debug_logs の古い行を毎日消すトリガーを作る
 *   LINE のつながりを確かめるとき
 *     inspectLearningPlatformLineSetup（見るだけ）→ authorizeLearningPlatformLineMessaging（外への通信を許す）
 *     → pushSystemAdminLineTestMessage（システム管理者に試しの1通を送る）。まとめては authorizeAndPushSystemAdminLineTestMessage
 *   めったに使わない
 *     purgeLegacyDebugLogs … 前の形の debug_logs（LINE の ID・送られた文がそのまま）を消す。一度だけ
 *
 * 人が書きかえる設定は、コードではなく Script Properties（見本は script-properties.example.json）。
 * 何を自己点検するか → 01_selfcheck_config.js。
 */

// 自己点検（selfcheck.js の qCheckAll）。直したあと・おかしいときに実行する。何も書かず、結果を実行ログに出す
function checkAll() {
  return qCheckAll();
}

// はじめに一度：見本の設定を Script Properties に入れる。入れたあと、本物の値（URL・LIFF ID・管理者など）に直す
function setupLearningPlatformScriptProperties() {
  return setDefaultScriptProperties_();
}

// はじめに一度：シートを作り（setupLearningPlatformSheets）、見本の教室・問題を入れる（seedLearningPlatformMvp）
function initializeLearningPlatformMvp() {
  setupLearningPlatformSheets();
  var result = seedLearningPlatformMvp();

  return {
    ok: true,
    message: "Spreadsheet schema and MVP seed data were initialized.",
    result: result
  };
}

// シートがなければ作り、見出しを入れる。あるシートの中身は変えない。シートを手で消したときにも実行する
function setupLearningPlatformSheets() {
  return ensureLearningPlatformSheets_();
}

// 見本の教室・学習者・問題を入れる。⚠️ 教室・学習者・問題を入れなおし、学習の記録（回・答え・提出コード）を全部消す。本番では実行しない
function seedLearningPlatformMvp() {
  return seedLearningPlatformMvp_();
}

// はじめに一度：debug_logs の古い行を毎日 4 時ごろに消すトリガーを作る（何度実行しても1つだけ）
function installDebugLogCleanupTrigger() {
  return DebugLogCleanup.installTrigger();
}

// LINE のつながりの設定を見る（何も変えない）。鍵は頭と終わりだけ出す
function inspectLearningPlatformLineSetup() {
  return inspectLineSetup_();
}

// 外への通信（UrlFetchApp）を許すために実行する。許可の画面が出たら許す
function authorizeLearningPlatformExternalRequest() {
  return authorizeExternalRequest_();
}

// LINE の設定を見て、外への通信を許す（inspectLearningPlatformLineSetup と authorizeLearningPlatformExternalRequest をまとめて）
function authorizeLearningPlatformLineMessaging() {
  return authorizeLineMessaging_();
}

// システム管理者（SYSTEM_ADMIN_LINE_USER_ID）に、試しの1通を push で送る。LINE の鍵が使えるか確かめるとき
function pushSystemAdminLineTestMessage() {
  return pushSystemAdminTestMessage_();
}

// 外への通信を許してから、システム管理者に試しの1通を送る（2つをまとめて）
function authorizeAndPushSystemAdminLineTestMessage() {
  return authorizeAndPushSystemAdminTestMessage_();
}

// 一度だけ：前の形の debug_logs の行（LINE のユーザー ID・送られた文がそのまま）を消し、消した行の数を返す
function purgeLegacyDebugLogs() {
  return DebugLogCleanup.deleteLegacy();
}
