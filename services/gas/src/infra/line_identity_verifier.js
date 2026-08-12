var LineIdentityVerifier = (function () {
  function verifyIdToken(idToken) {
    if (!idToken) {
      return null;
    }

    var config = ScriptConfig.getPublicConfig();
    var clientId = resolveClientId_(config);
    if (!clientId) {
      throw AppError.validation(
        "missing_line_login_channel_id",
        "LINE_LOGIN_CHANNEL_ID or LIFF_ID is required to verify LINE idToken"
      );
    }

    var response = UrlFetchApp.fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "post",
      contentType: "application/x-www-form-urlencoded",
      muteHttpExceptions: true,
      payload: {
        id_token: idToken,
        client_id: clientId
      }
    });

    var statusCode = response.getResponseCode();
    var payload = parseJson_(response.getContentText());

    if (statusCode < 200 || statusCode >= 300) {
      throw AppError.validation(
        "line_id_token_verify_failed",
        "LINE idToken verification failed: " + (payload.error_description || payload.error || response.getContentText())
      );
    }

    return payload;
  }

  function resolveClientId_(config) {
    if (config.lineLoginChannelId) {
      return config.lineLoginChannelId;
    }

    if (config.liffId) {
      return String(config.liffId).split("-")[0] || "";
    }

    return "";
  }

  function parseJson_(text) {
    try {
      return JSON.parse(text || "{}");
    } catch (error) {
      return {};
    }
  }

  return {
    verifyIdToken: verifyIdToken
  };
})();
