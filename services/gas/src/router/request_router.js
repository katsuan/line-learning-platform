var RequestRouter = (function () {
  function parse(method, e) {
    var params = e.parameter || {};
    var body = parseBody_(e);
    var action = params.action || (body && body.action);

    if (!action) {
      throw AppError.validation("missing_action", "action is required");
    }

    return {
      method: method,
      action: action,
      params: params,
      body: body
    };
  }

  function dispatch(request) {
    switch (request.action) {
      case "health":
        return HealthUsecase.execute();
      case "getSetupStatus":
        return SetupStatusUsecase.execute(request);
      case "getMe":
        return MeUsecase.execute(request);
      case "getHome":
        return HomeUsecase.execute(request);
      case "resolveDailySession":
        return ResolveDailySessionUsecase.execute(request);
      case "createAnswerEvent":
        return CreateAnswerEventUsecase.execute(request);
      default:
        throw AppError.validation("unknown_action", "unsupported action: " + request.action);
    }
  }

  function parseBody_(e) {
    if (!e.postData || !e.postData.contents) {
      return {};
    }

    try {
      return JSON.parse(e.postData.contents);
    } catch (error) {
      throw AppError.validation("invalid_json", "request body must be valid JSON");
    }
  }

  return {
    parse: parse,
    dispatch: dispatch
  };
})();
