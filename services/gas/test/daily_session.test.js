// 今日の回の作り方・日付・LINE の知らせの受け方。
// q-oqrn の tools/qtest/fake-gas.js（GAS の偽物）の上で、src をそのまま動かして確かめる。
// 動かし方：node --test services/gas/test
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const FAKE_GAS = path.join(__dirname, "../../../../q-oqrn/tools/qtest/fake-gas.js");
const HAS_FAKE_GAS = fs.existsSync(FAKE_GAS);
const { createGas, response } = HAS_FAKE_GAS ? require(FAKE_GAS) : {};
const t = HAS_FAKE_GAS ? test : test.skip;

const TENANT = "tenant_demo_001";
const TODAY = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const YESTERDAY = new Date(Date.now() + 9 * 3600e3 - 24 * 3600e3).toISOString().slice(0, 10);
// 本物のシートは "2026-10-23" を書くと日付に変える。読むと、その日の 0 時（日本）の Date で返ってくる
const asSheetDate = (ymd) => new Date(ymd + "T00:00:00+09:00");

function make({ fetch, props } = {}) {
  const gas = createGas({
    dir: path.join(__dirname, "../src"),
    properties: Object.assign({
      SPREADSHEET_ID: "SPREADSHEET_TEST",
      LIFF_ID: "2011071914-test",
      LINE_CHANNEL_ACCESS_TOKEN: "test-token",
      DEFAULT_TENANT_ID: TENANT,
      SYSTEM_ADMIN_LINE_USER_ID: "Uadmin"
    }, props || {}),
    fetch: (url, opt) => {
      if (/oauth2\/v2\.1\/verify/.test(url)) {
        const m = String((opt.payload && opt.payload.id_token) || "").match(/^token:(U\w+)$/);
        return m ? response(200, { sub: m[1], name: "なまえ" }) : response(400, { error: "invalid_request" });
      }
      return fetch ? fetch(url, opt) : undefined;
    }
  });
  gas.call("setupLearningPlatformSheets");
  const add = (sheet, record) => {
    const sh = gas.sheet(sheet);
    sh.rows.push(sh.rows[0].map((h) => (record[h] === undefined ? "" : record[h])));
  };
  add("tenants", { tenant_id: TENANT, name: "A 教室" });
  ["q1", "q2"].forEach((id) => {
    add("questions", { question_id: id, tenant_id: TENANT, course_id: "c1", question_type: "TEXT_EXACT", question_text: id, status: "ACTIVE" });
    add("question_grading_configs", { question_id: id, tenant_id: TENANT, correct_answer_payload: JSON.stringify({ exact: "a" }), max_score: 1 });
  });
  gas.reset();
  return gas;
}

const call = (gas, action, body = {}) => gas.doPost(Object.assign({ action, lineIdToken: "token:Ulearner" }, body));
const col = (gas, sheet, name) => gas.rows(sheet)[0].indexOf(name);

// シートに書いた business_date を、本物のシートと同じく日付（Date）に変える
function turnDatesIntoSheetDates(gas) {
  const rows = gas.sheet("learning_sessions").rows;
  const i = rows[0].indexOf("business_date");
  rows.slice(1).forEach((row) => {
    if (typeof row[i] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row[i])) row[i] = asSheetDate(row[i]);
  });
}

t("シートで日付に変わっていても、今日の回は作りなおさない（答えた分もホームに出る）", () => {
  const gas = make();
  const first = call(gas, "bootstrapLearning");
  assert.equal(first.reused, false);
  const session = first.session;
  call(gas, "createAnswerEvent", { learningSessionId: session.sessionId, sessionQuestionId: session.questions[0].sessionQuestionId, idempotencyKey: "k1", answerPayload: { value: "a" } });
  turnDatesIntoSheetDates(gas);

  const again = call(gas, "bootstrapLearning");
  assert.equal(again.reused, true, "同じ日の2回目は、同じ回を使う");
  assert.equal(again.session.sessionId, session.sessionId);
  assert.equal(again.session.businessDate, TODAY, "日付は yyyy-MM-dd で返す");
  assert.equal(again.home.todayAnswerEvents.length, 1);
  assert.equal(again.home.todaySession.sessionId, session.sessionId);
  assert.equal(gas.rows("learning_sessions").length, 2, "回は1つだけ");
});

t("きのうの回は、今日の回にしない（日付またぎ）", () => {
  const gas = make();
  const sh = gas.sheet("learning_sessions");
  sh.rows.push(sh.rows[0].map((h) => ({
    learning_session_id: "session_yesterday", tenant_id: TENANT, user_id: "x", membership_id: "m_none",
    session_type: "DAILY", status: "CREATED", question_count: 2, business_date: asSheetDate(YESTERDAY)
  })[h] || ""));
  const me = call(gas, "getMe");
  sh.rows[sh.rows.length - 1][col(gas, "learning_sessions", "membership_id")] = me.membership.membership_id;

  const res = call(gas, "bootstrapLearning");
  assert.equal(res.reused, false);
  assert.notEqual(res.session.sessionId, "session_yesterday");
  assert.equal(res.session.businessDate, TODAY);
});

t("管理のくわしい記録でも、日付は yyyy-MM-dd で返す", () => {
  const gas = make();
  const me = call(gas, "getMe");
  call(gas, "bootstrapLearning");
  turnDatesIntoSheetDates(gas);
  const detail = call(gas, "getAdminLearnerDetail", { lineIdToken: "token:Uadmin", membershipId: me.membership.membership_id });
  assert.equal(detail.learner.recentSessions[0].businessDate, TODAY);
});

t("LINE の送りなおし（isRedelivery）では、返事が断られても push で重ねて送らない", () => {
  const gas = make({ fetch: (url) => (/message\/reply/.test(url) ? response(400, { message: "Invalid reply token" }) : undefined) });
  gas.lineEvent({ type: "message", replyToken: "r", deliveryContext: { isRedelivery: true }, source: { type: "user", userId: "U1" }, message: { type: "text", text: "5問" } });
  assert.deepEqual(gas.replies().map((r) => r.kind), ["reply"]);
});

t("1つの知らせで失敗しても、同じ便のほかの知らせには返事する", () => {
  const gas = make({ fetch: (url, opt) => (/message\/(reply|push)/.test(url) && /"r-bad"|"Ubad"/.test(String(opt.payload)) ? response(500, { message: "x" }) : undefined) });
  const res = gas.doPost({
    destination: "Ubot",
    events: [
      { type: "message", replyToken: "r-bad", source: { type: "user", userId: "Ubad" }, message: { type: "text", text: "5問" } },
      { type: "message", replyToken: "r-ok", source: { type: "user", userId: "Uok" }, message: { type: "text", text: "5問" } }
    ]
  });
  assert.equal(res.eventCount, 2);
  assert.equal(res.results[1].handled, true);
  assert.equal(res.results[0].handled, false);
});

t("回の進み具合（まだ・とちゅう・おわり）は、答えた数から決める", () => {
  const gas = make();
  const me = call(gas, "getMe");
  const session = call(gas, "bootstrapLearning").session;
  const status = () => call(gas, "getAdminLearnerDetail", { lineIdToken: "token:Uadmin", membershipId: me.membership.membership_id }).learner.recentSessions[0].status;
  assert.equal(status(), "CREATED");
  const answer = (i, key) => call(gas, "createAnswerEvent", { learningSessionId: session.sessionId, sessionQuestionId: session.questions[i].sessionQuestionId, idempotencyKey: key, answerPayload: { value: "a" } });
  answer(0, "k1");
  answer(0, "k1-again"); // 同じ問題に2回答えても、1問と数える
  assert.equal(status(), "IN_PROGRESS");
  assert.equal(call(gas, "getHome").todaySession.completedCount, 1);
  answer(1, "k2");
  assert.equal(status(), "COMPLETED");
  const home = call(gas, "getHome");
  assert.equal(home.todaySession.status, "COMPLETED");
  assert.equal(home.todaySession.completedCount, 2);
  assert.equal(home.resumableSession, null, "おわった回は、続きからの対象にしない");
});
