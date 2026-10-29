// 大事な流れ：答えの二重送信・提出コード・成績の集計・2つの教室・今日の回の問題・管理 API の端の場合。
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

const A = "tenant_a";
const B = "tenant_b";

// ID トークンは「token:<LINE のユーザー ID>」。偽物の LINE がその人だと答える
function make({ questions } = {}) {
  const gas = createGas({
    dir: path.join(__dirname, "../src"),
    properties: { SPREADSHEET_ID: "SPREADSHEET_TEST", LIFF_ID: "2011071914-test", LINE_CHANNEL_ACCESS_TOKEN: "t", DEFAULT_TENANT_ID: A },
    fetch: (url, opt) => {
      if (!/oauth2\/v2\.1\/verify/.test(url)) return undefined;
      const m = String((opt.payload && opt.payload.id_token) || "").match(/^token:(U\w+)$/);
      return m ? response(200, { sub: m[1], name: "なまえ" }) : response(400, { error: "invalid_request" });
    }
  });
  gas.call("setupLearningPlatformSheets");
  const add = (sheet, record) => {
    const sh = gas.sheet(sheet);
    sh.rows.push(sh.rows[0].map((h) => (record[h] === undefined ? "" : record[h])));
  };
  add("tenants", { tenant_id: A, name: "A 教室" });
  add("tenants", { tenant_id: B, name: "B 教室" });
  [["user_both", "Uboth"], ["user_admin", "Uadmin"], ["user_other", "Uother"]].forEach(([id, line]) => add("users", { user_id: id, line_user_id: line, display_name: id, status: "ACTIVE" }));
  [["m_both_a", A, "user_both", "LEARNER"], ["m_both_b", B, "user_both", "LEARNER"], ["m_admin", A, "user_admin", "admin"], ["m_other", A, "user_other", "LEARNER"]]
    .forEach(([id, tenant, user, role]) => add("memberships", { membership_id: id, tenant_id: tenant, user_id: user, role, status: "ACTIVE" }));
  (questions || [
    ["a1", A, "ACTIVE", { exact: "x" }], ["a2", A, "ACTIVE", { exact: "y" }], ["a3", A, "INACTIVE", { exact: "z" }],
    ["b1", B, "ACTIVE", { exact: "b" }]
  ]).forEach(([id, tenant, status, answer]) => {
    add("questions", { question_id: id, tenant_id: tenant, course_id: "c_" + tenant, question_type: "TEXT_EXACT", question_text: id, status });
    add("question_grading_configs", { question_id: id, tenant_id: tenant, correct_answer_payload: JSON.stringify(answer), max_score: 1 });
  });
  gas.reset();
  gas.add = add;
  return gas;
}

const call = (gas, who, action, body = {}) => gas.doPost(Object.assign({ action, lineIdToken: "token:" + who }, body));
const code = (res) => (res && res.error ? res.error.code : "ok");
const answer = (gas, who, session, index, value, key) =>
  call(gas, who, "createAnswerEvent", { tenantId: session.tenantId, learningSessionId: session.sessionId, sessionQuestionId: session.questions[index].sessionQuestionId, idempotencyKey: key, answerPayload: { value } });
const today = (gas, who, tenantId) => Object.assign(call(gas, who, "resolveDailySession", { tenantId }).session, { tenantId });

// ---- 答え ----

t("同じ答えを2回送っても（つながりなおし）、1つだけ残る", () => {
  const gas = make();
  const s = today(gas, "Uboth");
  const first = answer(gas, "Uboth", s, 0, "x", "k1");
  const again = answer(gas, "Uboth", s, 0, "x", "k1");
  assert.equal(first.duplicated, false);
  assert.equal(again.duplicated, true);
  assert.equal(again.answerEventId, first.answerEventId);
  assert.equal(gas.rows("answer_events").length, 2, "見出し＋1行");
});

t("答えの回・問題・鍵がないときは断る", () => {
  const gas = make();
  const s = today(gas, "Uboth");
  for (const body of [{}, { learningSessionId: s.sessionId }, { learningSessionId: s.sessionId, sessionQuestionId: s.questions[0].sessionQuestionId }]) {
    assert.equal(code(call(gas, "Uboth", "createAnswerEvent", body)), "missing_field", JSON.stringify(body));
  }
  assert.equal(code(call(gas, "Uboth", "createAnswerEvent", { learningSessionId: "bad id!", sessionQuestionId: "x", idempotencyKey: "k" })), "missing_field", "ID の形でないものは使わない");
});

// ---- 今日の回 ----

t("今日の回の問題は、その教室の使える（ACTIVE）問題だけ・5問まで", () => {
  const many = Array.from({ length: 7 }, (_, i) => ["q" + i, A, "ACTIVE", { exact: "x" }]).concat([["qoff", A, "INACTIVE", { exact: "x" }], ["qb", B, "ACTIVE", { exact: "x" }]]);
  const gas = make({ questions: many });
  const s = today(gas, "Uboth");
  assert.equal(s.questions.length, 5);
  assert.equal(s.questionCount, 5);
  for (const q of s.questions) assert.match(q.questionId, /^q\d$/, "ほかの教室・使えない問題は出ない");
});

t("今日の回の問題は、シートの行の並びが変わっても出す順（display_order）で返す", () => {
  const gas = make();
  const s = today(gas, "Uboth");
  const ids = s.questions.map((q) => q.sessionQuestionId);
  // シートで行を並べかえた（下から上へ）
  const rows = gas.sheet("session_questions").rows;
  const body = rows.splice(1);
  rows.push(...body.reverse());
  gas.reset();
  const again = call(gas, "Uboth", "getHome").todaySession;
  assert.deepEqual(again.questions.map((q) => q.sessionQuestionId), ids);
  assert.deepEqual(again.questions.map((q) => q.displayOrder), [1, 2]);
});

t("教室に使える問題がないときは questions_not_found で断る（回は作らない）", () => {
  const gas = make({ questions: [["off", A, "INACTIVE", { exact: "x" }]] });
  assert.equal(code(call(gas, "Uboth", "resolveDailySession")), "questions_not_found");
  assert.equal(gas.rows("learning_sessions").length, 1, "見出しだけ");
});

// ---- 2つの教室 ----

t("2つの教室に入っている人は、教室ごとに別の今日の回と成績になる", () => {
  const gas = make();
  const sa = today(gas, "Uboth", A);
  const sb = today(gas, "Uboth", B);
  assert.notEqual(sa.sessionId, sb.sessionId);
  assert.deepEqual(sb.questions.map((q) => q.questionId), ["b1"]);
  answer(gas, "Uboth", sa, 0, "x", "ka");
  const homeB = call(gas, "Uboth", "getHome", { tenantId: B });
  assert.equal(homeB.todayAnswerEvents.length, 0, "A の答えは B に出ない");
  assert.equal(homeB.learningSummary.totalAnsweredCount, 0);
  // A の回に、B の教室として答えを送っても使えない
  assert.equal(code(answer(gas, "Uboth", Object.assign({}, sa, { tenantId: B }), 1, "y", "kb")), "learning_session_not_found");
});

// ---- 成績の集計 ----

t("ホームの成績：答えた数・正答率・さいごの時刻", () => {
  const gas = make();
  const s = today(gas, "Uboth");
  answer(gas, "Uboth", s, 0, "x", "k1");
  answer(gas, "Uboth", s, 1, "wrong", "k2");
  const home = call(gas, "Uboth", "getHome");
  assert.equal(home.learningSummary.totalAnsweredCount, 2);
  assert.equal(home.learningSummary.accuracyRate, 0.5);
  assert.ok(home.learningSummary.lastLearnedAt);
  assert.equal(home.todaySession.status, "COMPLETED");
  assert.equal(home.resumableSession, null);
});

t("管理の一覧：人ごとの答えた数と正答率。ACTIVE でない人は出ない", () => {
  const gas = make();
  const s = today(gas, "Uboth");
  answer(gas, "Uboth", s, 0, "x", "k1");
  answer(gas, "Uboth", s, 1, "wrong", "k2");
  const rows = gas.sheet("memberships").rows;
  rows.find((r) => r[0] === "m_other")[rows[0].indexOf("status")] = "INACTIVE";
  gas.reset();
  const list = call(gas, "Uadmin", "listAdminLearners").learners;
  assert.deepEqual(list.map((l) => l.membershipId).sort(), ["m_admin", "m_both_a"]);
  const both = list.find((l) => l.membershipId === "m_both_a");
  assert.equal(both.totalAnsweredCount, 2);
  assert.equal(both.accuracyRate, 0.5);
  assert.equal(list.find((l) => l.membershipId === "m_admin").lastLearnedAt, null);
});

// ---- 提出コード ----

t("提出コード：形は LPR-＋6文字。2回目は同じコード。同じ問題は、さいごの答えで数える", () => {
  const gas = make();
  const s = today(gas, "Uboth");
  answer(gas, "Uboth", s, 0, "wrong", "k1");
  answer(gas, "Uboth", s, 0, "x", "k1-again");
  answer(gas, "Uboth", s, 1, "y", "k2");
  const first = call(gas, "Uboth", "createShareReceipt", { learningSessionId: s.sessionId }).receipt;
  assert.match(first.receiptCode, /^LPR-[A-HJ-NP-Z2-9]{6}$/);
  assert.equal(first.totalQuestions, 2);
  assert.equal(first.correctCount, 2);
  assert.equal(first.accuracyRate, 100);
  const again = call(gas, "Uboth", "createShareReceipt", { learningSessionId: s.sessionId });
  assert.equal(again.duplicated, true);
  assert.equal(again.receipt.receiptCode, first.receiptCode);
  assert.equal(gas.rows("share_receipts").length, 2, "見出し＋1行");
});

// ---- 管理 API ----

t("管理：役割は大文字小文字を問わない（admin でも管理者）。membershipId がないときは断る", () => {
  const gas = make();
  assert.ok(Array.isArray(call(gas, "Uadmin", "listAdminLearners").learners));
  assert.equal(code(call(gas, "Uadmin", "getAdminLearnerDetail")), "missing_membership_id");
  assert.equal(code(call(gas, "Uadmin", "getAdminLearnerDetail", { membershipId: "m_both_b" })), "membership_not_found", "ほかの教室の立場");
  assert.equal(code(call(gas, "Uadmin", "getAdminLearnerDetail", { membershipId: "nope" })), "membership_not_found");
});

t("管理：B の学習者は、A の管理者でも学習者でもないので、どちらの教室も見られない", () => {
  const gas = make();
  for (const tenantId of [A, B]) {
    assert.equal(code(call(gas, "Uboth", "listAdminLearners", { tenantId })), "admin_only", tenantId);
  }
  assert.equal(code(call(gas, "Uadmin", "listAdminLearners", { tenantId: "tenant_none" })), "tenant_not_found");
});
