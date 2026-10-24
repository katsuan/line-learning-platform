// LINE で「記録」と送った人の、今日の数字（答えた数・正解の数・これまでの正答率）。
// 本人は LINE の知らせの userId で決め、ふだんの教室（DEFAULT_TENANT_ID）の記録だけを見る。
// 読めないとき（シートがない・設定がないなど）は null を返し、返事はふつうの記録のカードにする（黙らない）。
var LineProgressUsecase = (function () {
  var DAILY_QUESTION_LIMIT = 5;

  function forLineUser(lineUserId) {
    try {
      return build_(lineUserId);
    } catch (error) {
      DebugLogger.logInfo("line_progress_failed", { code: error && error.code ? error.code : "internal_error" });
      return null;
    }
  }

  function build_(lineUserId) {
    var tenantId = ScriptConfig.getPublicConfig().defaultTenantId;
    if (!lineUserId || !tenantId) {
      return null;
    }

    var businessDate = DatePolicy.todayBusinessDate();
    var user = UserSheetRepository.findByLineUserId(lineUserId);
    var membership = user ? MembershipSheetRepository.findFirstActiveByTenantIdAndUserId(tenantId, user.user_id) : null;
    var session = membership
      ? LearningSessionSheetRepository.findDailyByMembershipAndBusinessDate(membership.membership_id, businessDate)
      : null;
    var events = membership ? AnswerEventSheetRepository.listByMembershipId(membership.membership_id) : [];

    var progress = {
      businessDate: businessDate,
      total: session
        ? Number(session.question_count || 0)
        : Math.min(DAILY_QUESTION_LIMIT, QuestionSheetRepository.listActiveByTenantId(tenantId).length),
      answered: 0,
      correct: 0,
      overallAccuracyRate: null
    };

    if (session) {
      var latest = {};
      events.forEach(function (row) {
        if (row.learning_session_id === session.learning_session_id) {
          latest[row.session_question_id] = row;
        }
      });
      var keys = Object.keys(latest);
      progress.answered = keys.length;
      progress.correct = keys.filter(function (key) {
        return AnswerStats.isCorrect(latest[key]);
      }).length;
    }
    if (events.length) {
      progress.overallAccuracyRate = Math.round(AnswerStats.summarize(events).accuracyRate * 100);
    }
    return progress;
  }

  return {
    forLineUser: forLineUser
  };
})();
