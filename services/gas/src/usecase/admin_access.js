// 管理の API を使えるのは、LINE でログインした管理者だけ。
// 管理者とは：Script Properties の SYSTEM_ADMIN_LINE_USER_ID の人か、
// その教室（tenant）の memberships で role が ADMIN / OWNER の人。
var AdminAccess = (function () {
  var ADMIN_ROLES = ["ADMIN", "OWNER"];

  function requireAdmin(request) {
    var lineUserId = LineIdentityVerifier.requireIdentity(request.body, "admin_login_required").sub;
    var tenant = TenantSheetRepository.requireForRequest(request);
    var tenantId = tenant.tenant_id;

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
