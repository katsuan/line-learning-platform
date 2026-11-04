// はじめの準備（09_setup）：見本の設定・シート・見本の教室と問題。人が GAS エディタから実行する関数を、そのまま動かして確かめる。
// 動かし方：node --test services/gas/test
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const FAKE_GAS = path.join(__dirname, "../../../../q-oqrn/tools/qtest/fake-gas.js");
const HAS_FAKE_GAS = fs.existsSync(FAKE_GAS);
const { createGas, response } = HAS_FAKE_GAS ? require(FAKE_GAS) : {};
const t = HAS_FAKE_GAS ? test : test.skip;

function make(properties) {
  return createGas({
    dir: path.join(__dirname, "../src"),
    properties: Object.assign({ SPREADSHEET_ID: "SPREADSHEET_TEST", LIFF_ID: "2011071914-test", LINE_CHANNEL_ACCESS_TOKEN: "t" }, properties),
    fetch: (url, opt) => {
      if (!/oauth2\/v2\.1\/verify/.test(url)) return undefined;
      const m = String((opt.payload && opt.payload.id_token) || "").match(/^token:(U\w+)$/);
      return m ? response(200, { sub: m[1], name: "なまえ" }) : response(400, { error: "invalid_request" });
    }
  });
}

t("見本の設定は、まだない設定だけ入れる（本物の値に直したあとで、もう一度実行しても消さない）", () => {
  const gas = make({ APP_BASE_URL: "https://katsuan.github.io/line-learning-platform/", SYSTEM_ADMIN_LINE_USER_ID: "Ureal", DEFAULT_LINE_USER_ID: "" });
  const result = gas.call("setupLearningPlatformScriptProperties");
  assert.equal(gas.properties.APP_BASE_URL, "https://katsuan.github.io/line-learning-platform/");
  assert.equal(gas.properties.SYSTEM_ADMIN_LINE_USER_ID, "Ureal");
  assert.equal(gas.properties.DEFAULT_TENANT_ID, "tenant_demo_001", "なかった設定は入る");
  assert.ok(result.kept.includes("APP_BASE_URL"));
  gas.call("setupLearningPlatformScriptProperties");
  assert.equal(gas.properties.SYSTEM_ADMIN_LINE_USER_ID, "Ureal", "2回目でも同じ");
});

t("はじめの準備（initializeLearningPlatformMvp）のあと、見本の学習者が今日の5問を解いて全問正解できる", () => {
  const gas = make({ DEFAULT_LINE_USER_ID: "Udemo" });
  gas.call("setupLearningPlatformScriptProperties");
  const init = gas.call("initializeLearningPlatformMvp");
  assert.equal(init.ok, true);
  assert.equal(gas.rows("questions").length - 1, 30, "見本の問題は 30 問");
  assert.equal(gas.rows("question_grading_configs").length - 1, 30, "どの問題にも正解の設定");
  gas.reset();

  const session = gas.doPost({ action: "resolveDailySession", lineIdToken: "token:Udemo" }).session;
  assert.equal(session.questions.length, 5);
  const trial = gas.ctx.TRIAL_QUESTIONS;
  session.questions.forEach((q, i) => {
    const answer = trial.find((d) => d.id === q.questionId).answer;
    const res = gas.doPost({ action: "createAnswerEvent", lineIdToken: "token:Udemo", learningSessionId: session.sessionId, sessionQuestionId: q.sessionQuestionId, idempotencyKey: "k" + i, answerPayload: { value: answer } });
    assert.equal(res.isCorrect, true, q.questionId);
  });
  const home = gas.doPost({ action: "getHome", lineIdToken: "token:Udemo" });
  assert.equal(home.learningSummary.totalAnsweredCount, 5);
  assert.equal(home.learningSummary.accuracyRate, 1);
});

t("見本を入れなおすと、学習の記録（回・答え・提出コード）は消え、シートの見出しは残る", () => {
  const gas = make({ DEFAULT_LINE_USER_ID: "Udemo" });
  gas.call("setupLearningPlatformScriptProperties");
  gas.call("initializeLearningPlatformMvp");
  gas.reset();
  gas.doPost({ action: "resolveDailySession", lineIdToken: "token:Udemo" });
  assert.equal(gas.rows("learning_sessions").length, 2);
  gas.call("seedLearningPlatformMvp");
  gas.reset();
  assert.equal(gas.doPost({ action: "getHome", lineIdToken: "token:Udemo" }).todaySession, null, "今日の回もなくなる");
  for (const name of ["learning_sessions", "session_questions", "answer_events", "share_receipts"]) {
    // 本物のシートと同じく、中身を消した行は空の行として残る。中身のある行がないことを見る
    const filled = gas.rows(name).slice(1).filter((row) => row.some((cell) => cell !== ""));
    assert.deepEqual(filled, [], name + " に記録が残っていない");
  }
});
