var LineWebhookRouter = (function () {
  function canHandle(e) {
    if (!e || !e.postData || !e.postData.contents) {
      return false;
    }

    try {
      var body = JSON.parse(e.postData.contents);
      return !!(body && body.events && body.events.length);
    } catch (error) {
      return false;
    }
  }

  function handle(e) {
    var body = JSON.parse(e.postData.contents);
    var results = (body.events || []).map(function (event) {
      return LineWebhookUsecase.handleEvent(event);
    });

    return {
      ok: true,
      source: "line_webhook",
      eventCount: results.length,
      results: results
    };
  }

  return {
    canHandle: canHandle,
    handle: handle
  };
})();
