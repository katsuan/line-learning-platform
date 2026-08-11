var AdminLearnerListUsecase = (function () {
  function execute(request) {
    var me = MeUsecase.execute(request);
    var memberships = SpreadsheetGateway.readObjects(DomainConstants.SHEETS.MEMBERSHIPS).filter(function (row) {
      return row.tenant_id === me.tenant.tenant_id && row.status === DomainConstants.MEMBERSHIP_STATUS.ACTIVE;
    });

    return {
      learners: memberships.map(function (membership) {
        var user = UserSheetRepository.findByUserId(membership.user_id);
        var events = AnswerEventSheetRepository.listByMembershipId(membership.membership_id);
        var correctCount = events.filter(function (row) {
          return row.is_correct === true || row.is_correct === "true";
        }).length;
        var total = events.length;

        return {
          membershipId: membership.membership_id,
          userId: membership.user_id,
          displayName: user ? user.display_name : "Unknown",
          role: membership.role,
          totalAnsweredCount: total,
          accuracyRate: total === 0 ? 0 : Number((correctCount / total).toFixed(2)),
          lastLearnedAt: total === 0 ? null : events[events.length - 1].answered_at
        };
      })
    };
  }

  return {
    execute: execute
  };
})();
