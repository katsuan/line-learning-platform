// はじめの準備（人が 00_run.js から実行する関数の中身）。
// 中身：シートと見出しの一覧・見本の教室と問題の入れ方・見本の設定。見本の問題そのものは 09_setup.trial_questions.js。
// 呼ぶところ：00_run.js の setupLearningPlatformSheets・seedLearningPlatformMvp・setupLearningPlatformScriptProperties。
// 使うシートがなければ作り、見出しを入れる（あるシートの中身は変えない）
function ensureLearningPlatformSheets_() {
  var spreadsheet = SpreadsheetApp.openById(ScriptConfig.getSpreadsheetId());
  var definitions = [
    { name: "tenants", headers: ["tenant_id", "tenant_key", "name", "status", "timezone", "locale", "plan_code", "created_at", "updated_at"] },
    { name: "users", headers: ["user_id", "line_user_id", "display_name", "photo_url", "status", "created_at", "updated_at"] },
    { name: "memberships", headers: ["membership_id", "tenant_id", "user_id", "role", "status", "joined_at", "last_accessed_at", "created_at"] },
    { name: "feature_entitlements", headers: ["feature_entitlement_id", "tenant_id", "feature_key", "enabled", "limit_value", "period_type", "effective_from", "effective_to", "created_at", "updated_at"] },
    { name: "line_connections", headers: ["line_connection_id", "tenant_id", "channel_id", "channel_secret_ref", "channel_access_token_ref", "liff_id", "status", "created_at", "updated_at"] },
    { name: "courses", headers: ["course_id", "tenant_id", "source_type", "title", "description", "status", "created_at", "updated_at"] },
    { name: "categories", headers: ["category_id", "tenant_id", "course_id", "name", "sort_order"] },
    { name: "units", headers: ["unit_id", "tenant_id", "course_id", "category_id", "name", "sort_order"] },
    { name: "questions", headers: ["question_id", "tenant_id", "course_id", "category_id", "unit_id", "question_type", "grading_type", "question_text", "explanation", "difficulty", "status", "required_feature_key", "created_at", "updated_at"] },
    { name: "question_options", headers: ["question_option_id", "tenant_id", "question_id", "option_key", "label", "sort_order"] },
    { name: "question_grading_configs", headers: ["question_grading_config_id", "tenant_id", "question_id", "answer_schema", "correct_answer_payload", "tolerance", "max_score", "rubric_payload", "created_at", "updated_at"] },
    { name: "assignments", headers: ["assignment_id", "tenant_id", "course_id", "target_type", "target_id", "question_count", "start_at", "due_at", "created_by_membership_id", "status", "created_at", "updated_at"] },
    { name: "learning_sessions", headers: ["learning_session_id", "tenant_id", "user_id", "membership_id", "course_id", "assignment_id", "session_type", "status", "question_count", "started_at", "completed_at", "expires_at", "business_date", "created_at"] },
    { name: "session_questions", headers: ["session_question_id", "tenant_id", "learning_session_id", "question_id", "display_order", "question_snapshot_payload", "created_at"] },
    { name: "answer_events", headers: ["answer_event_id", "tenant_id", "learning_session_id", "session_question_id", "question_id", "user_id", "membership_id", "attempt_no", "idempotency_key", "answer_payload", "is_correct", "score", "elapsed_ms", "hint_used", "explanation_viewed", "answered_at", "synced_at"] },
    { name: "share_receipts", headers: ["share_receipt_id", "tenant_id", "learning_session_id", "membership_id", "user_id", "line_user_id", "learner_name", "receipt_code", "total_questions", "correct_count", "accuracy_rate", "share_channel", "created_at", "shared_at"] },
    { name: "debug_logs", headers: ["log_id", "request_id", "level", "request_method", "action", "route_type", "status", "error_code", "error_message", "duration_ms", "event_count", "user_id", "membership_id", "line_user_id", "request_summary", "response_summary", "created_at"] }
  ];

  definitions.forEach(function (definition) {
    ensureSheet_(spreadsheet, definition.name, definition.headers);
  });
}

// 見本の教室・学習者・使える機能・問題を入れ、学習の記録（回・答え・提出コード）を空にする
function seedLearningPlatformMvp_() {
  var config = ScriptConfig.getRequiredSetupConfig();
  var now = new Date().toISOString();
  var tenantId = requireValue_(config.defaultTenantId, "DEFAULT_TENANT_ID");
  var userId = requireValue_(config.defaultUserId, "DEFAULT_USER_ID");
  var membershipId = requireValue_(config.defaultMembershipId, "DEFAULT_MEMBERSHIP_ID");

  SpreadsheetGateway.replaceAllObjects("tenants", [{
    tenant_id: tenantId,
    tenant_key: config.defaultTenantKey,
    name: config.defaultTenantName,
    status: "ACTIVE",
    timezone: "Asia/Tokyo",
    locale: "ja-JP",
    plan_code: "FREE",
    created_at: now,
    updated_at: now
  }]);

  SpreadsheetGateway.replaceAllObjects("users", [{
    user_id: userId,
    line_user_id: config.defaultLineUserId,
    display_name: config.defaultUserName,
    photo_url: "",
    status: "ACTIVE",
    created_at: now,
    updated_at: now
  }]);

  SpreadsheetGateway.replaceAllObjects("memberships", [{
    membership_id: membershipId,
    tenant_id: tenantId,
    user_id: userId,
    role: config.defaultMembershipRole,
    status: "ACTIVE",
    joined_at: now,
    last_accessed_at: now,
    created_at: now
  }]);

  SpreadsheetGateway.replaceAllObjects("feature_entitlements", [
    createEntitlement_(tenantId, "dailyQuestions", true, 5, now),
    createEntitlement_(tenantId, "historyDays", true, 30, now),
    createEntitlement_(tenantId, "assignments", false, "", now),
    createEntitlement_(tenantId, "lineResultShare", true, 1, now),
    createEntitlement_(tenantId, "shareTargetPicker", false, 0, now)
  ]);

  seedCourseAndQuestionData_(tenantId, now);
  SpreadsheetGateway.replaceAllObjects("learning_sessions", []);
  SpreadsheetGateway.replaceAllObjects("session_questions", []);
  SpreadsheetGateway.replaceAllObjects("answer_events", []);
  SpreadsheetGateway.replaceAllObjects("share_receipts", []);

  return {
    ok: true,
    seeded: true,
    tenantId: tenantId,
    userId: userId,
    membershipId: membershipId
  };
}

// 見本の設定を Script Properties に入れる。まだない（空の）設定だけ入れ、入っている設定は変えない
function setDefaultScriptProperties_() {
  var defaults = {
    APP_BASE_URL: "https://example.github.io/LearningPlatform/",
    GITHUB_PAGES_URL: "https://example.github.io/LearningPlatform/",
    DEFAULT_TENANT_ID: "tenant_demo_001",
    DEFAULT_TENANT_KEY: "demo-tenant",
    DEFAULT_TENANT_NAME: "LearningPlatform Demo Tenant",
    DEFAULT_USER_ID: "user_demo_001",
    DEFAULT_USER_NAME: "Demo Learner",
    DEFAULT_LINE_USER_ID: "",
    SYSTEM_ADMIN_LINE_USER_ID: "",
    SYSTEM_ADMIN_LINE: "",
    DEFAULT_MEMBERSHIP_ID: "membership_demo_001",
    DEFAULT_MEMBERSHIP_ROLE: "LEARNER",
    ALLOWED_ORIGIN: "https://example.github.io"
  };

  // もう入っている設定は上書きしない（本物の値に直したあとで、もう一度実行しても消えない）
  var current = PropertiesService.getScriptProperties().getProperties() || {};
  var added = {};
  Object.keys(defaults).forEach(function (key) {
    if (current[key] === undefined || current[key] === "") {
      added[key] = defaults[key];
    }
  });
  ScriptConfig.setProperties(added);

  return {
    ok: true,
    message: "Default script properties were set only where empty. Replace placeholder values before production use.",
    defaults: added,
    kept: Object.keys(defaults).filter(function (key) { return !(key in added); })
  };
}

// シートがなければ作り、空なら見出しを入れて1行目を固定する
function ensureSheet_(spreadsheet, name, headers) {
  var sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }

  if (sheet.getLastRow() === 0) {
    // qcheck-ok: G1 見出しはコードで決めた文字だけ
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
}

// 値がなければ、設定の名前を入れたエラー
function requireValue_(value, keyName) {
  if (!value) {
    throw AppError.validation("missing_setup_value", keyName + " is required for seeding");
  }

  return value;
}

// 使える機能の1行
function createEntitlement_(tenantId, featureKey, enabled, limitValue, now) {
  return {
    feature_entitlement_id: tenantId + "_" + featureKey,
    tenant_id: tenantId,
    feature_key: featureKey,
    enabled: enabled ? "true" : "false",
    limit_value: limitValue,
    period_type: "",
    effective_from: now,
    effective_to: "",
    created_at: now,
    updated_at: now
  };
}

// 見本のコース・分類・単元・問題・正解の設定を入れる
function seedCourseAndQuestionData_(tenantId, now) {
  var courseId = "course_demo_001";
  var categoryId = "category_demo_001";
  var unitId = "unit_demo_001";
  var trialQuestions = TRIAL_QUESTIONS.map(function (definition) {
    return createTrialQuestionSet_(tenantId, courseId, categoryId, unitId, definition, now);
  });

  SpreadsheetGateway.replaceAllObjects("courses", [{
    course_id: courseId,
    tenant_id: tenantId,
    source_type: "TENANT",
    title: "かんじパーク 5問体験",
    description: "kanji-park の問題を再利用した個人体験用の5問コース",
    status: "ACTIVE",
    created_at: now,
    updated_at: now
  }]);

  SpreadsheetGateway.replaceAllObjects("categories", [{
    category_id: categoryId,
    tenant_id: tenantId,
    course_id: courseId,
    name: "まずは体験",
    sort_order: 1
  }]);

  SpreadsheetGateway.replaceAllObjects("units", [{
    unit_id: unitId,
    tenant_id: tenantId,
    course_id: courseId,
    category_id: categoryId,
    name: "小学1年生レベル 漢字読み",
    sort_order: 1
  }]);

  SpreadsheetGateway.replaceAllObjects("questions", trialQuestions.map(function (entry) {
    return entry.question;
  }));

  SpreadsheetGateway.replaceAllObjects("question_grading_configs", trialQuestions.map(function (entry) {
    return entry.gradingConfig;
  }));

  SpreadsheetGateway.replaceAllObjects("question_options", []);
}

// 見本の問題の1組（問題と正解の設定）
function createTrialQuestionSet_(tenantId, courseId, categoryId, unitId, definition, now) {
  return {
    question: createQuestion_(
      tenantId,
      courseId,
      categoryId,
      unitId,
      definition.id,
      "TEXT_EXACT",
      "AUTO",
      definition.text,
      definition.explanation,
      now
    ),
    gradingConfig: createGradingConfig_(
      definition.id,
      tenantId,
      { type: "string" },
      { exact: definition.answer },
      "",
      now
    )
  };
}

// 問題の1行
function createQuestion_(tenantId, courseId, categoryId, unitId, questionId, questionType, gradingType, questionText, explanation, now) {
  return {
    question_id: questionId,
    tenant_id: tenantId,
    course_id: courseId,
    category_id: categoryId,
    unit_id: unitId,
    question_type: questionType,
    grading_type: gradingType,
    question_text: questionText,
    explanation: explanation,
    difficulty: 1,
    status: "ACTIVE",
    required_feature_key: "",
    created_at: now,
    updated_at: now
  };
}

// 正解の設定の1行
function createGradingConfig_(questionId, tenantId, answerSchema, correctAnswerPayload, tolerance, now) {
  return {
    question_grading_config_id: "grading_" + questionId,
    tenant_id: tenantId,
    question_id: questionId,
    answer_schema: JSON.stringify(answerSchema),
    correct_answer_payload: JSON.stringify(correctAnswerPayload),
    tolerance: tolerance,
    max_score: 1,
    rubric_payload: "",
    created_at: now,
    updated_at: now
  };
}
