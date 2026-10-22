// 学習者の操作は、LINE でログインした本人としてだけ行う。
// 本人は LINE の ID トークンを LINE に確かめて決める（画面から送られた userId などは使わない）。
// 初めての人を自動で入れるのは、ふだんの教室（DEFAULT_TENANT_ID）だけ。ほかの教室は、すでに入っている人だけ。
var MeUsecase = (function () {
  function execute(request) {
    var config = ScriptConfig.getPublicConfig();
    var body = request.body || {};
    var tenantId = InputLimits.id(request.params.tenantId || body.tenantId || config.defaultTenantId);
    var verifiedIdentity = resolveVerifiedLineIdentity_(request);
    var lineUserId = String(verifiedIdentity.sub);

    if (!tenantId) {
      throw AppError.validation("missing_tenant", "tenantId or DEFAULT_TENANT_ID is required");
    }

    var tenant = TenantSheetRepository.findByTenantId(tenantId);
    if (!tenant) {
      throw AppError.notFound("tenant_not_found", "tenant was not found");
    }

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

  function findMembership_(tenantId, lineUserId) {
    var user = UserSheetRepository.findByLineUserId(lineUserId);
    var membership = user ? MembershipSheetRepository.findFirstActiveByTenantIdAndUserId(tenantId, user.user_id) : null;
    return {
      user: user,
      membership: membership
    };
  }

  function resolveVerifiedLineIdentity_(request) {
    var body = request.body || {};
    var idToken = body.lineIdToken || "";
    if (!idToken) {
      throw AppError.forbidden("login_required", "LINE login is required");
    }

    var identity;
    try {
      identity = LineIdentityVerifier.verifyIdToken(idToken);
    } catch (error) {
      // 期限切れなど。画面ではログインし直してもらう
      throw AppError.forbidden("login_required", "LINE idToken could not be verified");
    }
    if (!identity || !identity.sub) {
      throw AppError.forbidden("login_required", "LINE idToken has no user");
    }
    return identity;
  }

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
