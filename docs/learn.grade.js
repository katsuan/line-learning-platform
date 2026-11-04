// 今日の5問の画面の答え合わせ（learn.js から使う。window.LearnGrade）。
// 決まりは GAS の services/gas/src/04_domain/04_domain.answer_grader.js と同じ。画面の正誤とサーバーの正誤がずれないよう、
// services/gas/test/front_grade.test.js で両方に同じ答えを入れてくらべている。
// 読むところ：learn.html（learn.js の前）。
(function (root) {
  // 10 進の数の文字（前後の空白はよい）。GAS の toNumber_ と同じ形
  var NUMBER_TEXT = /^[+-]?(\d+\.?\d*|\.\d+)$/;

  // 全角の数字・点・マイナスを半角にする（長音の「ー」もマイナスに）
  function toHalfWidth(value) {
    return String(value || "").replace(/[０-９．－]/g, function (ch) {
      return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
    }).replace(/ー/g, "-");
  }

  // 数の答えとして使える文字か（全角は半角にしてから見る）
  function isNumberText(value) {
    return NUMBER_TEXT.test(toHalfWidth(value).trim());
  }

  // 答えをそろえる（数字は数に、文字は前後の空白を取る）
  function normalize(question, rawAnswer) {
    if (question.questionType === "NUMBER") {
      return rawAnswer === "" ? "" : Number(rawAnswer);
    }
    if (question.questionType === "TRUE_FALSE") {
      return rawAnswer;
    }
    return String(rawAnswer || "").trim();
  }

  // 正解を、画面に出す文にする
  function correctAnswerText(question, answerPayload) {
    if (!answerPayload || answerPayload.exact === undefined || answerPayload.exact === null) {
      return "";
    }
    if (question.questionType === "TRUE_FALSE") {
      return String(answerPayload.exact) === "true" ? "正しい" : "まちがい";
    }
    return String(answerPayload.exact);
  }

  // 答え合わせをする。返すもの：正誤・点数・説明・そろえた答え（GAS に送る）・正解の文
  function grade(question, rawAnswer) {
    var gradingConfig = question.gradingConfig || {};
    var answerPayload = gradingConfig.correctAnswerPayload || {};
    var normalizedAnswer = normalize(question, rawAnswer);
    var isCorrect = false;

    switch (question.questionType) {
      case "TRUE_FALSE":
        isCorrect = String(normalizedAnswer) === String(answerPayload.exact);
        break;
      case "NUMBER":
        var tolerance = gradingConfig.tolerance === null || gradingConfig.tolerance === undefined ? 0 : Number(gradingConfig.tolerance);
        isCorrect = Math.abs(Number(normalizedAnswer) - Number(answerPayload.exact)) <= tolerance;
        break;
      case "TEXT_EXACT":
      default:
        isCorrect = String(normalizedAnswer).trim().toLowerCase() === String(answerPayload.exact === undefined || answerPayload.exact === null ? "" : answerPayload.exact).trim().toLowerCase();
        break;
    }

    return {
      isCorrect: isCorrect,
      score: isCorrect ? (gradingConfig.maxScore || 1) : 0,
      explanation: question.explanation || "",
      normalizedAnswer: normalizedAnswer,
      correctAnswerText: correctAnswerText(question, answerPayload)
    };
  }

  var api = {
    grade: grade,
    normalize: normalize,
    toHalfWidth: toHalfWidth,
    isNumberText: isNumberText,
    correctAnswerText: correctAnswerText
  };
  root.LearnGrade = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : this);
