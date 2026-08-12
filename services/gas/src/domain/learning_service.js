var LearningService = (function () {
  function buildHomePayload(me, businessDate) {
    var todaySessionRecord = findDailySessionRecord_(me.membership.membership_id, businessDate);
    var todaySessionSummary = todaySessionRecord ? SessionPresenter.toSummary(todaySessionRecord) : null;
    var learningSummary = buildLearningSummary_(me.membership.membership_id);
    var todayAnswerEvents = todaySessionRecord
      ? listAnswerEventsByLearningSessionId_(todaySessionRecord.learning_session_id)
      : [];

    return {
      todaySession: todaySessionSummary,
      resumableSession: todaySessionSummary && todaySessionSummary.status !== DomainConstants.SESSION_STATUS.COMPLETED
        ? todaySessionSummary
        : null,
      learningSummary: learningSummary,
      todayAnswerEvents: todayAnswerEvents.map(function (row) {
        var answerPayload = parseJsonSafely_(row.answer_payload);
        return {
          sessionQuestionId: row.session_question_id,
          questionId: row.question_id,
          answerValue: answerPayload && answerPayload.value !== undefined && answerPayload.value !== null
            ? String(answerPayload.value)
            : "",
          isCorrect: row.is_correct === true || row.is_correct === "true",
          score: Number(row.score || 0),
          answeredAt: row.answered_at || ""
        };
      })
    };
  }

  function resolveDailySessionForMe(me, businessDate) {
    var existingSessionRecord = findDailySessionRecord_(me.membership.membership_id, businessDate);
    if (existingSessionRecord) {
      return {
        session: SessionPresenter.toSummary(existingSessionRecord),
        reused: true
      };
    }

    var questions = QuestionSheetRepository.listActiveByTenantId(me.tenant.tenant_id).slice(0, 5);
    if (questions.length === 0) {
      throw AppError.notFound(
        "questions_not_found",
        "No active questions were found for tenantId=" + me.tenant.tenant_id + ". Seed question data first."
      );
    }

    var now = new Date().toISOString();
    var sessionId = "session_" + Utilities.getUuid();
    var sessionRecord = {
      learning_session_id: sessionId,
      tenant_id: me.tenant.tenant_id,
      user_id: me.user.user_id,
      membership_id: me.membership.membership_id,
      course_id: questions[0].course_id,
      assignment_id: "",
      session_type: DomainConstants.SESSION_TYPE.DAILY,
      status: DomainConstants.SESSION_STATUS.CREATED,
      question_count: questions.length,
      started_at: "",
      completed_at: "",
      expires_at: "",
      business_date: businessDate,
      created_at: now
    };

    LearningSessionSheetRepository.append(sessionRecord);
    SessionQuestionSheetRepository.appendMany(questions.map(function (question, index) {
      return {
        session_question_id: "session_question_" + Utilities.getUuid(),
        tenant_id: me.tenant.tenant_id,
        learning_session_id: sessionId,
        question_id: question.question_id,
        display_order: index + 1,
        question_snapshot_payload: JSON.stringify({
          questionText: question.question_text,
          questionType: question.question_type,
          gradingType: question.grading_type
        }),
        created_at: now
      };
    }));

    return {
      session: SessionPresenter.toSummary(sessionRecord),
      reused: false
    };
  }

  function buildLearningSummary_(membershipId) {
    var answerEvents = AnswerEventSheetRepository.listByMembershipId(membershipId);
    var totalAnsweredCount = answerEvents.length;
    var correctCount = answerEvents.filter(function (row) {
      return row.is_correct === true || row.is_correct === "true";
    }).length;

    return {
      totalAnsweredCount: totalAnsweredCount,
      accuracyRate: totalAnsweredCount === 0 ? 0 : Number((correctCount / totalAnsweredCount).toFixed(2)),
      lastLearnedAt: answerEvents.length ? answerEvents[answerEvents.length - 1].answered_at : null
    };
  }

  function findDailySessionRecord_(membershipId, businessDate) {
    return LearningSessionSheetRepository.findDailyByMembershipAndBusinessDate(
      membershipId,
      businessDate
    );
  }

  function listAnswerEventsByLearningSessionId_(learningSessionId) {
    return SpreadsheetGateway.readObjects(DomainConstants.SHEETS.ANSWER_EVENTS).filter(function (row) {
      return row.learning_session_id === learningSessionId;
    });
  }

  function parseJsonSafely_(value) {
    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value);
    } catch (error) {
      return null;
    }
  }

  return {
    buildHomePayload: buildHomePayload,
    resolveDailySessionForMe: resolveDailySessionForMe
  };
})();
