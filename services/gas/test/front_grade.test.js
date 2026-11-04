// 画面の答え合わせ（docs/learn.grade.js）と GAS の答え合わせ（04_domain.answer_grader.js）が同じ正誤になるか。
// 画面は先に正誤を出し、GAS は送られた答えで決めなおす。ずれると「正解！」と出たのに記録はまちがい、になる。
// 動かし方：node --test services/gas/test
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const FAKE_GAS = path.join(__dirname, "../../../../q-oqrn/tools/qtest/fake-gas.js");
const HAS_FAKE_GAS = fs.existsSync(FAKE_GAS);
const { createGas } = HAS_FAKE_GAS ? require(FAKE_GAS) : {};
const t = HAS_FAKE_GAS ? test : test.skip;
const Front = require("../../../docs/learn.grade.js");

// シートの正解の行と、画面に渡す形（05_presenter.session_presenter.js の normalizeGradingConfig_ と同じ形）
function makeQuestion(questionType, exact, tolerance) {
  const sheet = { correct_answer_payload: JSON.stringify({ exact }), tolerance: tolerance === undefined ? "" : tolerance, max_score: 1 };
  const screen = {
    questionType,
    gradingConfig: {
      correctAnswerPayload: { exact },
      tolerance: sheet.tolerance === "" ? null : Number(sheet.tolerance || 0),
      maxScore: 1
    }
  };
  return { sheet, screen };
}

// 画面で「答える」を押したときと同じ流れ（learn.js の submitAnswer_）。送れない答えなら null
function submitOnScreen(question, typed) {
  const text = String(typed).trim();
  if (text === "") return null;
  if (question.questionType === "NUMBER" && !Front.isNumberText(text)) return null;
  const value = question.questionType === "NUMBER" ? Front.toHalfWidth(text).trim() : text;
  return Front.grade(question, value);
}

const CASES = [
  ["NUMBER", 3, undefined, ["3", " 3 ", "３", "3.0", "+3", "4", "-3", "0x3", "1e0", "3,0", "三"]],
  ["NUMBER", -2, undefined, ["-2", "－２", "ー2", "2"]],
  ["NUMBER", 3.5, 0.1, ["3.45", "3.6", "3.61", ".5", "3."]],
  ["NUMBER", 0, undefined, ["0", "-0", "0.0", "00", "1"]],
  ["TEXT_EXACT", "Apple", undefined, ["apple", " APPLE ", "Apple ", "aple", "ａｐｐｌｅ"]],
  ["TEXT_EXACT", 0, undefined, ["0", "", "zero"]],
  ["TRUE_FALSE", "true", undefined, ["true", "false"]],
  ["TRUE_FALSE", false, undefined, ["true", "false"]]
];

t("画面とサーバーで、同じ答えは同じ正誤・同じ点数になる", () => {
  const gas = createGas({ dir: path.join(__dirname, "../src"), properties: {} });
  const Server = gas.ctx.AnswerGrader;
  let checked = 0;
  for (const [type, exact, tolerance, inputs] of CASES) {
    const { sheet, screen } = makeQuestion(type, exact, tolerance);
    for (const typed of inputs) {
      const front = submitOnScreen(screen, typed);
      if (!front) continue;
      // GAS には、画面がそろえた答え（normalizedAnswer）が送られる
      const server = Server.grade(type, sheet, front.normalizedAnswer);
      assert.equal(front.isCorrect, server.isCorrect, `${type} 正解 ${JSON.stringify(exact)} に「${typed}」`);
      assert.equal(front.score, server.score, `${type} 「${typed}」の点数`);
      checked += 1;
    }
  }
  assert.ok(checked >= 30, `くらべた数 ${checked}`);
});

t("数の問題：画面は 10 進の数だけ受けつける（16 進・指数・カンマ・漢数字は「数字で入れてね」）", () => {
  for (const ok of ["3", " 3 ", "３", "-2", "－２", "3.", ".5", "+1"]) assert.equal(Front.isNumberText(ok), true, ok);
  for (const ng of ["0x10", "1e3", "3,0", "三", "", "  ", "Infinity", "1 2"]) assert.equal(Front.isNumberText(ng), false, ng);
});

t("正解の文：正しい・まちがいの問題は言葉で、ほかはそのまま", () => {
  assert.equal(Front.correctAnswerText({ questionType: "TRUE_FALSE" }, { exact: "true" }), "正しい");
  assert.equal(Front.correctAnswerText({ questionType: "TRUE_FALSE" }, { exact: false }), "まちがい");
  assert.equal(Front.correctAnswerText({ questionType: "NUMBER" }, { exact: 0 }), "0");
  assert.equal(Front.correctAnswerText({ questionType: "TEXT_EXACT" }, {}), "");
});
