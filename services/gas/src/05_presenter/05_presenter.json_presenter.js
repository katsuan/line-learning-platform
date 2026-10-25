// 呼び出しの結果を JSON にして返すところ。
// 中身：JsonPresenter（ok と error。思わぬエラーの中身は返さない）。
// 呼ぶところ：01_entry.web.js。
var JsonPresenter = (function () {
  // 結果をそのまま JSON で返す
  function ok(data) {
    return create_(200, data);
  }

  // 返すのは、こちらで決めたエラー（AppError）の番号と短い文だけ。
  // 思わぬエラーの中身は返さず、実行ログ・debug_logs にだけ残す
  function error(error) {
    var known = !!(error && error.name === "AppError" && error.status && error.status < 500);
    var status = known ? error.status : (error && error.status) || 500;
    var body = {
      error: {
        code: known || (error && error.name === "AppError") ? error.code : "internal_error",
        // qcheck-ok: G2 返すのはこちらで決めた短い文だけ。思わぬエラーは決まった文に置きかえる
        message: known ? error.message : "Something went wrong. Please try again later.",
        // GAS の Web アプリは HTTP の番号を変えられないので、本文に入れる
        status: status
      }
    };
    return create_(status, body);
  }

  // JSON の返事を作る（GAS は HTTP の番号を変えられないので、番号は本文に入れる）
  function create_(status, body) {
    return ContentService.createTextOutput(JSON.stringify(body))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return {
    ok: ok,
    error: error
  };
})();
