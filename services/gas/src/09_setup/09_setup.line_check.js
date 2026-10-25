// LINE のつながりの確かめ（人が 00_run.js から実行する関数の中身）。
// 中身：外への通信の許可・設定を見る・システム管理者に試しの1通を送る。
// 呼ぶところ：00_run.js の inspectLearningPlatformLineSetup など。
// 外への通信を一度してみる（許可の画面を出すため）
function authorizeExternalRequest_() {
  var response = UrlFetchApp.fetch("https://www.google.com/generate_204", {
    method: "get",
    muteHttpExceptions: true
  });

  return {
    ok: true,
    message: "External request authorization succeeded.",
    statusCode: response.getResponseCode()
  };
}

// LINE の設定を返す（鍵は頭と終わりだけ）
function inspectLineSetup_() {
  var config = ScriptConfig.getLineMessagingConfig();
  var token = config.channelAccessToken || "";
  var destination = config.systemAdminLineUserId || "";

  return {
    ok: true,
    appBaseUrl: config.appBaseUrl || "",
    defaultTenantId: config.defaultTenantId || "",
    liffId: config.liffId || "",
    systemAdminLineUserId: destination,
    hasChannelAccessToken: !!token,
    maskedChannelAccessToken: maskToken_(token),
    checks: {
      externalRequestScopeReady: true,
      pushDestinationReady: !!destination,
      channelAccessTokenReady: !!token
    }
  };
}

// 設定を見てから、外への通信を許す
function authorizeLineMessaging_() {
  var setup = inspectLineSetup_();
  var externalRequest = authorizeExternalRequest_();

  return {
    ok: true,
    message: "Manual authorization path completed on the host GAS project.",
    setup: setup,
    externalRequest: externalRequest
  };
}

// システム管理者に試しの1通を push で送る（SYSTEM_ADMIN_LINE_USER_ID がなければエラー）
function pushSystemAdminTestMessage_() {
  var config = ScriptConfig.getLineMessagingConfig();
  var destination = config.systemAdminLineUserId;

  if (!destination) {
    throw AppError.validation(
      "missing_system_admin_line_user_id",
      "Set SYSTEM_ADMIN_LINE_USER_ID or SYSTEM_ADMIN_LINE before sending a test push."
    );
  }

  var now = new Date();
  var appBaseUrl = config.appBaseUrl || "";
  var messages = [{
    type: "text",
    text: [
      "LearningPlatform 管理通知テスト",
      "日時: " + now.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }),
      "送信先: " + destination,
      appBaseUrl ? "App: " + appBaseUrl : ""
    ].filter(function (line) {
      return !!line;
    }).join("\n")
  }];

  var result = LineMessagingClient.pushMessage(destination, messages);

  return {
    ok: true,
    message: "System admin LINE push message sent.",
    destination: destination,
    result: result
  };
}

// 外への通信を許してから、試しの1通を送る
function authorizeAndPushSystemAdminTestMessage_() {
  var authorization = authorizeLineMessaging_();
  var pushResult = pushSystemAdminTestMessage_();

  return {
    ok: true,
    message: "Authorization and LINE push test completed.",
    authorization: authorization,
    push: pushResult
  };
}

// 鍵を頭 6 文字と終わり 4 文字だけにする
function maskToken_(token) {
  if (!token) {
    return "";
  }

  if (token.length <= 10) {
    return token;
  }

  return token.slice(0, 6) + "..." + token.slice(-4);
}
