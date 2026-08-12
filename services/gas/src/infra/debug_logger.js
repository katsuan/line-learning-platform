var DebugLogger = (function () {
  function logRequest(entry) {
    try {
      SpreadsheetGateway.appendObject(DomainConstants.SHEETS.DEBUG_LOGS, normalizeEntry_(entry));
    } catch (error) {
      consoleLog_("debug_log_failed", {
        message: error && error.message ? error.message : String(error)
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
      line_user_id: safeEntry.lineUserId || "",
      request_summary: truncate_(safeEntry.requestSummary, 1000),
      response_summary: truncate_(safeEntry.responseSummary, 1000),
      created_at: safeEntry.createdAt || new Date().toISOString()
    };
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
    logInfo: logInfo
  };
})();
