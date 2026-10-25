// 準備ができているかの確かめ（getSetupStatus）。中身：SetupStatusUsecase。
// だれでも呼べる確かめ。個人の情報・ID・人数は返さず、準備ができているかだけを返す。
// 呼ぶところ：02_router.request.js（index.html の ?debug=1 など）。
var SetupStatusUsecase = (function () {
  // ふだんの教室と問題があるかだけを返す
  function execute() {
    var config = ScriptConfig.getPublicConfig();
    var tenantId = config.defaultTenantId;
    var tenant = tenantId ? TenantSheetRepository.findByTenantId(tenantId) : null;
    var questions = tenant ? QuestionSheetRepository.listActiveByTenantId(tenantId) : [];

    return {
      ok: true,
      ready: !!tenant && questions.length > 0,
      resolved: {
        tenantFound: !!tenant,
        questionsFound: questions.length > 0
      }
    };
  }

  return {
    execute: execute
  };
})();
