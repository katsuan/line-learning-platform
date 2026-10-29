// 答え合わせの決まり（04_domain.answer_grader.js）。点数はサーバーで決めるので、画面から変な値が来ても正解にしない。
// 動かし方：node --test services/gas/test
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const FAKE_GAS = path.join(__dirname, "../../../../q-oqrn/tools/qtest/fake-gas.js");
const HAS_FAKE_GAS = fs.existsSync(FAKE_GAS);
const { createGas } = HAS_FAKE_GAS ? require(FAKE_GAS) : {};
const t = HAS_FAKE_GAS ? test : test.skip;

function grader() {
  const gas = createGas({ dir: path.join(__dirname, "../src"), properties: {} });
  return gas.ctx.AnswerGrader;
}
const config = (exact, tolerance) => ({ correct_answer_payload: JSON.stringify({ exact }), tolerance, max_score: 1 });

t("数の問題：数と数の文字は正しく答え合わせする（ゆるす幅も）", () => {
  const g = grader();
  assert.equal(g.grade("NUMBER", config(3, ""), 3).isCorrect, true);
  assert.equal(g.grade("NUMBER", config(3, ""), "3").isCorrect, true);
  assert.equal(g.grade("NUMBER", config(3, ""), " 3 ").isCorrect, true);
  assert.equal(g.grade("NUMBER", config(3.5, 0.1), "3.45").isCorrect, true);
  assert.equal(g.grade("NUMBER", config(-2, ""), "-2").isCorrect, true);
  assert.equal(g.grade("NUMBER", config(3, ""), 4).isCorrect, false);
});

t("数の問題：true・空白だけ・数でない文字は正解にしない（Number() で 1 や 0 にしない）", () => {
  const g = grader();
  assert.equal(g.grade("NUMBER", config(1, ""), true).isCorrect, false, "true");
  assert.equal(g.grade("NUMBER", config(0, ""), "   ").isCorrect, false, "空白だけ");
  assert.equal(g.grade("NUMBER", config(0, ""), false).isCorrect, false, "false");
  assert.equal(g.grade("NUMBER", config(16, ""), "0x10").isCorrect, false, "16進");
  assert.equal(g.grade("NUMBER", config(0, ""), []).isCorrect, false, "空の配列");
});

t("文字・正しいかまちがいかの問題", () => {
  const g = grader();
  assert.equal(g.grade("TEXT_EXACT", config("Apple"), " apple ").isCorrect, true);
  assert.equal(g.grade("TEXT_EXACT", config("apple"), "   ").isCorrect, false);
  assert.equal(g.grade("TRUE_FALSE", config(true), "true").isCorrect, true);
  assert.equal(g.grade("TRUE_FALSE", config(true), "false").isCorrect, false);
  assert.equal(g.grade("TRUE_FALSE", config(true), "").isCorrect, false);
});
