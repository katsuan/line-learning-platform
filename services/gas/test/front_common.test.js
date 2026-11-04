// 画面の共通の道具（docs/common.js）。日付は日本の日にちで出す・HTML に入れる文字を直す・GAS の失敗の返事は失敗にする。
// 動かし方：node --test services/gas/test
const test = require("node:test");
const assert = require("node:assert/strict");
const Common = require("../../../docs/common.js");

// fetch の返事の偽物
const reply = (status, text) => ({ ok: status >= 200 && status < 300, text: () => Promise.resolve(text) });

test("日付：シートの日付も、日付に変わった時刻（前の日の 15 時 UTC）も、日本の日にちで出す", () => {
  assert.equal(Common.formatDate("2026-10-23"), "10月23日");
  assert.equal(Common.formatDate("2026-10-22T15:00:00.000Z"), "10月23日");
  assert.equal(Common.formatDateTime("2026-10-23T00:05:00.000Z"), "10月23日 9:05");
  for (const bad of ["", null, undefined, "あした"]) {
    assert.equal(Common.formatDate(bad), "", String(bad));
    assert.equal(Common.formatDateTime(bad), "", String(bad));
  }
});

test("HTML に入れる文字：< > & \" ' を直し、空は空にする", () => {
  assert.equal(Common.escapeHtml(`<a href="x">'&'</a>`), "&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  assert.equal(Common.escapeHtml(null), "");
  assert.equal(Common.escapeHtml(0), "0");
});

test("GAS の返事：ok は中身を返し、error 入り・HTTP の失敗・JSON でない返事は失敗にする", async () => {
  assert.deepEqual(await Common.readJsonResponse(reply(200, '{"ok":true}')), { ok: true });
  await assert.rejects(Common.readJsonResponse(reply(200, '{"error":{"code":"login_required"}}')), (e) => e.error.code === "login_required");
  await assert.rejects(Common.readJsonResponse(reply(500, "oops")), (e) => e.raw === "oops");
  assert.equal(await Common.readJsonResponse(reply(200, "null")), null, "null でも落ちない");
});
