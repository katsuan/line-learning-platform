// 管理者かどうかを決めるところ。
// 中身：AdminAccess（管理の API の入口で確かめる requireAdmin と、LINE のボットでも使う isAdminLineUser）。
// 呼ぶところ：03_usecase.admin_learner_list.js・03_usecase.admin_learner_detail.js・03_usecase.line_webhook.js（#テスト）。
// 管理の API を使えるのは、LINE でログインした管理者だけ。
// 管理者とは：Script Properties の SYSTEM_ADMIN_LINE_USER_ID の人か、
// その教室（tenant）の memberships で role が ADMIN / OWNER の人。
var AdminAccess = (function () {
  var ADMIN_ROLES = ["ADMIN", "OWNER"];

  // 管理の API の入口で、LINE でログインした管理者かを確かめる。ちがえば断る。教室と LINE のユーザー ID を返す
  function requireAdmin(request) {
    var lineUserId = LineIdentityVerifier.requireIdentity(request.body, "admin_login_required").sub;
    var tenant = TenantSheetRepository.requireForRequest(request);

    if (!isAdminLineUser(lineUserId, tenant.tenant_id)) {
      throw AppError.forbidden("admin_only", "only admins can use this action");
    }

    return { tenant: tenant, lineUserId: lineUserId };
  }

  // 管理の API と LINE のボット（#テスト）で同じ決め方をする
  function isAdminLineUser(lineUserId, tenantId) {
    if (!lineUserId) {
      return false;
    }
    var systemAdminId = ScriptConfig.getLineMessagingConfig().systemAdminLineUserId;
    if (systemAdminId && systemAdminId === lineUserId) {
      return true;
    }
    if (!tenantId) {
      return false;
    }

    var user = UserSheetRepository.findByLineUserId(lineUserId);
    return !!user && SpreadsheetGateway.readObjects(DomainConstants.SHEETS.MEMBERSHIPS).some(function (row) {
      return row.tenant_id === tenantId &&
        row.user_id === user.user_id &&
        row.status === DomainConstants.MEMBERSHIP_STATUS.ACTIVE &&
        ADMIN_ROLES.indexOf(String(row.role || "").toUpperCase()) !== -1;
    });
  }

  return {
    requireAdmin: requireAdmin,
    isAdminLineUser: isAdminLineUser
  };
})();
