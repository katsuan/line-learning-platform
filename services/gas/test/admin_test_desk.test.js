// 管理者のテストの窓口（#テスト）。ux.md H11。
// 管理者だけに返る・ふつうの人には知らない言葉と同じ・本物のシートに書かない・reply だけで返す。
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
const SYSTEM_ADMIN = "Usystemadmin";
const REAL_SHEETS = ["users", "memberships", "learning_sessions", "session_questions", "answer_events", "share_receipts"];

function make({ fetch } = {}) {
  const gas = createGas({
    dir: path.join(__dirname, "../src"),
    properties: {
      SPREADSHEET_ID: "SPREADSHEET_TEST",
      LIFF_ID: "2011071914-test",
      LINE_CHANNEL_ACCESS_TOKEN: "test-token",
      APP_BASE_URL: "https://katsuan.github.io/line-learning-platform/",
      DEFAULT_TENANT_ID: TENANT,
      SYSTEM_ADMIN_LINE_USER_ID: SYSTEM_ADMIN
    },
    fetch
  });
  gas.call("setupLearningPlatformSheets");
  const add = (sheet, record) => {
    const sh = gas.sheet(sheet);
    sh.rows.push(sh.rows[0].map((h) => (record[h] === undefined ? "" : record[h])));
  };
  add("tenants", { tenant_id: TENANT, name: "A 教室" });
  add("users", { user_id: "user_teacher", line_user_id: "Uteacher", display_name: "先生", status: "ACTIVE" });
  add("users", { user_id: "user_l1", line_user_id: "Ulearner1", display_name: "学習者1", status: "ACTIVE" });
  add("memberships", { membership_id: "m_teacher", tenant_id: TENANT, user_id: "user_teacher", role: "ADMIN", status: "ACTIVE" });
  add("memberships", { membership_id: "m_l1", tenant_id: TENANT, user_id: "user_l1", role: "LEARNER", status: "ACTIVE" });
  gas.reset();
  return gas;
}

const say = (gas, userId, text) =>
  gas.lineEvent({ type: "message", replyToken: "r-" + Math.random(), source: { type: "user", userId }, message: { type: "text", text } });

const snapshot = (gas) => JSON.stringify(REAL_SHEETS.map((name) => gas.rows(name)));
const quickTexts = (message) => (message.quickReply ? message.quickReply.items.map((i) => i.action.text) : []);

t("管理者が「#テスト」「#test」と送ると、🧪 テストのカードが返る（システム管理者も教室の管理者も）", () => {
  const gas = make();
  for (const [userId, text] of [[SYSTEM_ADMIN, "#テスト"], [SYSTEM_ADMIN, "#test"], ["Uteacher", "＃テスト"], ["Uteacher", "#TEST"]]) {
    gas.reset();
    say(gas, userId, text);
    const sent = gas.replies();
    assert.deepEqual(sent.map((r) => r.kind), ["reply"], `${userId}「${text}」`);
    const card = sent[0].messages[0];
    assert.equal(card.type, "flex");
    assert.match(card.altText, /🧪/);
    assert.match(JSON.stringify(card.contents), /🧪/);
    const texts = quickTexts(card);
    for (const want of ["#テスト 見本", "#テスト 点検", "#テスト 文"]) assert.ok(texts.includes(want), want);
  }
  assert.deepEqual(gas.flexProblems().filter((p) => p.level === "error"), []);
});

t("ふつうの人が送っても、知らない言葉と同じ（返事しない。窓口があることを見せない）", () => {
  const gas = make();
  for (const text of ["#テスト", "#test", "#テスト 見本", "#テスト 点検", "#テスト 文"]) {
    say(gas, "Ulearner1", text);
    say(gas, "Unewcomer", text);
  }
  assert.equal(gas.replies().length, 0);
});

t("返事の見本：全部の返事を1つの横並びのカードで（どれも 🧪・大きさがそろう・ためしの数字）", () => {
  const gas = make();
  say(gas, SYSTEM_ADMIN, "#テスト 見本");
  const sent = gas.replies();
  assert.deepEqual(sent.map((r) => r.kind), ["reply"]);
  const message = sent[0].messages[0];
  assert.equal(message.contents.type, "carousel");
  const bubbles = message.contents.contents;
  assert.ok(bubbles.length >= 8 && bubbles.length <= 12, `枚数 ${bubbles.length}`);
  for (const bubble of bubbles) assert.match(JSON.stringify(bubble.header), /🧪/);
  const all = JSON.stringify(bubbles);
  for (const word of ["今日の5問を解こう", "まだ", "とちゅう", "おわり", "はじめての方へ", "導入の相談", "友だち追加", "学習者の進み具合"]) {
    assert.ok(all.includes(word), word);
  }
  assert.match(all, /3 \/ 5問/, "ためしの数字");
  assert.ok(quickTexts(message).includes("#テスト"), "窓口に戻れる");
  assert.deepEqual(gas.flexProblems().filter((p) => p.level === "error"), []);
});

t("カードが断られたときの文の返事を、reply で見せる", () => {
  const gas = make();
  say(gas, SYSTEM_ADMIN, "#テスト 文");
  const sent = gas.replies();
  assert.deepEqual(sent.map((r) => r.kind), ["reply"]);
  const message = sent[0].messages[0];
  assert.equal(message.type, "text");
  assert.match(message.text, /^🧪/);
  assert.match(message.text, /https:\/\/liff\.line\.me\//);
  assert.ok(quickTexts(message).includes("#テスト"));
});

t("自己点検：結果を 🧪 のカードで返す", () => {
  const gas = make();
  say(gas, SYSTEM_ADMIN, "#テスト 点検");
  const sent = gas.replies();
  assert.deepEqual(sent.map((r) => r.kind), ["reply"]);
  const message = sent[0].messages[0];
  assert.equal(message.type, "flex");
  assert.match(message.altText, /🧪/);
  assert.match(JSON.stringify(message.contents), /[✅⚠️❌]/u);
  assert.deepEqual(gas.flexProblems().filter((p) => p.level === "error"), []);
});

t("窓口のどれを押しても、本物のシートに書かない・push しない", () => {
  const gas = make();
  const before = snapshot(gas);
  for (const text of ["#テスト", "#テスト 見本", "#テスト 点検", "#テスト 文", "#テスト なにか"]) say(gas, SYSTEM_ADMIN, text);
  assert.equal(snapshot(gas), before);
  assert.ok(gas.replies().every((r) => r.kind === "reply"));
  assert.ok(gas.replies().length >= 5, "知らない窓口の言葉にも、窓口のカードで返す");
});

t("窓口の返事が断られても、push で返しなおさない（reply だけ）", () => {
  const gas = make({ fetch: (url) => (/message\/reply/.test(url) ? response(400, { message: "invalid" }) : undefined) });
  say(gas, SYSTEM_ADMIN, "#テスト 見本");
  assert.deepEqual(gas.replies().map((r) => r.kind), ["reply"]);
  assert.match(gas.properties.LAST_LINE_ERRORS, /invalid/);
});
