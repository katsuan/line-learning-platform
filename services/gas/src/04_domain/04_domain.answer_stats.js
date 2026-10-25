// 答えの数え方。中身：AnswerStats（正解か・まとめ・回で答えた数・回の進み具合）。
// 答え（answer_events の行）の数え方。学習者のホーム・管理の一覧とくわしい記録・回の進み具合で同じ決まりを使う。
// 呼ぶところ：04_domain.learning_service.js・05_presenter.session_presenter.js・03_usecase の管理と提出コードと LINE の記録。
var AnswerStats = (function () {
  // シートは "true" を書くと TRUE（真偽）に変えるので、どちらも正解と読む
  function isCorrect(row) {
    return row.is_correct === true || row.is_correct === "true";
  }

  // 答えの一覧から、答えた数・正答率（0〜1）・さいごに答えた時刻を返す
  function summarize(events) {
    var total = events.length;
    var correct = events.filter(isCorrect).length;
    return {
      totalAnsweredCount: total,
      accuracyRate: total === 0 ? 0 : Number((correct / total).toFixed(2)),
      lastLearnedAt: total === 0 ? null : events[total - 1].answered_at
    };
  }

  // その回で答えた問題の数（同じ問題に何回答えても1問）
  function answeredQuestionCount(learningSessionId, events) {
    var seen = {};
    events.forEach(function (row) {
      if (row.learning_session_id === learningSessionId) {
        seen[row.session_question_id] = true;
      }
    });
    return Object.keys(seen).length;
  }

  // 回の進み具合は、シートの status を書きかえず、答えた数から決める
  function sessionStatus(session, answeredCount) {
    var STATUS = DomainConstants.SESSION_STATUS;
    var total = Number(session.question_count || 0);
    if (session.status === STATUS.COMPLETED || (total > 0 && answeredCount >= total)) {
      return STATUS.COMPLETED;
    }
    if (answeredCount > 0) {
      return STATUS.IN_PROGRESS;
    }
    return session.status || STATUS.CREATED;
  }

  return {
    isCorrect: isCorrect,
    summarize: summarize,
    answeredQuestionCount: answeredQuestionCount,
    sessionStatus: sessionStatus
  };
})();
