var ScriptConfig = (function () {
  function get_(key) {
    return PropertiesService.getScriptProperties().getProperty(key);
  }

  function setProperties(properties) {
    PropertiesService.getScriptProperties().setProperties(properties, false);
  }

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

  function getSpreadsheetId() {
    var spreadsheetId = get_("SPREADSHEET_ID");
    if (!spreadsheetId) {
      throw AppError.validation("missing_spreadsheet_id", "SPREADSHEET_ID is not set");
    }
    return spreadsheetId;
  }

  function getPublicConfig() {
    return {
      appBaseUrl: get_("APP_BASE_URL"),
      liffId: get_("LIFF_ID"),
      defaultTenantId: get_("DEFAULT_TENANT_ID"),
      allowedOrigin: get_("ALLOWED_ORIGIN")
    };
  }

  return {
    getSpreadsheetId: getSpreadsheetId,
    getPublicConfig: getPublicConfig,
    getRequiredSetupConfig: getRequiredSetupConfig,
    setProperties: setProperties
  };
})();
