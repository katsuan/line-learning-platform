var SetupStatusUsecase = (function () {
  function execute() {
    var config = ScriptConfig.getPublicConfig();
    var setupConfig = ScriptConfig.getRequiredSetupConfig();
    var tenantId = config.defaultTenantId;
    var membership = tenantId ? MembershipSheetRepository.findFirstActiveByTenantId(tenantId) : null;
    var tenant = tenantId ? TenantSheetRepository.findByTenantId(tenantId) : null;
    var user = membership ? UserSheetRepository.findByUserId(membership.user_id) : null;

    return {
      ok: true,
      config: {
        defaultTenantId: config.defaultTenantId || "",
        defaultUserId: setupConfig.defaultUserId || "",
        defaultMembershipId: setupConfig.defaultMembershipId || "",
        spreadsheetIdConfigured: !!setupConfig.spreadsheetId
      },
      sheetCounts: {
        tenants: SpreadsheetGateway.readObjects(DomainConstants.SHEETS.TENANTS).length,
        users: SpreadsheetGateway.readObjects(DomainConstants.SHEETS.USERS).length,
        memberships: SpreadsheetGateway.readObjects(DomainConstants.SHEETS.MEMBERSHIPS).length,
        featureEntitlements: SpreadsheetGateway.readObjects(DomainConstants.SHEETS.FEATURE_ENTITLEMENTS).length
      },
      resolved: {
        tenantFound: !!tenant,
        membershipFound: !!membership,
        userFound: !!user
      },
      nextStep: membership
        ? "Setup looks ready. Retry action=getMe."
        : "Run initializeLearningPlatformMvp() in Apps Script, then retry action=getMe."
    };
  }

  return {
    execute: execute
  };
})();
