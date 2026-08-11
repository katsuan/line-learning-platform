var AdminLearnerDetailUsecase = (function () {
  function execute(request) {
    var me = MeUsecase.execute(request);
    var membershipId = request.params.membershipId || (request.body && request.body.membershipId);

    if (!membershipId) {
      throw AppError.validation("missing_membership_id", "membershipId is required");
    }

    var membership = MembershipSheetRepository.findByMembershipId(membershipId);
    if (!membership || membership.tenant_id !== me.tenant.tenant_id) {
      throw AppError.notFound("membership_not_found", "learner membership was not found");
    }

    var user = UserSheetRepository.findByUserId(membership.user_id);
    var events = AnswerEventSheetRepository.listByMembershipId(membership.membership_id);
    var sessions = LearningSessionSheetRepository.listByMembershipId(membership.membership_id);
    var correctCount = events.filter(function (row) {
      return row.is_correct === true || row.is_correct === "true";
    }).length;
    var total = events.length;

    return {
      learner: {
        membershipId: membership.membership_id,
        role: membership.role,
        user: user,
        summary: {
          totalAnsweredCount: total,
          accuracyRate: total === 0 ? 0 : Number((correctCount / total).toFixed(2)),
          lastLearnedAt: total === 0 ? null : events[events.length - 1].answered_at,
          totalSessionCount: sessions.length
        },
        recentSessions: sessions.slice(-10).reverse().map(function (session) {
          return {
            sessionId: session.learning_session_id,
            sessionType: session.session_type,
            status: session.status,
            questionCount: Number(session.question_count || 0),
            businessDate: session.business_date || "",
            createdAt: session.created_at || ""
          };
        })
      }
    };
  }

  return {
    execute: execute
  };
})();
