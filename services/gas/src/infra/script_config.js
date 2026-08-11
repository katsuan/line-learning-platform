var ScriptConfig = (function () {
  function get_(key) {
    return PropertiesService.getScriptProperties().getProperty(key);
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
    getPublicConfig: getPublicConfig
  };
})();
