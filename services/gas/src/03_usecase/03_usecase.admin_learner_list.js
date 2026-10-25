// 管理の画面の学習者の一覧（listAdminLearners）。
// 中身：AdminLearnerListUsecase。
// 呼ぶところ：02_router.request.js。管理者だけ（AdminAccess）。
var AdminLearnerListUsecase = (function () {
  // 教室の学習者ごとに、答えた数・正答率・さいごに解いた日を返す
  function execute(request) {
    var access = AdminAccess.requireAdmin(request);
    var memberships = SpreadsheetGateway.readObjects(DomainConstants.SHEETS.MEMBERSHIPS).filter(function (row) {
      return row.tenant_id === access.tenant.tenant_id && row.status === DomainConstants.MEMBERSHIP_STATUS.ACTIVE;
    });

    return {
      learners: memberships.map(function (membership) {
        var user = UserSheetRepository.findByUserId(membership.user_id);
        var summary = AnswerStats.summarize(AnswerEventSheetRepository.listByMembershipId(membership.membership_id));

        return {
          membershipId: membership.membership_id,
          userId: membership.user_id,
          displayName: user ? user.display_name : "Unknown",
          role: membership.role,
          totalAnsweredCount: summary.totalAnsweredCount,
          accuracyRate: summary.accuracyRate,
          lastLearnedAt: summary.lastLearnedAt
        };
      })
    };
  }

  return {
    execute: execute
  };
})();
