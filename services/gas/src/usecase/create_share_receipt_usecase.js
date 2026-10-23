var CreateShareReceiptUsecase = (function () {
  function execute(request) {
    var me = MeUsecase.execute(request);
    var body = request.body || {};
    var learningSessionId = InputLimits.id(body.learningSessionId);

    if (!learningSessionId) {
      throw AppError.validation("missing_learning_session_id", "learningSessionId is required");
    }

    var session = LearningSessionSheetRepository.findByLearningSessionId(learningSessionId);
    if (!session || session.membership_id !== me.membership.membership_id) {
      throw AppError.notFound("learning_session_not_found", "learning session was not found");
    }

    return ScriptLock.run(function () {
      return createOnce_(me, body, session);
    });
  }

  function createOnce_(me, body, session) {
    var learningSessionId = session.learning_session_id;
    var existing = ShareReceiptSheetRepository.findByLearningSessionId(learningSessionId);
    if (existing) {
      return {
        ok: true,
        duplicated: true,
        receipt: toReceiptResponse_(existing)
      };
    }

    var score = scoreSession_(session);
    var now = new Date().toISOString();
    var receiptRecord = {
      share_receipt_id: "share_receipt_" + Utilities.getUuid(),
      tenant_id: me.tenant.tenant_id,
      learning_session_id: learningSessionId,
      membership_id: me.membership.membership_id,
      user_id: me.user.user_id,
      line_user_id: me.user.line_user_id || "",
      learner_name: InputLimits.text(me.user.display_name, InputLimits.MAX.displayName) || "学習者",
      receipt_code: generateReceiptCode_(),
      total_questions: score.total,
      correct_count: score.correct,
      accuracy_rate: score.accuracyRate,
      share_channel: InputLimits.text(body.shareChannel, InputLimits.MAX.shareChannel),
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

  // 点数は、サーバーに残った答えから数える（同じ問題は、さいごの答え）
  function scoreSession_(session) {
    var latest = {};
    AnswerEventSheetRepository.listByMembershipId(session.membership_id).forEach(function (row) {
      if (row.learning_session_id === session.learning_session_id) {
        latest[row.session_question_id] = row;
      }
    });
    var total = Number(session.question_count || 0);
    var correct = Object.keys(latest).filter(function (key) {
      return AnswerStats.isCorrect(latest[key]);
    }).length;
    return {
      total: total,
      correct: correct,
      accuracyRate: total === 0 ? 0 : Math.round((correct / total) * 100)
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
