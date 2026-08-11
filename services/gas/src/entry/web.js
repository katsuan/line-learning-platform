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
    return executeRequest_("POST", e);
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
