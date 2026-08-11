var MeUsecase = (function () {
  function execute(request) {
    var config = ScriptConfig.getPublicConfig();
    var tenantId = request.params.tenantId || config.defaultTenantId;

    if (!tenantId) {
      throw AppError.validation("missing_tenant", "tenantId or DEFAULT_TENANT_ID is required");
    }

    var membership = MembershipSheetRepository.findFirstActiveByTenantId(tenantId);
    if (!membership) {
      throw AppError.notFound("membership_not_found", "active membership was not found");
    }

    var user = UserSheetRepository.findByUserId(membership.userId);
    var tenant = TenantSheetRepository.findByTenantId(tenantId);
    var entitlements = FeatureEntitlementSheetRepository.listByTenantId(tenantId);

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
