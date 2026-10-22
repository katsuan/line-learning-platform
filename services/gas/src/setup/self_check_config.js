// 使う前の確かめ（GAS エディタで qCheckAll を実行する）。何を確かめるかをここに書く。
// 何も書きこまず、LINE にも送らない。結果は実行ログに ✅ ⚠️ ❌ で出る。
var Q_SELF_CHECK = {
  properties: ["SPREADSHEET_ID", "LINE_CHANNEL_ACCESS_TOKEN", "LIFF_ID", "APP_BASE_URL", "DEFAULT_TENANT_ID", "SYSTEM_ADMIN_LINE_USER_ID", "WEBHOOK_KEY"],
  secretProperties: ["LINE_CHANNEL_ACCESS_TOKEN", "LINE_CHANNEL_SECRET", "WEBHOOK_KEY"],
  spreadsheetId: function () {
    return PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  },
  sheets: {
    tenants: ["tenant_id", "tenant_key", "name"],
    users: ["user_id", "line_user_id", "display_name", "photo_url"],
    memberships: ["membership_id", "tenant_id", "user_id", "role", "status"],
    questions: ["question_id", "tenant_id", "course_id", "category_id", "unit_id", "question_type"],
    question_grading_configs: ["question_grading_config_id", "tenant_id", "question_id", "answer_schema", "correct_answer_payload", "tolerance", "max_score"],
    learning_sessions: ["learning_session_id", "tenant_id", "user_id", "membership_id"],
    session_questions: ["session_question_id", "tenant_id", "learning_session_id", "question_id"],
    answer_events: ["answer_event_id", "tenant_id", "learning_session_id", "session_question_id", "question_id", "user_id", "membership_id"],
    share_receipts: ["share_receipt_id", "tenant_id", "learning_session_id", "membership_id"],
    debug_logs: ["log_id", "request_id"]
  },
  lineTokenProperty: "LINE_CHANNEL_ACCESS_TOKEN",
  // debug_logs の古い行を消す仕事が、26 時間以内に動いたか
  heartbeats: { cleanupOldDebugLogs: 1560 },
  // ボットの返事のカード（ふつうの人・管理者）が、LINE に受けつけられる形か
  cards: function () {
    var texts = ["5問", "記録", "ヘルプ", "導入相談"];
    var learner = texts.map(function (text) {
      return LineMessageBuilder.toSendable(LineMessageBuilder.buildReplyMessages({
        event: { type: "message", source: { type: "user", userId: "Uselfcheck" }, message: { type: "text", text: text } }
      }))[0];
    });
    var admin = ScriptConfig.getLineMessagingConfig().systemAdminLineUserId;
    if (admin) {
      learner.push(LineMessageBuilder.toSendable(LineMessageBuilder.buildReplyMessages({
        event: { type: "message", source: { type: "user", userId: admin }, message: { type: "text", text: "管理" } }
      }))[0]);
    }
    return learner;
  }
};
