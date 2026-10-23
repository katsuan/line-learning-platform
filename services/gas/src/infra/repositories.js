var TenantSheetRepository = (function () {
  function findByTenantId(tenantId) {
    return SpreadsheetGateway.readObjects(DomainConstants.SHEETS.TENANTS).find(function (row) {
      return row.tenant_id === tenantId;
    }) || null;
  }

  // 呼び出しの教室（URL の tenantId → body の tenantId → DEFAULT_TENANT_ID）。教室に入っているかは、呼ぶ側で確かめる
  function requireForRequest(request) {
    var body = request.body || {};
    var params = request.params || {};
    var tenantId = InputLimits.id(params.tenantId || body.tenantId || ScriptConfig.getPublicConfig().defaultTenantId);
    if (!tenantId) {
      throw AppError.validation("missing_tenant", "tenantId or DEFAULT_TENANT_ID is required");
    }
    var tenant = findByTenantId(tenantId);
    if (!tenant) {
      throw AppError.notFound("tenant_not_found", "tenant was not found");
    }
    return tenant;
  }

  return {
    findByTenantId: findByTenantId,
    requireForRequest: requireForRequest
  };
})();

var UserSheetRepository = (function () {
  function findByUserId(userId) {
    return SpreadsheetGateway.readObjects(DomainConstants.SHEETS.USERS).find(function (row) {
      return row.user_id === userId;
    }) || null;
  }

  function findByLineUserId(lineUserId) {
    return SpreadsheetGateway.readObjects(DomainConstants.SHEETS.USERS).find(function (row) {
      return row.line_user_id === lineUserId;
    }) || null;
  }

  function append(record) {
    SpreadsheetGateway.appendObject(DomainConstants.SHEETS.USERS, record);
    return record;
  }

  return {
    findByUserId: findByUserId,
    findByLineUserId: findByLineUserId,
    append: append
  };
})();

var MembershipSheetRepository = (function () {
  function findByMembershipId(membershipId) {
    return SpreadsheetGateway.readObjects(DomainConstants.SHEETS.MEMBERSHIPS).find(function (row) {
      return row.membership_id === membershipId;
    }) || null;
  }

  function findFirstActiveByTenantIdAndUserId(tenantId, userId) {
    return SpreadsheetGateway.readObjects(DomainConstants.SHEETS.MEMBERSHIPS).find(function (row) {
      return row.tenant_id === tenantId
        && row.user_id === userId
        && row.status === DomainConstants.MEMBERSHIP_STATUS.ACTIVE;
    }) || null;
  }

  function append(record) {
    SpreadsheetGateway.appendObject(DomainConstants.SHEETS.MEMBERSHIPS, record);
    return record;
  }

  return {
    findByMembershipId: findByMembershipId,
    findFirstActiveByTenantIdAndUserId: findFirstActiveByTenantIdAndUserId,
    append: append
  };
})();

var FeatureEntitlementSheetRepository = (function () {
  function listByTenantId(tenantId) {
    return SpreadsheetGateway.readObjects(DomainConstants.SHEETS.FEATURE_ENTITLEMENTS).filter(function (row) {
      return row.tenant_id === tenantId;
    });
  }

  return {
    listByTenantId: listByTenantId
  };
})();

var QuestionSheetRepository = (function () {
  function listActiveByTenantId(tenantId) {
    return SpreadsheetGateway.readObjects(DomainConstants.SHEETS.QUESTIONS).filter(function (row) {
      return row.tenant_id === tenantId && row.status === "ACTIVE";
    });
  }

  function findByQuestionId(questionId) {
    return SpreadsheetGateway.readObjects(DomainConstants.SHEETS.QUESTIONS).find(function (row) {
      return row.question_id === questionId;
    }) || null;
  }

  return {
    listActiveByTenantId: listActiveByTenantId,
    findByQuestionId: findByQuestionId
  };
})();

var QuestionGradingConfigSheetRepository = (function () {
  function findByQuestionId(questionId) {
    return SpreadsheetGateway.readObjects(DomainConstants.SHEETS.QUESTION_GRADING_CONFIGS).find(function (row) {
      return row.question_id === questionId;
    }) || null;
  }

  return {
    findByQuestionId: findByQuestionId
  };
})();

var LearningSessionSheetRepository = (function () {
  // business_date はシートで日付に変わるので、いつも yyyy-MM-dd にそろえて返す
  function listAll_() {
    return SpreadsheetGateway.readObjects(DomainConstants.SHEETS.LEARNING_SESSIONS).map(function (row) {
      if (typeof row.business_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.business_date)) {
        return row;
      }
      var copy = Object.assign({}, row);
      copy.business_date = DatePolicy.toBusinessDate(row.business_date);
      return copy;
    });
  }

  function listByMembershipId(membershipId) {
    return listAll_().filter(function (row) {
      return row.membership_id === membershipId;
    });
  }

  function findByLearningSessionId(learningSessionId) {
    return listAll_().find(function (row) {
      return row.learning_session_id === learningSessionId;
    }) || null;
  }

  function findDailyByMembershipAndBusinessDate(membershipId, businessDate) {
    return listByMembershipId(membershipId).find(function (row) {
      return row.session_type === DomainConstants.SESSION_TYPE.DAILY && row.business_date === businessDate;
    }) || null;
  }

  function append(record) {
    SpreadsheetGateway.appendObject(DomainConstants.SHEETS.LEARNING_SESSIONS, record);
    return record;
  }

  return {
    listByMembershipId: listByMembershipId,
    findByLearningSessionId: findByLearningSessionId,
    findDailyByMembershipAndBusinessDate: findDailyByMembershipAndBusinessDate,
    append: append
  };
})();

var SessionQuestionSheetRepository = (function () {
  function listByLearningSessionId(learningSessionId) {
    return SpreadsheetGateway.readObjects(DomainConstants.SHEETS.SESSION_QUESTIONS).filter(function (row) {
      return row.learning_session_id === learningSessionId;
    });
  }

  function appendMany(records) {
    SpreadsheetGateway.appendObjects(DomainConstants.SHEETS.SESSION_QUESTIONS, records);
    return records;
  }

  return {
    listByLearningSessionId: listByLearningSessionId,
    appendMany: appendMany
  };
})();

var AnswerEventSheetRepository = (function () {
  function listByMembershipId(membershipId) {
    return SpreadsheetGateway.readObjects(DomainConstants.SHEETS.ANSWER_EVENTS).filter(function (row) {
      return row.membership_id === membershipId;
    });
  }

  function append(record) {
    SpreadsheetGateway.appendObject(DomainConstants.SHEETS.ANSWER_EVENTS, record);
    return record;
  }

  function findBySessionAndIdempotencyKey(learningSessionId, idempotencyKey) {
    return SpreadsheetGateway.readObjects(DomainConstants.SHEETS.ANSWER_EVENTS).find(function (row) {
      return row.learning_session_id === learningSessionId && row.idempotency_key === idempotencyKey;
    }) || null;
  }

  return {
    listByMembershipId: listByMembershipId,
    append: append,
    findBySessionAndIdempotencyKey: findBySessionAndIdempotencyKey
  };
})();

var ShareReceiptSheetRepository = (function () {
  function findByReceiptCode(receiptCode) {
    return SpreadsheetGateway.readObjects(DomainConstants.SHEETS.SHARE_RECEIPTS).find(function (row) {
      return row.receipt_code === receiptCode;
    }) || null;
  }

  function findByLearningSessionId(learningSessionId) {
    return SpreadsheetGateway.readObjects(DomainConstants.SHEETS.SHARE_RECEIPTS).find(function (row) {
      return row.learning_session_id === learningSessionId;
    }) || null;
  }

  function append(record) {
    SpreadsheetGateway.appendObject(DomainConstants.SHEETS.SHARE_RECEIPTS, record);
    return record;
  }

  return {
    findByReceiptCode: findByReceiptCode,
    findByLearningSessionId: findByLearningSessionId,
    append: append
  };
})();
