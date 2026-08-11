function doGet(e) {
  return EntryWeb.handleGet(e || {});
}

function doPost(e) {
  return EntryWeb.handlePost(e || {});
}

var EntryWeb = (function () {
  function handleGet(e) {
    return executeRequest_("GET", e);
  }

  function handlePost(e) {
    try {
      if (LineWebhookRouter.canHandle(e)) {
        var webhookResult = LineWebhookRouter.handle(e);
        return JsonPresenter.ok(webhookResult);
      }

      return executeRequest_("POST", e);
    } catch (error) {
      return JsonPresenter.error(error);
    }
  }

  function executeRequest_(method, e) {
    try {
      var request = RequestRouter.parse(method, e);
      var result = RequestRouter.dispatch(request);
      return JsonPresenter.ok(result);
    } catch (error) {
      return JsonPresenter.error(error);
    }
  }

  return {
    handleGet: handleGet,
    handlePost: handlePost
  };
})();
