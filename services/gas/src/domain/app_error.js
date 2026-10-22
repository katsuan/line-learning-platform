var AppError = (function () {
  function create(code, message, status) {
    return {
      name: "AppError",
      code: code,
      message: message,
      status: status
    };
  }

  function validation(code, message) {
    return create(code, message, 400);
  }

  function notFound(code, message) {
    return create(code, message, 404);
  }

  function forbidden(code, message) {
    return create(code, message, 403);
  }

  // LINE など外のサービスが断ったとき。中身はログにだけ残し、呼んだ人には返さない
  function upstream(code, message) {
    return create(code, message, 502);
  }

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
