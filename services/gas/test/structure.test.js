// ファイルの並べ方の決まり（q-oqrn の docs/structure.md）を守っているか。
// 自己点検の写しが元と同じか・ファイルの先頭と関数の前にコメントがあるか・人が実行する関数とトリガーの名前が残っているか。
// 動かし方：node --test services/gas/test
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "../../..");
const SRC = path.join(__dirname, "../src");
const ORIGINAL_SELFCHECK = path.join(ROOT, "../q-oqrn/tools/qtest/selfcheck.gs");

function listFiles(dir, ext) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(full, ext);
    return entry.name.endsWith(ext) ? [full] : [];
  }).sort();
}

// 関数の宣言（function 名前( と 名前: function( ）のうち、すぐ上の行がコメントでないもの
function functionsWithoutComment(file) {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  const missing = [];
  lines.forEach((line, i) => {
    const m = line.match(/^\s*(?:function\s+([\w$]+)\s*\(|([\w$]+)\s*:\s*function\s*\()/);
    if (!m) return;
    let j = i - 1;
    while (j >= 0 && !lines[j].trim()) j -= 1;
    const prev = j >= 0 ? lines[j].trim() : "";
    if (!(prev.startsWith("//") || prev.endsWith("*/"))) missing.push(`${path.relative(ROOT, file)}:${i + 1} ${m[1] || m[2]}`);
  });
  return missing;
}

// selfcheck.js は q-oqrn の元の写し（中身を変えない）ので、関数のコメントは元のほうで直す
const allCode = () => listFiles(SRC, ".js").filter((f) => !f.endsWith("selfcheck.js")).concat(listFiles(path.join(ROOT, "docs"), ".js"));

test("自己点検（selfcheck.js）は、q-oqrn の元と同じ中身", { skip: !fs.existsSync(ORIGINAL_SELFCHECK) }, () => {
  assert.equal(fs.readFileSync(path.join(SRC, "00_run/selfcheck.js"), "utf8"), fs.readFileSync(ORIGINAL_SELFCHECK, "utf8"));
});

test("どのファイルも、先頭にコメントがある", () => {
  for (const file of allCode()) {
    const first = fs.readFileSync(file, "utf8").split("\n")[0];
    assert.match(first, /^\s*(\/\/|\/\*)/, path.relative(ROOT, file));
  }
  for (const file of listFiles(path.join(ROOT, "docs"), ".css")) {
    assert.match(fs.readFileSync(file, "utf8"), /^\/\*/, path.relative(ROOT, file));
  }
});

test("どの関数も、すぐ上に何をするかのコメントがある", () => {
  assert.deepEqual(allCode().flatMap(functionsWithoutComment), []);
});

test("GAS のファイルは「番号＋役わり」。人が実行する関数は 00_run に、入口は 01_entry に", () => {
  for (const file of listFiles(SRC, ".js")) {
    const rel = path.relative(SRC, file);
    assert.match(rel, /^\d\d_[a-z]+\/(\d\d_[a-z_.]+|selfcheck)\.js$/, rel);
  }
  const run = fs.readFileSync(path.join(SRC, "00_run/00_run.js"), "utf8");
  // 人が実行する関数（ライブラリとして読まれているので、名前を変えない）
  for (const name of ["checkAll", "setupLearningPlatformScriptProperties", "initializeLearningPlatformMvp", "setupLearningPlatformSheets",
    "seedLearningPlatformMvp", "installDebugLogCleanupTrigger", "inspectLearningPlatformLineSetup", "authorizeLearningPlatformExternalRequest",
    "authorizeLearningPlatformLineMessaging", "pushSystemAdminLineTestMessage", "authorizeAndPushSystemAdminLineTestMessage", "purgeLegacyDebugLogs"]) {
    assert.match(run, new RegExp(`\\nfunction ${name}\\(`), name);
  }
  // 入口（Web アプリ・トリガー）
  const entry = listFiles(path.join(SRC, "01_entry"), ".js").map((f) => fs.readFileSync(f, "utf8")).join("\n");
  for (const name of ["doGet", "doPost", "cleanupOldDebugLogs"]) assert.match(entry, new RegExp(`\\nfunction ${name}\\(|^function ${name}\\(`, "m"), name);
  // 00_run と 01_entry と自己点検の写しのほかに、_ で終わらないふつうの関数を置かない（実行の一覧に出さない）
  for (const file of listFiles(SRC, ".js")) {
    const rel = path.relative(SRC, file);
    if (/^0[01]_/.test(rel)) continue;
    const top = [...fs.readFileSync(file, "utf8").matchAll(/^function ([\w$]+)\(/gm)].map((m) => m[1]).filter((n) => !n.endsWith("_"));
    assert.deepEqual(top, [], rel);
  }
});
