// 画面からの API の呼び出しを、action ごとにふり分けるところ。
// 中身：RequestRouter（呼び出しを読む・action から usecase を呼ぶ）。
// 呼ぶところ：01_entry.web.js の EntryWeb。
var RequestRouter = (function () {
  // 呼び出しを action・params・body の形に読む。action がなければ断る
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

  // action に合う usecase を呼び、結果を返す。知らない action は断る
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
      case "bootstrapLearning":
        return BootstrapLearningUsecase.execute(request);
      case "resolveDailySession":
        return ResolveDailySessionUsecase.execute(request);
      case "createAnswerEvent":
        return CreateAnswerEventUsecase.execute(request);
      case "createShareReceipt":
        return CreateShareReceiptUsecase.execute(request);
      case "listAdminLearners":
        return AdminLearnerListUsecase.execute(request);
      case "getAdminLearnerDetail":
        return AdminLearnerDetailUsecase.execute(request);
      default:
        throw AppError.validation("unknown_action", "unsupported action: " + request.action);
    }
  }

  // 本文の JSON を読む（読めなければ invalid_json で断る）
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
