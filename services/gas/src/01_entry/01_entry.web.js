// Web アプリの入口（画面からの呼び出しと、LINE の Webhook）。
// 中身：doGet・doPost と、呼び出しをふり分けてログを残す EntryWeb。
// 呼ぶところ：本番の Web アプリ（ライブラリとして読む別のプロジェクトの doGet・doPost）。名前は変えない。
// GET の呼び出し（health など、だれでも呼べる確かめ）。JSON で返す
function doGet(e) {
  return EntryWeb.handleGet(e || {});
}

// POST の呼び出し（画面の API と LINE の Webhook）。JSON で返す
function doPost(e) {
  return EntryWeb.handlePost(e || {});
}

var EntryWeb = (function () {
  // GET を受ける（Webhook は受けない）
  function handleGet(e) {
    return executeWithLogging_("GET", e, false);
  }

  // POST を受ける（LINE の Webhook もここに来る）
  function handlePost(e) {
    return executeWithLogging_("POST", e, true);
  }

  // 呼び出しを1つ処理し、結果かエラーを JSON にして返す。どちらでも debug_logs に1行残す
  function executeWithLogging_(method, e, allowWebhook) {
    var routeMeta = detectRouteMeta_(method, e, allowWebhook);
    RequestContext.start(routeMeta);

    try {
      var result = allowWebhook && routeMeta.routeType === "line_webhook"
        ? executeWebhook_(e)
        : executeRequest_(method, e);
      logRequest_(routeMeta, "SUCCESS", null, result);
      return JsonPresenter.ok(result);
    } catch (error) {
      logRequest_(routeMeta, "ERROR", error, null);
      return JsonPresenter.error(error);
    } finally {
      RequestContext.finish();
    }
  }

  // LINE の Webhook を処理する。WEBHOOK_KEY を入れたら、URL の ?key= が合わない知らせは何もしない
  function executeWebhook_(e) {
    // Webhook の URL の合言葉（?key=）。WEBHOOK_KEY を入れたら、合わない知らせには何もしない
    var expectedKey = ScriptConfig.getWebhookKey();
    var givenKey = e && e.parameter && e.parameter.key ? String(e.parameter.key) : "";
    if (expectedKey && givenKey !== expectedKey) {
      return { ok: true, source: "line_webhook", eventCount: 0, results: [], ignored: "bad_key" };
    }
    return LineWebhookRouter.handle(e);
  }

  // 画面からの呼び出し（action）をふり分けて、結果を返す
  function executeRequest_(method, e) {
    var request = RequestRouter.parse(method, e);
    return RequestRouter.dispatch(request);
  }

  // ログに残す呼び出しのようす（Webhook か API か・action・知らせの数）を決める
  function detectRouteMeta_(method, e, allowWebhook) {
    if (allowWebhook && LineWebhookRouter.canHandle(e)) {
      var webhookBody = safeParseBody_(e);
      var firstEvent = webhookBody.events && webhookBody.events[0] ? webhookBody.events[0] : {};
      var source = firstEvent.source || {};
      return {
        requestMethod: method,
        action: "lineWebhook",
        routeType: "line_webhook",
        eventCount: webhookBody.events ? webhookBody.events.length : 0,
        lineUserId: source.userId || "",
        requestSummary: buildWebhookSummary_(webhookBody)
      };
    }

    var body = safeParseBody_(e);
    var params = e && e.parameter ? e.parameter : {};
    return {
      requestMethod: method,
      action: params.action || (body && body.action) || "",
      routeType: "json_api",
      eventCount: 0,
      lineUserId: "",
      requestSummary: buildApiSummary_(params, body)
    };
  }

  // 本文の JSON を読む。読めないときは {} か、元の文字を raw に入れて返す
  function safeParseBody_(e) {
    if (!e || !e.postData || !e.postData.contents) {
      return {};
    }

    try {
      return JSON.parse(e.postData.contents);
    } catch (error) {
      return {
        raw: e.postData.contents
      };
    }
  }

  // Webhook のログの要約（知らせの種類と、送られた文の長さだけ。文そのものは残さない）
  function buildWebhookSummary_(body) {
    var events = body && body.events ? body.events : [];
    return JSON.stringify({
      destination: body.destination || "",
      eventTypes: events.map(function (event) {
        return event.type;
      }),
      // 送られた文はログに残さない（長さだけ）
      messageLengths: events.map(function (event) {
        return event.message && event.message.text ? String(event.message.text).length : 0;
      })
    });
  }

  // API のログの要約（action と、送られた項目の名前だけ）
  function buildApiSummary_(params, body) {
    return JSON.stringify({
      action: params.action || (body && body.action) || "",
      parameterKeys: Object.keys(params || {}),
      bodyKeys: Object.keys(body || {})
    });
  }

  // debug_logs に、この呼び出しの1行を残す
  function logRequest_(routeMeta, status, error, result) {
    var context = RequestContext.get() || {};
    var durationMs = context.startedAtMillis ? new Date().getTime() - context.startedAtMillis : 0;
    var meContext = result && result.me ? result.me : null;
    var sessionContext = result && result.session ? result.session : null;

    DebugLogger.logRequest({
      requestId: context.requestId || "",
      requestMethod: routeMeta.requestMethod,
      action: routeMeta.action,
      routeType: routeMeta.routeType,
      status: status,
      errorCode: error && error.code ? error.code : "",
      errorMessage: error && error.message ? error.message : "",
      durationMs: durationMs,
      eventCount: routeMeta.eventCount || 0,
      userId: resolveUserId_(meContext, sessionContext),
      membershipId: resolveMembershipId_(meContext),
      lineUserId: routeMeta.lineUserId,
      requestSummary: routeMeta.requestSummary,
      responseSummary: buildResponseSummary_(result, error),
      createdAt: new Date().toISOString()
    });
  }

  // ログに残す user_id（結果の me か session から）
  function resolveUserId_(meContext, sessionContext) {
    if (meContext && meContext.user && meContext.user.user_id) {
      return meContext.user.user_id;
    }
    if (sessionContext && sessionContext.userId) {
      return sessionContext.userId;
    }
    return "";
  }

  // ログに残す membership_id（結果の me から）
  function resolveMembershipId_(meContext) {
    if (meContext && meContext.membership && meContext.membership.membership_id) {
      return meContext.membership.membership_id;
    }
    return "";
  }

  // ログに残す結果の要約（エラーなら番号だけ）
  function buildResponseSummary_(result, error) {
    if (error) {
      return JSON.stringify({
        code: error.code || "internal_error"
      });
    }

    return JSON.stringify(summarizeResult_(result));
  }

  // 結果を、ログに残す小さな形にまとめる（個人の中身は入れない）
  function summarizeResult_(result) {
    if (!result) {
      return {};
    }

    if (result.source === "line_webhook") {
      return {
        source: result.source,
        eventCount: result.eventCount,
        handled: (result.results || []).map(function (entry) {
          return {
            eventType: entry.eventType || "",
            handled: entry.handled === true,
            reason: entry.reason || ""
          };
        })
      };
    }

    return {
      ok: result.ok === true,
      action: result.action || "",
      duplicated: result.duplicated === true,
      reused: result.reused === true,
      questionCount: result.session && result.session.questionCount ? result.session.questionCount : 0
    };
  }

  return {
    handleGet: handleGet,
    handlePost: handlePost
  };
})();
