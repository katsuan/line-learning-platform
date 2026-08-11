var CreateAnswerEventUsecase = (function () {
  function execute(request) {
    var me = MeUsecase.execute(request);
    var body = request.body || {};
    var requiredFields = ["learningSessionId", "sessionQuestionId", "questionId", "idempotencyKey"];

    requiredFields.forEach(function (field) {
      if (!body[field]) {
        throw AppError.validation("missing_field", field + " is required");
      }
    });

    var existing = AnswerEventSheetRepository.findBySessionAndIdempotencyKey(body.learningSessionId, body.idempotencyKey);
    if (existing) {
      return {
        ok: true,
        duplicated: true,
        answerEventId: existing.answer_event_id
      };
    }

    var now = new Date().toISOString();
    var record = {
      answer_event_id: "answer_event_" + Utilities.getUuid(),
      tenant_id: me.tenant.tenant_id,
      learning_session_id: body.learningSessionId,
      session_question_id: body.sessionQuestionId,
      question_id: body.questionId,
      user_id: me.user.user_id,
      membership_id: me.membership.membership_id,
      attempt_no: body.attemptNo || 1,
      idempotency_key: body.idempotencyKey,
      answer_payload: JSON.stringify(body.answerPayload || {}),
      is_correct: body.isCorrect === true ? "true" : "false",
      score: body.score !== undefined ? body.score : 0,
      elapsed_ms: body.elapsedMs || 0,
      hint_used: body.hintUsed === true ? "true" : "false",
      explanation_viewed: body.explanationViewed === true ? "true" : "false",
      answered_at: now,
      synced_at: now
    };

    AnswerEventSheetRepository.append(record);

    return {
      ok: true,
      duplicated: false,
      answerEventId: record.answer_event_id
    };
  }

  return {
    execute: execute
  };
})();
