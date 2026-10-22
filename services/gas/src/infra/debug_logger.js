var DebugLogger = (function () {
  function logRequest(entry) {
    try {
      SpreadsheetGateway.appendObject(DomainConstants.SHEETS.DEBUG_LOGS, normalizeEntry_(entry));
    } catch (error) {
      consoleLog_("debug_log_failed", {
        message: error && error.message ? error.message : String(error) // qcheck-ok: G2 実行ログ（管理者だけが見る）に出すだけ
      });
    }
  }

  // LINE が受けつけなかった返事の原因を、新しい順に5件まで Script Properties の LAST_LINE_ERRORS に残す
  function recordLineError(entry) {
    try {
      var properties = PropertiesService.getScriptProperties();
      var list = [];
      try {
        list = JSON.parse(properties.getProperty("LAST_LINE_ERRORS") || "[]");
      } catch (parseError) {
        list = [];
      }
      list.unshift({
        at: new Date().toISOString(),
        eventType: (entry && entry.eventType) || "",
        code: (entry && entry.code) || "",
        message: truncate_(entry && entry.message, 500)
      });
      properties.setProperty("LAST_LINE_ERRORS", JSON.stringify(list.slice(0, 5)));
    } catch (error) {
      consoleLog_("line_error_record_failed", {
        message: error && error.message ? error.message : String(error) // qcheck-ok: G2 実行ログ（管理者だけが見る）に出すだけ
      });
    }
  }

  function logInfo(message, payload) {
    consoleLog_(message, payload);
  }

  function normalizeEntry_(entry) {
    var safeEntry = entry || {};
    return {
      log_id: safeEntry.logId || "log_" + Utilities.getUuid(),
      request_id: safeEntry.requestId || "",
      level: safeEntry.level || "INFO",
      request_method: safeEntry.requestMethod || "",
      action: safeEntry.action || "",
      route_type: safeEntry.routeType || "",
      status: safeEntry.status || "",
      error_code: safeEntry.errorCode || "",
      error_message: truncate_(safeEntry.errorMessage, 500),
      duration_ms: safeEntry.durationMs || 0,
      event_count: safeEntry.eventCount || 0,
      user_id: safeEntry.userId || "",
      membership_id: safeEntry.membershipId || "",
      // LINE のユーザー ID はそのまま残さない（数えるだけなら足りるので、SHA-256 の頭だけ）
      line_user_id: hashId_(safeEntry.lineUserId),
      request_summary: truncate_(safeEntry.requestSummary, 1000),
      response_summary: truncate_(safeEntry.responseSummary, 1000),
      created_at: safeEntry.createdAt || new Date().toISOString()
    };
  }

  function hashId_(value) {
    if (!value) {
      return "";
    }
    var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value), Utilities.Charset.UTF_8);
    return "sha256:" + bytes.slice(0, 8).map(function (b) {
      return ((b + 256) % 256).toString(16).replace(/^(.)$/, "0$1");
    }).join("");
  }

  function truncate_(value, maxLength) {
    var text = value === undefined || value === null ? "" : String(value);
    if (text.length <= maxLength) {
      return text;
    }
    return text.slice(0, maxLength - 3) + "...";
  }

  function consoleLog_(message, payload) {
    if (typeof console !== "undefined" && console.log) {
      console.log(JSON.stringify({
        message: message,
        payload: payload || {}
      }));
    }
  }

  return {
    logRequest: logRequest,
    recordLineError: recordLineError,
    logInfo: logInfo
  };
})();
