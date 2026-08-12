function doGet(e) {
  return EntryWeb.handleGet(e || {});
}

function doPost(e) {
  return EntryWeb.handlePost(e || {});
}

var EntryWeb = (function () {
  function handleGet(e) {
    return executeWithLogging_("GET", e, false);
  }

  function handlePost(e) {
    return executeWithLogging_("POST", e, true);
  }

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

  function executeWebhook_(e) {
    return LineWebhookRouter.handle(e);
  }

  function executeRequest_(method, e) {
    var request = RequestRouter.parse(method, e);
    return RequestRouter.dispatch(request);
  }

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

  function buildWebhookSummary_(body) {
    var events = body && body.events ? body.events : [];
    return JSON.stringify({
      destination: body.destination || "",
      eventTypes: events.map(function (event) {
        return event.type;
      }),
      messageTexts: events.map(function (event) {
        return event.message && event.message.text ? event.message.text : "";
      }).filter(function (text) {
        return !!text;
      })
    });
  }

  function buildApiSummary_(params, body) {
    return JSON.stringify({
      action: params.action || (body && body.action) || "",
      parameterKeys: Object.keys(params || {}),
      bodyKeys: Object.keys(body || {})
    });
  }

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

  function resolveUserId_(meContext, sessionContext) {
    if (meContext && meContext.user && meContext.user.user_id) {
      return meContext.user.user_id;
    }
    if (sessionContext && sessionContext.userId) {
      return sessionContext.userId;
    }
    return "";
  }

  function resolveMembershipId_(meContext) {
    if (meContext && meContext.membership && meContext.membership.membership_id) {
      return meContext.membership.membership_id;
    }
    return "";
  }

  function buildResponseSummary_(result, error) {
    if (error) {
      return JSON.stringify({
        code: error.code || "internal_error"
      });
    }

    return JSON.stringify(summarizeResult_(result));
  }

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
