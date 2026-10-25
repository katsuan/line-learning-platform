// 本人を決めるところ（getMe。学習者のほかの操作も、はじめにここを通る）。中身：MeUsecase。
// 学習者の操作は、LINE でログインした本人としてだけ行う。
// 本人は LINE の ID トークンを LINE に確かめて決める（画面から送られた userId などは使わない）。
// 初めての人を自動で入れるのは、ふだんの教室（DEFAULT_TENANT_ID）だけ。ほかの教室は、すでに入っている人だけ。
// 呼ぶところ：02_router.request.js と、03_usecase の学習者の操作（ホーム・今日の回・答え・提出コード）。
var MeUsecase = (function () {
  // LINE の ID トークンで本人を確かめ、本人・教室での立場・使える機能を返す
  function execute(request) {
    var config = ScriptConfig.getPublicConfig();
    var verifiedIdentity = LineIdentityVerifier.requireIdentity(request.body, "login_required");
    var lineUserId = verifiedIdentity.sub;
    var tenant = TenantSheetRepository.requireForRequest(request);
    var tenantId = tenant.tenant_id;

    var resolved = resolveMembershipContext_(tenantId, lineUserId, request, config, verifiedIdentity);
    var entitlements = FeatureEntitlementSheetRepository.listByTenantId(tenantId);

    return {
      user: resolved.user,
      membership: resolved.membership,
      tenant: tenant,
      entitlements: entitlements
    };
  }

  return {
    execute: execute
  };

  // その教室での本人と立場を返す。初めての人は、ふだんの教室にだけ学習者として入れる
  function resolveMembershipContext_(tenantId, lineUserId, request, config, verifiedIdentity) {
    var found = findMembership_(tenantId, lineUserId);
    if (found.membership) {
      return found;
    }

    if (tenantId !== config.defaultTenantId) {
      throw AppError.forbidden("not_member", "you are not a member of this tenant");
    }

    return ScriptLock.run(function () {
      var again = findMembership_(tenantId, lineUserId);
      var user = again.user || provisionUserFromLine_(lineUserId, request, verifiedIdentity);
      var membership = again.membership || provisionMembership_(tenantId, user.user_id, config);
      return {
        user: user,
        membership: membership
      };
    });
  }

  // LINE のユーザー ID の人と、その教室の立場をさがす
  function findMembership_(tenantId, lineUserId) {
    var user = UserSheetRepository.findByLineUserId(lineUserId);
    var membership = user ? MembershipSheetRepository.findFirstActiveByTenantIdAndUserId(tenantId, user.user_id) : null;
    return {
      user: user,
      membership: membership
    };
  }

  // 初めての人を users に足す（名前と写真は LINE の確かめの結果から）
  function provisionUserFromLine_(lineUserId, request, verifiedIdentity) {
    var body = request.body || {};
    var now = new Date().toISOString();
    var displayName = InputLimits.text(verifiedIdentity.name || body.lineDisplayName, InputLimits.MAX.displayName) ||
      ("LINE user " + lineUserId.slice(-4));
    var userRecord = {
      user_id: "user_" + Utilities.getUuid(),
      line_user_id: lineUserId,
      display_name: displayName,
      photo_url: InputLimits.httpsUrl(verifiedIdentity.picture || body.linePhotoUrl),
      status: "ACTIVE",
      created_at: now,
      updated_at: now
    };

    UserSheetRepository.append(userRecord);
    return userRecord;
  }

  // 教室に学習者として入れる（memberships に足す）
  function provisionMembership_(tenantId, userId, config) {
    var now = new Date().toISOString();
    var membershipRecord = {
      membership_id: "membership_" + Utilities.getUuid(),
      tenant_id: tenantId,
      user_id: userId,
      // 自動で入る人は、いつも学習者（管理者にはしない）
      role: "LEARNER",
      status: DomainConstants.MEMBERSHIP_STATUS.ACTIVE,
      joined_at: now,
      last_accessed_at: now,
      created_at: now
    };

    MembershipSheetRepository.append(membershipRecord);
    return membershipRecord;
  }
})();
