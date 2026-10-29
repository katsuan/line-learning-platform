// シートや外から来た JSON の文字を読むところ。読めないときは決めた値を返し、呼び出しを止めない。
// 中身：JsonText（parse）。
// 呼ぶところ：04_domain.answer_grader.js・04_domain.learning_service.js・05_presenter.session_presenter.js・06_infra.line_identity_verifier.js。
var JsonText = (function () {
  // JSON の文字を読む。物ならそのまま、空・読めないときは fallback（書かなければ null）
  function parse(value, fallback) {
    var otherwise = fallback === undefined ? null : fallback;
    if (value && typeof value === "object") {
      return value;
    }
    if (!value) {
      return otherwise;
    }
    try {
      return JSON.parse(value);
    } catch (error) {
      return otherwise;
    }
  }

  return {
    parse: parse
  };
})();
