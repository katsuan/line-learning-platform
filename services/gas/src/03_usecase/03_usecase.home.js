// 学習者のホーム（getHome）。
// 中身：HomeUsecase（今日の回・今日の答え・これまでの成績）。
// 呼ぶところ：02_router.request.js。
var HomeUsecase = (function () {
  // 本人のホームの中身を返す
  function execute(request) {
    var me = MeUsecase.execute(request);
    var businessDate = DatePolicy.todayBusinessDate();
    return LearningService.buildHomePayload(me, businessDate);
  }

  return {
    execute: execute
  };
})();
