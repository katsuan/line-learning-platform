// 答えを残すところ（createAnswerEvent）。
// 中身：CreateAnswerEventUsecase（正誤と点数はサーバーで決め、同じ答えは2回残さない）。
// 呼ぶところ：02_router.request.js（learn.html で答えたとき）。
// 答えを残すのは、自分の今日の回の、その回の問題だけ。正誤と点数はサーバーで決める。
var CreateAnswerEventUsecase = (function () {
  // 自分の回の問題への答えを1つ残す。同じ idempotencyKey なら前のものを返す
  function execute(request) {
    var me = MeUsecase.execute(request);
    var body = request.body || {};
    var learningSessionId = InputLimits.id(body.learningSessionId);
    var sessionQuestionId = InputLimits.id(body.sessionQuestionId);
    var idempotencyKey = InputLimits.text(body.idempotencyKey, 200);

    if (!learningSessionId || !sessionQuestionId || !idempotencyKey) {
      throw AppError.validation("missing_field", "learningSessionId, sessionQuestionId and idempotencyKey are required");
    }

    var session = LearningSessionSheetRepository.findByLearningSessionId(learningSessionId);
    if (!session || session.membership_id !== me.membership.membership_id) {
      throw AppError.notFound("learning_session_not_found", "learning session was not found");
    }

    var sessionQuestion = SessionQuestionSheetRepository.listByLearningSessionId(learningSessionId).find(function (row) {
      return row.session_question_id === sessionQuestionId;
    });
    if (!sessionQuestion) {
      throw AppError.notFound("session_question_not_found", "question was not found in this session");
    }

    var value = body.answerPayload && typeof body.answerPayload === "object" ? body.answerPayload.value : undefined;
    if (typeof value === "string") {
      value = value.slice(0, 500);
    } else if (value !== undefined && value !== null && typeof value !== "number" && typeof value !== "boolean") {
      value = String(value).slice(0, 500);
    }

    var question = QuestionSheetRepository.findByQuestionId(sessionQuestion.question_id);
    var gradingConfig = QuestionGradingConfigSheetRepository.findByQuestionId(sessionQuestion.question_id);
    var graded = AnswerGrader.grade(question ? question.question_type : "", gradingConfig, value);

    return ScriptLock.run(function () {
      var existing = AnswerEventSheetRepository.findBySessionAndIdempotencyKey(learningSessionId, idempotencyKey);
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
        learning_session_id: learningSessionId,
        session_question_id: sessionQuestionId,
        question_id: sessionQuestion.question_id,
        user_id: me.user.user_id,
        membership_id: me.membership.membership_id,
        attempt_no: InputLimits.number(body.attemptNo, 1, 100, 1),
        idempotency_key: idempotencyKey,
        answer_payload: JSON.stringify({ value: value === undefined ? null : value }),
        is_correct: graded.isCorrect ? "true" : "false",
        score: graded.score,
        elapsed_ms: InputLimits.number(body.elapsedMs, 0, 86400000, 0),
        hint_used: body.hintUsed === true ? "true" : "false",
        explanation_viewed: body.explanationViewed === true ? "true" : "false",
        answered_at: now,
        synced_at: now
      };

      AnswerEventSheetRepository.append(record);

      return {
        ok: true,
        duplicated: false,
        answerEventId: record.answer_event_id,
        isCorrect: graded.isCorrect,
        score: graded.score
      };
    });
  }

  return {
    execute: execute
  };
})();
