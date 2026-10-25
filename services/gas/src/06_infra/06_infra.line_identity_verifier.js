// LINE の ID トークンを LINE に確かめて、本人を決めるところ。
// 中身：LineIdentityVerifier（verifyIdToken・requireIdentity）。
// 呼ぶところ：03_usecase.me.js・03_usecase.admin_access.js。
var LineIdentityVerifier = (function () {
  // ID トークンを LINE の verify に送って確かめ、中身（sub・name・picture）を返す。断られたらエラー
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
      throw AppError.upstream(
        "line_id_token_verify_failed",
        "LINE idToken verification failed: " + (payload.error_description || payload.error || response.getContentText())
      );
    }

    return payload;
  }

  // 呼び出しの body の lineIdToken を確かめて、LINE の本人（sub など）を返す。
  // トークンがない・期限切れ・確かめられないときは、どれも errorCode で断る（画面ではログインし直してもらう）
  function requireIdentity(body, errorCode) {
    var idToken = (body && body.lineIdToken) || "";
    if (!idToken) {
      throw AppError.forbidden(errorCode, "LINE login is required");
    }

    var identity;
    try {
      identity = verifyIdToken(idToken);
    } catch (error) {
      throw AppError.forbidden(errorCode, "LINE idToken could not be verified");
    }
    if (!identity || !identity.sub) {
      throw AppError.forbidden(errorCode, "LINE idToken has no user");
    }
    identity.sub = String(identity.sub);
    return identity;
  }

  // 確かめに使うチャネル ID（LINE_LOGIN_CHANNEL_ID、なければ LIFF_ID の頭）
  function resolveClientId_(config) {
    if (config.lineLoginChannelId) {
      return config.lineLoginChannelId;
    }

    if (config.liffId) {
      return String(config.liffId).split("-")[0] || "";
    }

    return "";
  }

  // JSON の文字を読む（読めなければ {}）
  function parseJson_(text) {
    try {
      return JSON.parse(text || "{}");
    } catch (error) {
      return {};
    }
  }

  return {
    verifyIdToken: verifyIdToken,
    requireIdentity: requireIdentity
  };
})();
