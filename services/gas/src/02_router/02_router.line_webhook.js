// LINE の Webhook（知らせ）を受けるところ。
// 中身：LineWebhookRouter（Webhook かどうかの見分けと、知らせを1つずつ LineWebhookUsecase へ渡す）。
// 呼ぶところ：01_entry.web.js の EntryWeb。
var LineWebhookRouter = (function () {
  // POST の本文が LINE の Webhook（events がある）か
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

  // 知らせを1つずつ処理し、結果の一覧を返す
  function handle(e) {
    var body = JSON.parse(e.postData.contents);
    // 1つの知らせで失敗しても、同じ便のほかの知らせには返事する
    var results = (body.events || []).map(function (event) {
      try {
        return LineWebhookUsecase.handleEvent(event);
      } catch (error) {
        DebugLogger.logInfo("line_event_failed", {
          eventType: event && event.type ? event.type : "",
          code: error && error.code ? error.code : "internal_error"
        });
        return {
          handled: false,
          eventType: event && event.type ? event.type : "",
          reason: "error"
        };
      }
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
