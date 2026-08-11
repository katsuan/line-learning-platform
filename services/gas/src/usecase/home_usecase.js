var HomeUsecase = (function () {
  function execute(request) {
    var me = MeUsecase.execute(request);
    var businessDate = DatePolicy.todayBusinessDate();
    var todaySession = LearningSessionSheetRepository.findDailyByMembershipAndBusinessDate(
      me.membership.membership_id,
      businessDate
    );
    var answerEvents = AnswerEventSheetRepository.listByMembershipId(me.membership.membership_id);
    var totalAnsweredCount = answerEvents.length;
    var correctCount = answerEvents.filter(function (row) {
      return row.is_correct === true || row.is_correct === "true";
    }).length;

    return {
      todaySession: todaySession ? SessionPresenter.toSummary(todaySession) : null,
      resumableSession: todaySession && todaySession.status !== DomainConstants.SESSION_STATUS.COMPLETED
        ? SessionPresenter.toSummary(todaySession)
        : null,
      learningSummary: {
        totalAnsweredCount: totalAnsweredCount,
        accuracyRate: totalAnsweredCount === 0 ? 0 : Number((correctCount / totalAnsweredCount).toFixed(2)),
        lastLearnedAt: answerEvents.length ? answerEvents[answerEvents.length - 1].answered_at : null
      }
    };
  }

  return {
    execute: execute
  };
})();
