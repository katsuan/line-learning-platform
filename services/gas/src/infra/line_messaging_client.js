var LineMessagingClient = (function () {
  function replyMessage(replyToken, messages) {
    var config = ScriptConfig.getLineMessagingConfig();
    if (!config.channelAccessToken) {
      throw AppError.validation(
        "missing_line_channel_access_token",
        "LINE_CHANNEL_ACCESS_TOKEN is required for replying to LINE webhook events"
      );
    }

    var response = UrlFetchApp.fetch("https://api.line.me/v2/bot/message/reply", {
      method: "post",
      contentType: "application/json",
      headers: {
        Authorization: "Bearer " + config.channelAccessToken
      },
      muteHttpExceptions: true,
      payload: JSON.stringify({
        replyToken: replyToken,
        messages: messages
      })
    });

    var statusCode = response.getResponseCode();
    if (statusCode < 200 || statusCode >= 300) {
      throw AppError.validation(
        "line_reply_failed",
        "LINE reply API returned status " + statusCode + ": " + response.getContentText()
      );
    }

    return {
      ok: true,
      statusCode: statusCode
    };
  }

  return {
    replyMessage: replyMessage
  };
})();
