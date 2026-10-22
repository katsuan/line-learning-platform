// debug_logs の古い行を消す仕組み。古い行だけ消える・新しい行と見出しは残る・前の形の行だけ消える・0行でも落ちない。
// q-oqrn の tools/qtest/fake-gas.js（GAS の偽物）を使う。動かし方：node --test services/gas/test
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const FAKE_GAS = path.join(__dirname, "../../../../q-oqrn/tools/qtest/fake-gas.js");
const HAS_FAKE_GAS = fs.existsSync(FAKE_GAS);
const { createGas } = HAS_FAKE_GAS ? require(FAKE_GAS) : {};
const t = HAS_FAKE_GAS ? test : test.skip;

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n) => new Date(Date.now() - n * DAY).toISOString();
const RAW_LINE_ID = "U" + "0123456789abcdef".repeat(2);

function make(props = {}) {
  const gas = createGas({
    dir: path.join(__dirname, "../src"),
    properties: Object.assign({ SPREADSHEET_ID: "SPREADSHEET_TEST" }, props)
  });
  gas.call("setupLearningPlatformSheets");
  gas.reset();
  return gas;
}

function addLog(gas, id, fields) {
  const sh = gas.sheet("debug_logs");
  const record = Object.assign({ log_id: id, created_at: daysAgo(0), line_user_id: "", request_summary: "{}" }, fields);
  sh.rows.push(sh.rows[0].map((h) => (record[h] === undefined ? "" : record[h])));
}

const ids = (gas) => gas.rows("debug_logs").slice(1).map((r) => r[0]);

t("古い行だけ消える。新しい行と見出しは残る（ばらばらに並んでいても）", () => {
  const gas = make();
  addLog(gas, "old1", { created_at: daysAgo(40) });
  addLog(gas, "new1", { created_at: daysAgo(1) });
  addLog(gas, "old2", { created_at: daysAgo(31) });
  addLog(gas, "old3", { created_at: daysAgo(90) });
  addLog(gas, "new2", { created_at: daysAgo(29) });
  addLog(gas, "nodate", { created_at: "" });
  assert.equal(gas.call("cleanupOldDebugLogs"), 3);
  assert.deepEqual(ids(gas), ["new1", "new2", "nodate"]);
  assert.equal(gas.rows("debug_logs")[0][0], "log_id");
});

t("DEBUG_LOG_KEEP_DAYS で残す日数を変えられる。日付の値（Date）でも数える", () => {
  const gas = make({ DEBUG_LOG_KEEP_DAYS: "7" });
  addLog(gas, "old", { created_at: new Date(Date.now() - 8 * DAY) });
  addLog(gas, "new", { created_at: daysAgo(6) });
  assert.equal(gas.call("cleanupOldDebugLogs"), 1);
  assert.deepEqual(ids(gas), ["new"]);
});

t("全部が古くても、見出しは残る", () => {
  const gas = make();
  for (let i = 0; i < 50; i++) addLog(gas, "old" + i, { created_at: daysAgo(100) });
  assert.equal(gas.call("cleanupOldDebugLogs"), 50);
  assert.equal(gas.rows("debug_logs")[0][0], "log_id");
  assert.deepEqual(ids(gas).filter(Boolean), []);
});

t("0行でも落ちない", () => {
  const gas = make();
  assert.equal(gas.call("cleanupOldDebugLogs"), 0);
  assert.equal(gas.call("purgeLegacyDebugLogs"), 0);
  assert.equal(gas.rows("debug_logs").length, 1);
});

t("前の形の行（LINE のユーザー ID・送られた文がそのまま）だけ消える", () => {
  const gas = make();
  addLog(gas, "legacy_id", { line_user_id: RAW_LINE_ID });
  addLog(gas, "hashed", { line_user_id: "sha256:0011223344556677" });
  addLog(gas, "legacy_text", { request_summary: JSON.stringify({ destination: "x", eventTypes: ["message"], messageTexts: ["こんにちは"] }) });
  addLog(gas, "new_text", { request_summary: JSON.stringify({ destination: "x", eventTypes: ["message"], messageLengths: [5] }) });
  addLog(gas, "api", { line_user_id: "" });
  assert.equal(gas.call("purgeLegacyDebugLogs"), 2);
  assert.deepEqual(ids(gas), ["hashed", "new_text", "api"]);
});

t("いまの書き方で残るログは、前の形と見分けられる（消されない）", () => {
  const gas = make();
  gas.lineEvent({ type: "message", replyToken: "r", source: { type: "user", userId: RAW_LINE_ID }, message: { type: "text", text: "ヘルプ" } });
  assert.ok(ids(gas).length >= 1);
  assert.equal(gas.call("purgeLegacyDebugLogs"), 0);
});

t("消す関数は、動いた時刻を残す（使う前の確かめで見る）", () => {
  const gas = make();
  gas.call("cleanupOldDebugLogs");
  assert.ok(gas.properties.Q_HEARTBEAT_cleanupOldDebugLogs);
  // qcheck-ok: W2 テストの中で、偽物の GAS の値を読むだけ
  assert.equal(gas.eval("Q_SELF_CHECK.heartbeats.cleanupOldDebugLogs"), 1560);
});

t("トリガーを作る関数は、何度動かしても1つだけにする", () => {
  const gas = make();
  // qcheck-ok: W2 テストの中で、偽物の GAS のトリガーを置きかえるだけ
  gas.eval(`(function () {
    var list = [];
    ScriptApp.getProjectTriggers = function () { return list.slice(); };
    ScriptApp.deleteTrigger = function (t) { list = list.filter(function (x) { return x !== t; }); };
    ScriptApp.newTrigger = function (name) {
      var b = { timeBased: function () { return b; }, everyDays: function () { return b; }, atHour: function () { return b; },
        create: function () { var t = { getHandlerFunction: function () { return name; } }; list.push(t); return t; } };
      return b;
    };
    globalThis.__triggers = function () { return list.map(function (t) { return t.getHandlerFunction(); }); };
  })()`);
  gas.call("installDebugLogCleanupTrigger");
  gas.call("installDebugLogCleanupTrigger");
  gas.call("installDebugLogCleanupTrigger");
  // qcheck-ok: W2 テストの中で、偽物の GAS の値を読むだけ
  assert.equal(gas.eval("__triggers().join(\",\")"), "cleanupOldDebugLogs");
});
