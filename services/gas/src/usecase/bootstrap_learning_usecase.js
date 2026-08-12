var BootstrapLearningUsecase = (function () {
  function execute(request) {
    var me = MeUsecase.execute(request);
    var businessDate = DatePolicy.todayBusinessDate();
    var sessionResult = LearningService.resolveDailySessionForMe(me, businessDate);

    return {
      me: me,
      home: LearningService.buildHomePayload(me, businessDate),
      session: sessionResult.session,
      reused: sessionResult.reused
    };
  }

  return {
    execute: execute
  };
})();
