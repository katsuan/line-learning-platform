// 答えを残すところ（createAnswerEvent）。
// 中身：CreateAnswerEventUsecase（正誤と点数はサーバーで決め、同じ答えは2回残さない）。
// 呼ぶところ：02_router.request.js（learn.html で答えたとき）。
// 答えを残すのは、自分の今日の回の、その回の問題だけ。正誤と点数はサーバーで決める。
var CreateAnswerEventUsecase = (function () {
  // 自分の回の問題への答えを1つ残す。同じ idempotencyKey なら前のものを返す
  function execute(request) {
    var me = MeUsecase.execute(request);
    var body = request.body || {};
    var target = requireOwnSessionQuestion_(me, body);
    var value = normalizeValue_(body.answerPayload);
    var question = QuestionSheetRepository.findByQuestionId(target.sessionQuestion.question_id);
    var gradingConfig = QuestionGradingConfigSheetRepository.findByQuestionId(target.sessionQuestion.question_id);
    var graded = AnswerGrader.grade(question ? question.question_type : "", gradingConfig, value);

    return ScriptLock.run(function () {
      var existing = AnswerEventSheetRepository.findBySessionAndIdempotencyKey(target.learningSessionId, target.idempotencyKey);
      if (existing) {
        return {
          ok: true,
          duplicated: true,
          answerEventId: existing.answer_event_id
        };
      }

      var record = buildRecord_(me, body, target, value, graded);
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

  // 送られた回と問題が、本人の回のものかを確かめる。ちがえば断る。回の ID・問題・idempotencyKey を返す
  function requireOwnSessionQuestion_(me, body) {
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

    return {
      learningSessionId: learningSessionId,
      sessionQuestion: sessionQuestion,
      idempotencyKey: idempotencyKey
    };
  }

  // 答えの値を、文字（500 字まで）・数・真偽・なしのどれかにそろえる
  function normalizeValue_(answerPayload) {
    var value = answerPayload && typeof answerPayload === "object" ? answerPayload.value : undefined;
    if (typeof value === "string") {
      return value.slice(0, 500);
    }
    if (value !== undefined && value !== null && typeof value !== "number" && typeof value !== "boolean") {
      return String(value).slice(0, 500);
    }
    return value;
  }

  // answer_events の1行（正誤と点数はサーバーで決めたもの）
  function buildRecord_(me, body, target, value, graded) {
    var now = new Date().toISOString();
    return {
      answer_event_id: "answer_event_" + Utilities.getUuid(),
      tenant_id: me.tenant.tenant_id,
      learning_session_id: target.learningSessionId,
      session_question_id: target.sessionQuestion.session_question_id,
      question_id: target.sessionQuestion.question_id,
      user_id: me.user.user_id,
      membership_id: me.membership.membership_id,
      attempt_no: InputLimits.number(body.attemptNo, 1, 100, 1),
      idempotency_key: target.idempotencyKey,
      answer_payload: JSON.stringify({ value: value === undefined ? null : value }),
      is_correct: graded.isCorrect ? "true" : "false",
      score: graded.score,
      elapsed_ms: InputLimits.number(body.elapsedMs, 0, 86400000, 0),
      hint_used: body.hintUsed === true ? "true" : "false",
      explanation_viewed: body.explanationViewed === true ? "true" : "false",
      answered_at: now,
      synced_at: now
    };
  }

  return {
    execute: execute
  };
})();
