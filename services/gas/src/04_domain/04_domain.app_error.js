// こちらで決めたエラーの形（番号・短い文・HTTP の番号）。
// 中身：AppError（validation 400・forbidden 403・notFound 404・upstream 502・busy 503）。
// 呼ぶところ：どこからでも。05_presenter.json_presenter.js が、画面に返す形にする。
var AppError = (function () {
  // エラーの物を作る
  function create(code, message, status) {
    return {
      name: "AppError",
      code: code,
      message: message,
      status: status
    };
  }

  // 入力がおかしいとき（400）
  function validation(code, message) {
    return create(code, message, 400);
  }

  // 見つからないとき（404）
  function notFound(code, message) {
    return create(code, message, 404);
  }

  // 使ってはいけないとき（403）
  function forbidden(code, message) {
    return create(code, message, 403);
  }

  // LINE など外のサービスが断ったとき。中身はログにだけ残し、呼んだ人には返さない
  function upstream(code, message) {
    return create(code, message, 502);
  }

  // 混んでいるとき（503）
  function busy(code, message) {
    return create(code, message, 503);
  }

  return {
    busy: busy,
    upstream: upstream,
    validation: validation,
    notFound: notFound,
    forbidden: forbidden
  };
})();
