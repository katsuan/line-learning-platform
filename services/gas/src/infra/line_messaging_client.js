var LineMessagingClient = (function () {
  function replyMessage(replyToken, messages) {
    return send_("https://api.line.me/v2/bot/message/reply", {
      replyToken: replyToken,
      messages: messages
    }, "line_reply_failed");
  }

  function pushMessage(to, messages) {
    if (!to) {
      throw AppError.validation(
        "missing_line_push_to",
        "LINE push destination is required"
      );
    }

    return send_("https://api.line.me/v2/bot/message/push", {
      to: to,
      messages: messages
    }, "line_push_failed");
  }

  function send_(url, payload, errorCode) {
    var config = ScriptConfig.getLineMessagingConfig();
    if (!config.channelAccessToken) {
      throw AppError.validation(
        "missing_line_channel_access_token",
        "LINE_CHANNEL_ACCESS_TOKEN is required for LINE Messaging API requests"
      );
    }

    var response = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      headers: {
        Authorization: "Bearer " + config.channelAccessToken
      },
      muteHttpExceptions: true,
      payload: JSON.stringify(payload)
    });

    var statusCode = response.getResponseCode();
    if (statusCode < 200 || statusCode >= 300) {
      throw AppError.validation(
        errorCode,
        "LINE Messaging API returned status " + statusCode + ": " + response.getContentText()
      );
    }

    return {
      ok: true,
      statusCode: statusCode
    };
  }

  return {
    replyMessage: replyMessage,
    pushMessage: pushMessage
  };
})();
