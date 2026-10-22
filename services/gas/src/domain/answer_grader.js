// 答えの正誤と点数は、サーバーでも画面と同じ決まりで決める（画面から送られた正誤は使わない）。
var AnswerGrader = (function () {
  function grade(questionType, gradingConfig, value) {
    var correct = parseJson_(gradingConfig && gradingConfig.correct_answer_payload) || {};
    var maxScore = Number(gradingConfig && gradingConfig.max_score) || 1;
    var isCorrect = false;

    if (value === undefined || value === null || value === "") {
      isCorrect = false;
    } else if (questionType === "TRUE_FALSE") {
      isCorrect = String(value) === String(correct.exact);
    } else if (questionType === "NUMBER") {
      var tolerance = gradingConfig && gradingConfig.tolerance !== "" && gradingConfig.tolerance !== undefined && gradingConfig.tolerance !== null
        ? Number(gradingConfig.tolerance)
        : 0;
      isCorrect = isFinite(Number(value)) && Math.abs(Number(value) - Number(correct.exact)) <= tolerance;
    } else {
      isCorrect = String(value).trim().toLowerCase() === String(correct.exact === undefined ? "" : correct.exact).trim().toLowerCase();
    }

    return {
      isCorrect: isCorrect,
      score: isCorrect ? maxScore : 0
    };
  }

  function parseJson_(value) {
    if (!value) {
      return null;
    }
    if (typeof value === "object") {
      return value;
    }
    try {
      return JSON.parse(value);
    } catch (error) {
      return null;
    }
  }

  return {
    grade: grade
  };
})();
