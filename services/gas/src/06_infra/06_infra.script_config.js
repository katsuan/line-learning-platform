// 設定（Script Properties）を読むところ。
// 中身：ScriptConfig（はじめの準備用・画面の API 用・LINE 用の設定）。
// 呼ぶところ：どこからでも。値の見本は script-properties.example.json。
var ScriptConfig = (function () {
  // 1回の呼び出しの中では、Script Properties をまとめて1回だけ読む
  var memo_ = null;

  // 設定を1つ読む（1回の呼び出しで、まとめて1回だけ読む）
  function get_(key) {
    if (!memo_) {
      memo_ = PropertiesService.getScriptProperties().getProperties() || {};
    }
    return memo_[key] === undefined ? null : memo_[key];
  }

  // 設定をまとめて入れる
  function setProperties(properties) {
    PropertiesService.getScriptProperties().setProperties(properties, false);
    memo_ = null;
  }

  // はじめの準備（見本の教室・学習者）に使う設定
  function getRequiredSetupConfig() {
    return {
      spreadsheetId: getSpreadsheetId(),
      defaultTenantId: get_("DEFAULT_TENANT_ID"),
      defaultTenantKey: get_("DEFAULT_TENANT_KEY") || "default-tenant",
      defaultTenantName: get_("DEFAULT_TENANT_NAME") || "LearningPlatform Demo Tenant",
      defaultUserId: get_("DEFAULT_USER_ID"),
      defaultLineUserId: get_("DEFAULT_LINE_USER_ID") || "",
      defaultUserName: get_("DEFAULT_USER_NAME") || "Demo Learner",
      defaultMembershipId: get_("DEFAULT_MEMBERSHIP_ID"),
      defaultMembershipRole: get_("DEFAULT_MEMBERSHIP_ROLE") || "LEARNER"
    };
  }

  // スプレッドシートの ID（なければエラー）
  function getSpreadsheetId() {
    var spreadsheetId = get_("SPREADSHEET_ID");
    if (!spreadsheetId) {
      throw AppError.validation("missing_spreadsheet_id", "SPREADSHEET_ID is not set");
    }
    return spreadsheetId;
  }

  // 画面の API に使う設定
  function getPublicConfig() {
    return {
      appBaseUrl: get_("APP_BASE_URL"),
      liffId: get_("LIFF_ID"),
      lineLoginChannelId: get_("LINE_LOGIN_CHANNEL_ID") || "",
      defaultTenantId: get_("DEFAULT_TENANT_ID")
    };
  }

  // LINE に使う設定（鍵・LIFF・URL・システム管理者）
  function getLineMessagingConfig() {
    return {
      channelAccessToken: get_("LINE_CHANNEL_ACCESS_TOKEN"),
      liffId: get_("LIFF_ID"),
      appBaseUrl: get_("APP_BASE_URL"),
      defaultTenantId: get_("DEFAULT_TENANT_ID"),
      systemAdminLineUserId: getSystemAdminLineUserId_()
    };
  }

  // Webhook の URL の合言葉（WEBHOOK_KEY。なければ空）
  function getWebhookKey() {
    return get_("WEBHOOK_KEY") || "";
  }

  // システム管理者の LINE のユーザー ID（前の名前 SYSTEM_ADMIN_LINE も読む）
  function getSystemAdminLineUserId_() {
    return get_("SYSTEM_ADMIN_LINE_USER_ID") || get_("SYSTEM_ADMIN_LINE") || "";
  }

  return {
    getSpreadsheetId: getSpreadsheetId,
    getPublicConfig: getPublicConfig,
    getRequiredSetupConfig: getRequiredSetupConfig,
    getLineMessagingConfig: getLineMessagingConfig,
    getWebhookKey: getWebhookKey,
    setProperties: setProperties
  };
})();
