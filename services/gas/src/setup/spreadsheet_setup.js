function setupLearningPlatformSheets() {
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
    { name: "debug_logs", headers: ["log_id", "request_id", "level", "request_method", "action", "route_type", "status", "error_code", "error_message", "duration_ms", "event_count", "user_id", "membership_id", "line_user_id", "request_summary", "response_summary", "created_at"] }
  ];

  definitions.forEach(function (definition) {
    ensureSheet_(spreadsheet, definition.name, definition.headers);
  });
}

function seedLearningPlatformMvp() {
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

  return {
    ok: true,
    seeded: true,
    tenantId: tenantId,
    userId: userId,
    membershipId: membershipId
  };
}

function initializeLearningPlatformMvp() {
  setupLearningPlatformSheets();
  var result = seedLearningPlatformMvp();

  return {
    ok: true,
    message: "Spreadsheet schema and MVP seed data were initialized.",
    result: result
  };
}

function setupLearningPlatformScriptProperties() {
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

  ScriptConfig.setProperties(defaults);

  return {
    ok: true,
    message: "Default script properties were set. Replace placeholder values before production use.",
    defaults: defaults
  };
}

function authorizeLearningPlatformExternalRequest() {
  var response = UrlFetchApp.fetch("https://www.google.com/generate_204", {
    method: "get",
    muteHttpExceptions: true
  });

  return {
    ok: true,
    message: "External request authorization succeeded.",
    statusCode: response.getResponseCode()
  };
}

function inspectLearningPlatformLineSetup() {
  var config = ScriptConfig.getLineMessagingConfig();
  var token = config.channelAccessToken || "";
  var destination = config.systemAdminLineUserId || "";

  return {
    ok: true,
    appBaseUrl: config.appBaseUrl || "",
    defaultTenantId: config.defaultTenantId || "",
    liffId: config.liffId || "",
    systemAdminLineUserId: destination,
    hasChannelAccessToken: !!token,
    maskedChannelAccessToken: maskToken_(token),
    checks: {
      externalRequestScopeReady: true,
      pushDestinationReady: !!destination,
      channelAccessTokenReady: !!token
    }
  };
}

function authorizeLearningPlatformLineMessaging() {
  var setup = inspectLearningPlatformLineSetup();
  var externalRequest = authorizeLearningPlatformExternalRequest();

  return {
    ok: true,
    message: "Manual authorization path completed on the host GAS project.",
    setup: setup,
    externalRequest: externalRequest
  };
}

function pushSystemAdminLineTestMessage() {
  var config = ScriptConfig.getLineMessagingConfig();
  var destination = config.systemAdminLineUserId;

  if (!destination) {
    throw AppError.validation(
      "missing_system_admin_line_user_id",
      "Set SYSTEM_ADMIN_LINE_USER_ID or SYSTEM_ADMIN_LINE before sending a test push."
    );
  }

  var now = new Date();
  var appBaseUrl = config.appBaseUrl || "";
  var messages = [{
    type: "text",
    text: [
      "LearningPlatform 管理通知テスト",
      "日時: " + now.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }),
      "送信先: " + destination,
      appBaseUrl ? "App: " + appBaseUrl : ""
    ].filter(function (line) {
      return !!line;
    }).join("\n")
  }];

  var result = LineMessagingClient.pushMessage(destination, messages);

  return {
    ok: true,
    message: "System admin LINE push message sent.",
    destination: destination,
    result: result
  };
}

function authorizeAndPushSystemAdminLineTestMessage() {
  var authorization = authorizeLearningPlatformLineMessaging();
  var pushResult = pushSystemAdminLineTestMessage();

  return {
    ok: true,
    message: "Authorization and LINE push test completed.",
    authorization: authorization,
    push: pushResult
  };
}

function ensureSheet_(spreadsheet, name, headers) {
  var sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }
}

function requireValue_(value, keyName) {
  if (!value) {
    throw AppError.validation("missing_setup_value", keyName + " is required for seeding");
  }

  return value;
}

function maskToken_(token) {
  if (!token) {
    return "";
  }

  if (token.length <= 10) {
    return token;
  }

  return token.slice(0, 6) + "..." + token.slice(-4);
}

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

function seedCourseAndQuestionData_(tenantId, now) {
  var courseId = "course_demo_001";
  var categoryId = "category_demo_001";
  var unitId = "unit_demo_001";
  var trialQuestions = [
    createTrialQuestionSet_(tenantId, courseId, categoryId, unitId, {
      id: "question_demo_001",
      text: "「一つ」の読み方は？",
      answer: "ひとつ",
      explanation: "「一つ」は「ひとつ」と読みます。"
    }, now),
    createTrialQuestionSet_(tenantId, courseId, categoryId, unitId, {
      id: "question_demo_002",
      text: "「右手」の読み方は？",
      answer: "みぎて",
      explanation: "「右手」は「みぎて」と読みます。"
    }, now),
    createTrialQuestionSet_(tenantId, courseId, categoryId, unitId, {
      id: "question_demo_003",
      text: "「大雨」の読み方は？",
      answer: "おおあめ",
      explanation: "「大雨」は「おおあめ」と読みます。"
    }, now),
    createTrialQuestionSet_(tenantId, courseId, categoryId, unitId, {
      id: "question_demo_004",
      text: "「百円」の読み方は？",
      answer: "ひゃくえん",
      explanation: "「百円」は「ひゃくえん」と読みます。"
    }, now),
    createTrialQuestionSet_(tenantId, courseId, categoryId, unitId, {
      id: "question_demo_005",
      text: "「王様」の読み方は？",
      answer: "おうさま",
      explanation: "「王様」は「おうさま」と読みます。"
    }, now),
    createTrialQuestionSet_(tenantId, courseId, categoryId, unitId, {
      id: "question_demo_006",
      text: "「足音」の読み方は？",
      answer: "あしおと",
      explanation: "「足音」は「あしおと」と読みます。"
    }, now),
    createTrialQuestionSet_(tenantId, courseId, categoryId, unitId, {
      id: "question_demo_007",
      text: "「下水」の読み方は？",
      answer: "げすい",
      explanation: "「下水」は「げすい」と読みます。"
    }, now),
    createTrialQuestionSet_(tenantId, courseId, categoryId, unitId, {
      id: "question_demo_008",
      text: "「花火」の読み方は？",
      answer: "はなび",
      explanation: "「花火」は「はなび」と読みます。"
    }, now),
    createTrialQuestionSet_(tenantId, courseId, categoryId, unitId, {
      id: "question_demo_009",
      text: "「花見」の読み方は？",
      answer: "はなみ",
      explanation: "「花見」は「はなみ」と読みます。"
    }, now),
    createTrialQuestionSet_(tenantId, courseId, categoryId, unitId, {
      id: "question_demo_010",
      text: "「貝がら」の読み方は？",
      answer: "かいがら",
      explanation: "「貝がら」は「かいがら」と読みます。"
    }, now),
    createTrialQuestionSet_(tenantId, courseId, categoryId, unitId, {
      id: "question_demo_011",
      text: "「学校」の読み方は？",
      answer: "がっこう",
      explanation: "「学校」は「がっこう」と読みます。"
    }, now),
    createTrialQuestionSet_(tenantId, courseId, categoryId, unitId, {
      id: "question_demo_012",
      text: "「天気」の読み方は？",
      answer: "てんき",
      explanation: "「天気」は「てんき」と読みます。"
    }, now),
    createTrialQuestionSet_(tenantId, courseId, categoryId, unitId, {
      id: "question_demo_013",
      text: "「九つ」の読み方は？",
      answer: "ここのつ",
      explanation: "「九つ」は「ここのつ」と読みます。"
    }, now),
    createTrialQuestionSet_(tenantId, courseId, categoryId, unitId, {
      id: "question_demo_014",
      text: "「休み」の読み方は？",
      answer: "やすみ",
      explanation: "「休み」は「やすみ」と読みます。"
    }, now),
    createTrialQuestionSet_(tenantId, courseId, categoryId, unitId, {
      id: "question_demo_015",
      text: "「目玉」の読み方は？",
      answer: "めだま",
      explanation: "「目玉」は「めだま」と読みます。"
    }, now),
    createTrialQuestionSet_(tenantId, courseId, categoryId, unitId, {
      id: "question_demo_016",
      text: "「お金」の読み方は？",
      answer: "おかね",
      explanation: "「お金」は「おかね」と読みます。"
    }, now),
    createTrialQuestionSet_(tenantId, courseId, categoryId, unitId, {
      id: "question_demo_017",
      text: "「青空」の読み方は？",
      answer: "あおぞら",
      explanation: "「青空」は「あおぞら」と読みます。"
    }, now),
    createTrialQuestionSet_(tenantId, courseId, categoryId, unitId, {
      id: "question_demo_018",
      text: "「月見」の読み方は？",
      answer: "つきみ",
      explanation: "「月見」は「つきみ」と読みます。"
    }, now),
    createTrialQuestionSet_(tenantId, courseId, categoryId, unitId, {
      id: "question_demo_019",
      text: "「子犬」の読み方は？",
      answer: "こいぬ",
      explanation: "「子犬」は「こいぬ」と読みます。"
    }, now),
    createTrialQuestionSet_(tenantId, courseId, categoryId, unitId, {
      id: "question_demo_020",
      text: "「見学」の読み方は？",
      answer: "けんがく",
      explanation: "「見学」は「けんがく」と読みます。"
    }, now),
    createTrialQuestionSet_(tenantId, courseId, categoryId, unitId, {
      id: "question_demo_021",
      text: "「入口」の読み方は？",
      answer: "いりぐち",
      explanation: "「入口」は「いりぐち」と読みます。"
    }, now),
    createTrialQuestionSet_(tenantId, courseId, categoryId, unitId, {
      id: "question_demo_022",
      text: "「高校」の読み方は？",
      answer: "こうこう",
      explanation: "「高校」は「こうこう」と読みます。"
    }, now),
    createTrialQuestionSet_(tenantId, courseId, categoryId, unitId, {
      id: "question_demo_023",
      text: "「左折」の読み方は？",
      answer: "させつ",
      explanation: "「左折」は「させつ」と読みます。"
    }, now),
    createTrialQuestionSet_(tenantId, courseId, categoryId, unitId, {
      id: "question_demo_024",
      text: "「三日」の読み方は？",
      answer: "みっか",
      explanation: "「三日」は「みっか」と読みます。"
    }, now),
    createTrialQuestionSet_(tenantId, courseId, categoryId, unitId, {
      id: "question_demo_025",
      text: "「富士山」の読み方は？",
      answer: "ふじさん",
      explanation: "「富士山」は「ふじさん」と読みます。"
    }, now),
    createTrialQuestionSet_(tenantId, courseId, categoryId, unitId, {
      id: "question_demo_026",
      text: "「子供」の読み方は？",
      answer: "こども",
      explanation: "「子供」は「こども」と読みます。"
    }, now),
    createTrialQuestionSet_(tenantId, courseId, categoryId, unitId, {
      id: "question_demo_027",
      text: "「四角」の読み方は？",
      answer: "しかく",
      explanation: "「四角」は「しかく」と読みます。"
    }, now),
    createTrialQuestionSet_(tenantId, courseId, categoryId, unitId, {
      id: "question_demo_028",
      text: "「毛糸」の読み方は？",
      answer: "けいと",
      explanation: "「毛糸」は「けいと」と読みます。"
    }, now),
    createTrialQuestionSet_(tenantId, courseId, categoryId, unitId, {
      id: "question_demo_029",
      text: "「文字」の読み方は？",
      answer: "もじ",
      explanation: "「文字」は「もじ」と読みます。"
    }, now),
    createTrialQuestionSet_(tenantId, courseId, categoryId, unitId, {
      id: "question_demo_030",
      text: "「耳元」の読み方は？",
      answer: "みみもと",
      explanation: "「耳元」は「みみもと」と読みます。"
    }, now)
  ];

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
