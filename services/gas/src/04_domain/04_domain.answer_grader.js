// 答え合わせの決まり。中身：AnswerGrader（正誤と点数）。
// 答えの正誤と点数は、サーバーでも画面と同じ決まりで決める（画面から送られた正誤は使わない）。
// 呼ぶところ：03_usecase.create_answer_event.js。画面（docs/learn.js の gradeAnswer_）も同じ決まりで答え合わせする。
var AnswerGrader = (function () {
  // 問題の種類と正解の設定から、答えの正誤と点数を返す
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

  // JSON の文字を読む（物ならそのまま、読めなければ null）
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
