var ResolveDailySessionUsecase = (function () {
  function execute(request) {
    var me = MeUsecase.execute(request);
    var businessDate = DatePolicy.todayBusinessDate();
    return LearningService.resolveDailySessionForMe(me, businessDate);
  }

  return {
    execute: execute
  };
})();
