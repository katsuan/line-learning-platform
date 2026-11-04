// GAS の読みこみ順：GAS はファイルを並び順に1つずつ読む。読みこみ時（いちばん外の行）に、あとのファイルのものを使うと、
// プロジェクト全体が動かない（本番はライブラリとして読まれるので、全部の呼び出しが失敗する）。
// fake-gas は全部を1つにつないで読むので見つけられない。ここでは1つずつ読む。
// 動かし方：node --test services/gas/test
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SRC = path.join(__dirname, "../src");

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : entry.name.endsWith(".js") ? [full] : [];
  });
}

test("ファイルを並び順に1つずつ読んでも、読みこみ時に止まらない", () => {
  // clasp はファイルの名前の順に送る（filePushOrder は使っていない）
  const clasp = JSON.parse(fs.readFileSync(path.join(__dirname, "../.clasp.json.example"), "utf8"));
  assert.equal(clasp.filePushOrder, undefined);
  const files = listFiles(SRC).map((f) => path.relative(SRC, f)).sort();
  // GAS の道具は、読みこみ時にはふれない前提で、空のものを置く
  const context = vm.createContext({ console, Logger: { log() {} } });
  for (const file of files) {
    assert.doesNotThrow(() => vm.runInContext(fs.readFileSync(path.join(SRC, file), "utf8"), context, { filename: file }), file);
  }
});
