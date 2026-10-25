// 今日の回を返す（resolveDailySession）。
// 中身：ResolveDailySessionUsecase。
// 呼ぶところ：02_router.request.js。
var ResolveDailySessionUsecase = (function () {
  // 本人の今日の回を返す（なければ作る）
  function execute(request) {
    var me = MeUsecase.execute(request);
    var businessDate = DatePolicy.todayBusinessDate();
    return LearningService.resolveDailySessionForMe(me, businessDate);
  }

  return {
    execute: execute
  };
})();
