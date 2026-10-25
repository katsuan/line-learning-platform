// 動いているかの確かめ（health）。
// 中身：HealthUsecase。だれでも呼べる。個人の情報は返さない。
// 呼ぶところ：02_router.request.js。
var HealthUsecase = (function () {
  // 動いていることと、版を返す
  function execute() {
    return {
      ok: true,
      timestamp: new Date().toISOString(),
      runtime: "gas",
      version: "0.1.0"
    };
  }

  return {
    execute: execute
  };
})();
