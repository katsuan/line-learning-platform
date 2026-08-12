var CreateShareReceiptUsecase = (function () {
  function execute(request) {
    var me = MeUsecase.execute(request);
    var body = request.body || {};
    var learningSessionId = body.learningSessionId || "";

    if (!learningSessionId) {
      throw AppError.validation("missing_learning_session_id", "learningSessionId is required");
    }

    var session = LearningSessionSheetRepository.findByLearningSessionId(learningSessionId);
    if (!session || session.membership_id !== me.membership.membership_id) {
      throw AppError.notFound("learning_session_not_found", "learning session was not found");
    }

    var existing = ShareReceiptSheetRepository.findByLearningSessionId(learningSessionId);
    if (existing) {
      return {
        ok: true,
        duplicated: true,
        receipt: toReceiptResponse_(existing)
      };
    }

    var now = new Date().toISOString();
    var receiptRecord = {
      share_receipt_id: "share_receipt_" + Utilities.getUuid(),
      tenant_id: me.tenant.tenant_id,
      learning_session_id: learningSessionId,
      membership_id: me.membership.membership_id,
      user_id: me.user.user_id,
      line_user_id: me.user.line_user_id || "",
      learner_name: me.user.display_name || "学習者",
      receipt_code: generateReceiptCode_(),
      total_questions: Number(body.totalQuestions || 0),
      correct_count: Number(body.correctCount || 0),
      accuracy_rate: Number(body.accuracyRate || 0),
      share_channel: body.shareChannel || "",
      created_at: now,
      shared_at: now
    };

    ShareReceiptSheetRepository.append(receiptRecord);

    return {
      ok: true,
      duplicated: false,
      receipt: toReceiptResponse_(receiptRecord)
    };
  }

  function toReceiptResponse_(record) {
    return {
      receiptCode: record.receipt_code,
      learnerName: record.learner_name,
      learningSessionId: record.learning_session_id,
      totalQuestions: Number(record.total_questions || 0),
      correctCount: Number(record.correct_count || 0),
      accuracyRate: Number(record.accuracy_rate || 0),
      shareChannel: record.share_channel || "",
      sharedAt: record.shared_at || record.created_at || ""
    };
  }

  function generateReceiptCode_() {
    var alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    var code = "";
    var uuid;
    var index;

    do {
      uuid = Utilities.getUuid().replace(/-/g, "");
      code = "LPR-";
      for (index = 0; index < 6; index += 1) {
        code += alphabet.charAt(parseInt(uuid.charAt(index), 16) % alphabet.length);
      }
    } while (ShareReceiptSheetRepository.findByReceiptCode(code));

    return code;
  }

  return {
    execute: execute
  };
})();
