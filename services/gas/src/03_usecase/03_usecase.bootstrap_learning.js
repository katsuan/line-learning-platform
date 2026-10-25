// 学習の画面を開いたときに、まとめて読むもの（bootstrapLearning）。
// 中身：BootstrapLearningUsecase（本人・ホーム・今日の回）。
// 呼ぶところ：02_router.request.js（learn.html が開いたとき）。
var BootstrapLearningUsecase = (function () {
  // 本人・ホーム（今日の答え・成績）・今日の回（なければ作る）をまとめて返す
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
