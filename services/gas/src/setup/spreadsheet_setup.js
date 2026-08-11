function setupLearningPlatformSheets() {
  var spreadsheet = SpreadsheetApp.openById(ScriptConfig.getSpreadsheetId());
  var definitions = [
    { name: "tenants", headers: ["tenant_id", "tenant_key", "name", "status", "timezone", "locale", "plan_code", "created_at", "updated_at"] },
    { name: "users", headers: ["user_id", "line_user_id", "display_name", "photo_url", "status", "created_at", "updated_at"] },
    { name: "memberships", headers: ["membership_id", "tenant_id", "user_id", "role", "status", "joined_at", "last_accessed_at", "created_at"] },
    { name: "feature_entitlements", headers: ["feature_entitlement_id", "tenant_id", "feature_key", "enabled", "limit_value", "period_type", "effective_from", "effective_to", "created_at", "updated_at"] }
  ];

  definitions.forEach(function (definition) {
    ensureSheet_(spreadsheet, definition.name, definition.headers);
  });
}

function ensureSheet_(spreadsheet, name, headers) {
  var sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
}
