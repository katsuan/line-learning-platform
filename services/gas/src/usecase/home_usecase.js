var HomeUsecase = (function () {
  function execute(request) {
    var me = MeUsecase.execute(request);
    var businessDate = DatePolicy.todayBusinessDate();
    return LearningService.buildHomePayload(me, businessDate);
  }

  return {
    execute: execute
  };
})();
