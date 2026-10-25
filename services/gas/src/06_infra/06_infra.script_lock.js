// 同時に書かないようにする鍵。中身：ScriptLock（LockService）。
// 同じ行を何人もが同時に書くところ（初めての人の登録・今日の5問を作る・答えを残す）は、1人ずつ順番にする。
// 鍵を取ったあとはシートを読みなおす（鍵を待つあいだに、ほかの人が書いたかもしれないため）。
// 呼ぶところ：03_usecase.me.js・03_usecase.create_answer_event.js・03_usecase.create_share_receipt.js・04_domain.learning_service.js。
var ScriptLock = (function () {
  // 鍵を取ってから fn を動かし、結果を返す（20 秒待っても取れなければ busy で断る）
  function run(fn) {
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(20000);
    } catch (error) {
      throw AppError.busy("busy", "too many requests at the same time");
    }
    try {
      RequestContext.clearCache("rows");
      return fn();
    } finally {
      lock.releaseLock();
    }
  }

  return {
    run: run
  };
})();
