// 管理の API を使えるのは、LINE でログインした管理者だけ。
// 管理者とは：Script Properties の SYSTEM_ADMIN_LINE_USER_ID の人か、
// その教室（tenant）の memberships で role が ADMIN / OWNER の人。
var AdminAccess = (function () {
  var ADMIN_ROLES = ["ADMIN", "OWNER"];

  function requireAdmin(request) {
    var body = request.body || {};
    var idToken = body.lineIdToken || "";
    if (!idToken) {
      throw AppError.forbidden("admin_login_required", "LINE login is required for admin actions");
    }

    var identity;
    try {
      identity = LineIdentityVerifier.verifyIdToken(idToken);
    } catch (error) {
      // 期限切れなど。画面ではログインし直してもらう
      throw AppError.forbidden("admin_login_required", "LINE idToken could not be verified");
    }
    var lineUserId = identity && identity.sub ? String(identity.sub) : "";
    if (!lineUserId) {
      throw AppError.forbidden("admin_login_required", "LINE idToken has no user");
    }

    var config = ScriptConfig.getPublicConfig();
    var tenantId = body.tenantId || request.params.tenantId || config.defaultTenantId;
    if (!tenantId) {
      throw AppError.validation("missing_tenant", "tenantId or DEFAULT_TENANT_ID is required");
    }
    var tenant = TenantSheetRepository.findByTenantId(tenantId);
    if (!tenant) {
      throw AppError.notFound("tenant_not_found", "tenant was not found");
    }

    var systemAdminId = ScriptConfig.getLineMessagingConfig().systemAdminLineUserId;
    if (systemAdminId && systemAdminId === lineUserId) {
      return { tenant: tenant, lineUserId: lineUserId };
    }

    var user = UserSheetRepository.findByLineUserId(lineUserId);
    var isTenantAdmin = !!user && SpreadsheetGateway.readObjects(DomainConstants.SHEETS.MEMBERSHIPS).some(function (row) {
      return row.tenant_id === tenantId &&
        row.user_id === user.user_id &&
        row.status === DomainConstants.MEMBERSHIP_STATUS.ACTIVE &&
        ADMIN_ROLES.indexOf(String(row.role || "").toUpperCase()) !== -1;
    });
    if (!isTenantAdmin) {
      throw AppError.forbidden("admin_only", "only admins can use this action");
    }

    return { tenant: tenant, lineUserId: lineUserId };
  }

  return {
    requireAdmin: requireAdmin
  };
})();
