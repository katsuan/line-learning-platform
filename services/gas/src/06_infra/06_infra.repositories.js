// シートごとの読み書き（1シートに1つの …SheetRepository）。
// 中身：教室・人・立場・使える機能・問題・正解の設定・回・回の問題・答え・提出コード。
// 呼ぶところ：03_usecase・04_domain・05_presenter の各ファイル。シートは 06_infra.spreadsheet_gateway.js で読む。
var TenantSheetRepository = (function () {
  // 教室を ID でさがす
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
  // 人を user_id でさがす
  function findByUserId(userId) {
    return SpreadsheetGateway.readObjects(DomainConstants.SHEETS.USERS).find(function (row) {
      return row.user_id === userId;
    }) || null;
  }

  // 人を LINE のユーザー ID でさがす
  function findByLineUserId(lineUserId) {
    return SpreadsheetGateway.readObjects(DomainConstants.SHEETS.USERS).find(function (row) {
      return row.line_user_id === lineUserId;
    }) || null;
  }

  // 人を足す
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
  // 立場を membership_id でさがす
  function findByMembershipId(membershipId) {
    return SpreadsheetGateway.readObjects(DomainConstants.SHEETS.MEMBERSHIPS).find(function (row) {
      return row.membership_id === membershipId;
    }) || null;
  }

  // その教室の、その人の使える立場（ACTIVE）をさがす
  function findFirstActiveByTenantIdAndUserId(tenantId, userId) {
    return SpreadsheetGateway.readObjects(DomainConstants.SHEETS.MEMBERSHIPS).find(function (row) {
      return row.tenant_id === tenantId
        && row.user_id === userId
        && row.status === DomainConstants.MEMBERSHIP_STATUS.ACTIVE;
    }) || null;
  }

  // その教室の、その人の立場の一覧（ACTIVE でないものも）
  function listByTenantIdAndUserId(tenantId, userId) {
    return SpreadsheetGateway.readObjects(DomainConstants.SHEETS.MEMBERSHIPS).filter(function (row) {
      return row.tenant_id === tenantId && row.user_id === userId;
    });
  }

  // 立場を足す
  function append(record) {
    SpreadsheetGateway.appendObject(DomainConstants.SHEETS.MEMBERSHIPS, record);
    return record;
  }

  return {
    findByMembershipId: findByMembershipId,
    findFirstActiveByTenantIdAndUserId: findFirstActiveByTenantIdAndUserId,
    listByTenantIdAndUserId: listByTenantIdAndUserId,
    append: append
  };
})();

var FeatureEntitlementSheetRepository = (function () {
  // 教室の使える機能の一覧
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
  // 教室の使える問題（ACTIVE）の一覧
  function listActiveByTenantId(tenantId) {
    return SpreadsheetGateway.readObjects(DomainConstants.SHEETS.QUESTIONS).filter(function (row) {
      return row.tenant_id === tenantId && row.status === "ACTIVE";
    });
  }

  // 問題を ID でさがす
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
  // 問題の正解の設定をさがす
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

  // その人の回の一覧
  function listByMembershipId(membershipId) {
    return listAll_().filter(function (row) {
      return row.membership_id === membershipId;
    });
  }

  // 回を ID でさがす
  function findByLearningSessionId(learningSessionId) {
    return listAll_().find(function (row) {
      return row.learning_session_id === learningSessionId;
    }) || null;
  }

  // その人の、その日の今日の回をさがす
  function findDailyByMembershipAndBusinessDate(membershipId, businessDate) {
    return listByMembershipId(membershipId).find(function (row) {
      return row.session_type === DomainConstants.SESSION_TYPE.DAILY && row.business_date === businessDate;
    }) || null;
  }

  // 回を足す
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
  // 回の問題の一覧
  function listByLearningSessionId(learningSessionId) {
    return SpreadsheetGateway.readObjects(DomainConstants.SHEETS.SESSION_QUESTIONS).filter(function (row) {
      return row.learning_session_id === learningSessionId;
    });
  }

  // 回の問題をまとめて足す
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
  // その人の答えの一覧（シートの順）
  function listByMembershipId(membershipId) {
    return SpreadsheetGateway.readObjects(DomainConstants.SHEETS.ANSWER_EVENTS).filter(function (row) {
      return row.membership_id === membershipId;
    });
  }

  // 答えを足す
  function append(record) {
    SpreadsheetGateway.appendObject(DomainConstants.SHEETS.ANSWER_EVENTS, record);
    return record;
  }

  // 回と idempotencyKey が同じ答えをさがす（同じ答えを2回残さないため）
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
  // 提出コードでさがす
  function findByReceiptCode(receiptCode) {
    return SpreadsheetGateway.readObjects(DomainConstants.SHEETS.SHARE_RECEIPTS).find(function (row) {
      return row.receipt_code === receiptCode;
    }) || null;
  }

  // 回の提出コードをさがす
  function findByLearningSessionId(learningSessionId) {
    return SpreadsheetGateway.readObjects(DomainConstants.SHEETS.SHARE_RECEIPTS).find(function (row) {
      return row.learning_session_id === learningSessionId;
    }) || null;
  }

  // 提出コードを足す
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
