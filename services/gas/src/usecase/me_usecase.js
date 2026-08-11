var MeUsecase = (function () {
  function execute(request) {
    var config = ScriptConfig.getPublicConfig();
    var tenantId = request.params.tenantId || config.defaultTenantId;

    if (!tenantId) {
      throw AppError.validation(
        "missing_tenant",
        "tenantId or DEFAULT_TENANT_ID is required. Set DEFAULT_TENANT_ID in Script Properties or pass ?tenantId=..."
      );
    }

    var membership = MembershipSheetRepository.findFirstActiveByTenantId(tenantId);
    if (!membership) {
      throw AppError.notFound(
        "membership_not_found",
        "Active membership was not found for tenantId=" + tenantId + ". Run initializeLearningPlatformMvp() or check memberships sheet and DEFAULT_TENANT_ID."
      );
    }

    var user = UserSheetRepository.findByUserId(membership.user_id);
    var tenant = TenantSheetRepository.findByTenantId(tenantId);
    var entitlements = FeatureEntitlementSheetRepository.listByTenantId(tenantId);

    if (!user) {
      throw AppError.notFound("user_not_found", "user for membership was not found");
    }

    if (!tenant) {
      throw AppError.notFound("tenant_not_found", "tenant was not found");
    }

    return {
      user: user,
      membership: membership,
      tenant: tenant,
      entitlements: entitlements
    };
  }

  return {
    execute: execute
  };
})();
