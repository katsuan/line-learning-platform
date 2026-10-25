// 管理の画面の「くわしく」（getAdminLearnerDetail）。
// 中身：AdminLearnerDetailUsecase（1人の学習者の成績と最近の回）。
// 呼ぶところ：02_router.request.js。管理者だけ（AdminAccess）。
var AdminLearnerDetailUsecase = (function () {
  // 教室の学習者1人の成績と最近の10回を返す（LINE のユーザー ID は返さない）
  function execute(request) {
    var access = AdminAccess.requireAdmin(request);
    var membershipId = InputLimits.id(request.params.membershipId || (request.body && request.body.membershipId));

    if (!membershipId) {
      throw AppError.validation("missing_membership_id", "membershipId is required");
    }

    var membership = MembershipSheetRepository.findByMembershipId(membershipId);
    if (!membership || membership.tenant_id !== access.tenant.tenant_id) {
      throw AppError.notFound("membership_not_found", "learner membership was not found");
    }

    var user = UserSheetRepository.findByUserId(membership.user_id);
    var events = AnswerEventSheetRepository.listByMembershipId(membership.membership_id);
    var sessions = LearningSessionSheetRepository.listByMembershipId(membership.membership_id);

    return {
      learner: {
        membershipId: membership.membership_id,
        role: membership.role,
        // 管理の画面に出すのは名前と写真だけ（LINE のユーザー ID は返さない）
        user: user ? { user_id: user.user_id, display_name: user.display_name, photo_url: user.photo_url || "" } : null,
        summary: Object.assign(AnswerStats.summarize(events), {
          totalSessionCount: sessions.length
        }),
        recentSessions: sessions.slice(-10).reverse().map(function (session) {
          return {
            sessionId: session.learning_session_id,
            sessionType: session.session_type,
            status: AnswerStats.sessionStatus(session, AnswerStats.answeredQuestionCount(session.learning_session_id, events)),
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
