var JsonPresenter = (function () {
  function ok(data) {
    return create_(200, data);
  }

  function error(error) {
    var status = error && error.status ? error.status : 500;
    var body = {
      error: {
        code: error && error.code ? error.code : "internal_error",
        message: error && error.message ? error.message : "Unexpected error"
      }
    };
    return create_(status, body);
  }

  function create_(status, body) {
    return ContentService.createTextOutput(JSON.stringify(body))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return {
    ok: ok,
    error: error
  };
})();
