// ボットの返事の形を、GAS の外（Node）で確かめる。
// 動かし方：node --test services/gas/test
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SRC = path.join(__dirname, "..", "src");
const ADMIN_ID = "Uadmin000000000000000000000000000";

function listJs(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listJs(full);
    return entry.name.endsWith(".js") ? [full] : [];
  }).sort();
}

// GAS の中身を全部つなげて、偽物の PropertiesService・UrlFetchApp の上で動かす
function loadGas({ properties = {}, failFlexOnce = false } = {}) {
  const store = Object.assign({
    LINE_CHANNEL_ACCESS_TOKEN: "token",
    LIFF_ID: "2011071914-4lKlbUGo",
    APP_BASE_URL: "https://katsuan.github.io/LearningPlatform/",
    SYSTEM_ADMIN_LINE_USER_ID: ADMIN_ID
  }, properties);
  const sent = [];
  let propertyReads = 0;
  let failNext = failFlexOnce;
  const context = {
    console,
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key) => {
          propertyReads += 1;
          return store[key] === undefined ? null : store[key];
        },
        getProperties: () => {
          propertyReads += 1;
          return Object.assign({}, store);
        },
        setProperty: (key, value) => {
          store[key] = value;
        },
        setProperties: (values) => Object.assign(store, values)
      })
    },
    UrlFetchApp: {
      fetch: (url, options) => {
        const payload = JSON.parse(options.payload);
        sent.push({ url, payload });
        const hasFlex = (payload.messages || []).some((message) => message.type === "flex");
        if (failNext && hasFlex) {
          failNext = false;
          return { getResponseCode: () => 400, getContentText: () => '{"message":"A message (messages[0]) in the request body is invalid"}' };
        }
        return { getResponseCode: () => 200, getContentText: () => "{}" };
      }
    },
    Utilities: { getUuid: () => "uuid", formatDate: () => "2026-10-23" }
  };
  vm.createContext(context);
  const code = listJs(SRC).map((file) => fs.readFileSync(file, "utf8")).join("\n;\n");
  vm.runInContext(code + "\n;this.__exports = { LineWebhookUsecase, LineMessageBuilder };", context);
  return { ...context.__exports, sent, store, propertyReads: () => propertyReads };
}

function textEvent(text, userId = "Uuser") {
  return { type: "message", replyToken: "r", source: { type: "user", userId }, message: { type: "text", text } };
}

function checkFlexRules(message) {
  // LINE が受けつけない書き方を使っていない（H2）
  const json = JSON.stringify(message.contents);
  assert.ok(!/#[0-9a-f]{8}"/i.test(json), "#RRGGBBAA の色を使わない");
  assert.ok(!/"filler"/.test(json), "filler を使わない");
  assert.ok(!/"contents":\[\]/.test(json), "中身の空の箱を作らない");
  assert.ok(message.altText.length <= 400);
  const buttons = (message.contents.footer && message.contents.footer.contents) || [];
  assert.ok(buttons.length >= 1 && buttons.length <= 2, "行動のボタンは2つまで");
  for (const button of buttons) assert.ok(button.action.label.length <= 40);
}

function checkQuickReply(message) {
  const items = message.quickReply.items;
  assert.ok(items.length >= 1 && items.length <= 13, "クイックリプライは13個まで");
  for (const item of items) assert.ok([...item.action.label].length <= 20, `ラベル20字まで：${item.action.label}`);
  return items.map((item) => item.action.text);
}

test("ふつうの返事は1通のカードで、クイックリプライが付く", () => {
  const gas = loadGas();
  const result = gas.LineWebhookUsecase.handleEvent(textEvent("5問"));
  assert.equal(result.handled, true);
  assert.equal(gas.sent.length, 1);
  const messages = gas.sent[0].payload.messages;
  assert.equal(messages.length, 1);
  assert.equal(messages[0].type, "flex");
  assert.equal(messages[0].fallbackText, undefined, "手元用の項目は LINE に送らない");
  checkFlexRules(messages[0]);
  const texts = checkQuickReply(messages[0]);
  assert.ok(!texts.includes("管理"), "ふつうの人には管理の操作を出さない");
});

test("クイックリプライの言葉は、どれも返事が来る言葉", () => {
  const gas = loadGas();
  gas.LineWebhookUsecase.handleEvent(textEvent("ヘルプ", ADMIN_ID));
  const texts = checkQuickReply(gas.sent[0].payload.messages[0]);
  for (const text of texts) {
    const before = gas.sent.length;
    const result = gas.LineWebhookUsecase.handleEvent(textEvent(text, ADMIN_ID));
    assert.equal(result.handled, true, `「${text}」に返事する`);
    assert.equal(gas.sent.length, before + 1);
  }
});

test("管理の案内は管理者だけ（H8）", () => {
  const gas = loadGas();
  gas.LineWebhookUsecase.handleEvent(textEvent("管理", "Usomeone"));
  const forUser = gas.sent[0].payload.messages[0];
  assert.ok(!JSON.stringify(forUser).includes("admin.html"));
  assert.ok(!JSON.stringify(forUser).includes("管理者"));

  gas.LineWebhookUsecase.handleEvent(textEvent("管理", ADMIN_ID));
  const forAdmin = gas.sent[1].payload.messages[0];
  assert.equal(forAdmin.contents.footer.contents[0].action.uri, "https://katsuan.github.io/LearningPlatform/admin.html");
  assert.ok(checkQuickReply(forAdmin).includes("管理"));
});

test("APP_BASE_URL が見本のままなら、管理の案内は LIFF の入口にする", () => {
  const gas = loadGas({ properties: { APP_BASE_URL: "https://example.github.io/LearningPlatform/" } });
  gas.LineWebhookUsecase.handleEvent(textEvent("管理", ADMIN_ID));
  const uri = gas.sent[0].payload.messages[0].contents.footer.contents[0].action.uri;
  assert.equal(uri, "https://liff.line.me/2011071914-4lKlbUGo?entry=admin");
});

test("友だち追加は1通のカード", () => {
  const gas = loadGas();
  gas.LineWebhookUsecase.handleEvent({ type: "follow", replyToken: "r", source: { userId: "Unew" } });
  const messages = gas.sent[0].payload.messages;
  assert.equal(messages.length, 1);
  checkFlexRules(messages[0]);
  checkQuickReply(messages[0]);
});

test("関係のない言葉には返事しない", () => {
  const gas = loadGas();
  const result = gas.LineWebhookUsecase.handleEvent(textEvent("こんにちは"));
  assert.equal(result.handled, false);
  assert.equal(gas.sent.length, 0);
});

test("カードが通らないときは、文字だけで返して原因を残す（H5）", () => {
  const gas = loadGas({ failFlexOnce: true });
  const result = gas.LineWebhookUsecase.handleEvent(textEvent("5問"));
  assert.equal(result.reason, "text_fallback");
  assert.equal(gas.sent.length, 2);
  // 返事の合図は1回しか使えないので、返しなおしは push
  assert.match(gas.sent[0].url, /message\/reply$/);
  assert.match(gas.sent[1].url, /message\/push$/);
  assert.equal(gas.sent[1].payload.to, textEvent("5問").source.userId);
  const fallback = gas.sent[1].payload.messages[0];
  assert.equal(fallback.type, "text");
  assert.ok(fallback.text.includes("https://liff.line.me/"));
  assert.ok(fallback.quickReply.items.length > 0);
  const errors = JSON.parse(gas.store.LAST_LINE_ERRORS);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].code, "line_reply_failed");
});

test("1回の返事で、設定は1回だけ読む（H9）", () => {
  const gas = loadGas();
  gas.LineWebhookUsecase.handleEvent(textEvent("5問"));
  assert.equal(gas.propertyReads(), 1);
});
