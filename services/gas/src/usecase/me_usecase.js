var MeUsecase = (function () {
  function execute(request) {
    var config = ScriptConfig.getPublicConfig();
    var tenantId = request.params.tenantId || config.defaultTenantId;
    var verifiedIdentity = resolveVerifiedLineIdentity_(request);
    var lineUserId = verifiedIdentity ? verifiedIdentity.sub : "";

    if (!tenantId) {
      throw AppError.validation(
        "missing_tenant",
        "tenantId or DEFAULT_TENANT_ID is required. Set DEFAULT_TENANT_ID in Script Properties or pass ?tenantId=..."
      );
    }

    var tenant = TenantSheetRepository.findByTenantId(tenantId);
    if (!tenant) {
      throw AppError.notFound("tenant_not_found", "tenant was not found");
    }

    var resolved = resolveMembershipContext_(tenantId, lineUserId, request, config, verifiedIdentity);
    var membership = resolved.membership;
    var user = resolved.user;
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

  function resolveMembershipContext_(tenantId, lineUserId, request, config, verifiedIdentity) {
    if (lineUserId) {
      var userByLine = UserSheetRepository.findByLineUserId(lineUserId);
      if (!userByLine) {
        userByLine = provisionUserFromLine_(tenantId, lineUserId, request, config, verifiedIdentity);
      }

      var membershipByLine = MembershipSheetRepository.findFirstActiveByTenantIdAndUserId(tenantId, userByLine.user_id);
      if (!membershipByLine) {
        membershipByLine = provisionMembership_(tenantId, userByLine.user_id, config);
      }

      return {
        user: userByLine,
        membership: membershipByLine
      };
    }

    var fallbackMembership = MembershipSheetRepository.findFirstActiveByTenantId(tenantId);
    if (!fallbackMembership) {
      throw AppError.notFound(
        "membership_not_found",
        "Active membership was not found for tenantId=" + tenantId + ". Run initializeLearningPlatformMvp() or check memberships sheet and DEFAULT_TENANT_ID."
      );
    }

    var fallbackUser = UserSheetRepository.findByUserId(fallbackMembership.user_id);
    if (!fallbackUser) {
      throw AppError.notFound("user_not_found", "user for membership was not found");
    }

    return {
      user: fallbackUser,
      membership: fallbackMembership
    };
  }

  function resolveVerifiedLineIdentity_(request) {
    var body = request.body || {};
    var idToken = body.lineIdToken || request.params.lineIdToken || "";
    if (!idToken) {
      return null;
    }

    return LineIdentityVerifier.verifyIdToken(idToken);
  }

  function provisionUserFromLine_(tenantId, lineUserId, request, config, verifiedIdentity) {
    var body = request.body || {};
    var now = new Date().toISOString();
    var userRecord = {
      user_id: "user_" + Utilities.getUuid(),
      line_user_id: lineUserId,
      display_name: body.lineDisplayName || (verifiedIdentity && verifiedIdentity.name) || ("LINE user " + lineUserId.slice(-4)),
      photo_url: body.linePhotoUrl || (verifiedIdentity && verifiedIdentity.picture) || "",
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
      role: config.defaultMembershipRole || "LEARNER",
      status: DomainConstants.MEMBERSHIP_STATUS.ACTIVE,
      joined_at: now,
      last_accessed_at: now,
      created_at: now
    };

    MembershipSheetRepository.append(membershipRecord);
    return membershipRecord;
  }
})();
