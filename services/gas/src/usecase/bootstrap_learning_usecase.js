var BootstrapLearningUsecase = (function () {
  function execute(request) {
    var me = MeUsecase.execute(request);
    var businessDate = DatePolicy.todayBusinessDate();
    var sessionResult = resolveDailySessionForMe_(me, businessDate);
    var answerEvents = AnswerEventSheetRepository.listByMembershipId(me.membership.membership_id);
    var totalAnsweredCount = answerEvents.length;
    var correctCount = answerEvents.filter(function (row) {
      return row.is_correct === true || row.is_correct === "true";
    }).length;

    return {
      me: me,
      home: {
        todaySession: sessionResult.session || null,
        resumableSession: sessionResult.session && sessionResult.session.status !== DomainConstants.SESSION_STATUS.COMPLETED
          ? sessionResult.session
          : null,
        learningSummary: {
          totalAnsweredCount: totalAnsweredCount,
          accuracyRate: totalAnsweredCount === 0 ? 0 : Number((correctCount / totalAnsweredCount).toFixed(2)),
          lastLearnedAt: answerEvents.length ? answerEvents[answerEvents.length - 1].answered_at : null
        }
      },
      session: sessionResult.session,
      reused: sessionResult.reused
    };
  }

  function resolveDailySessionForMe_(me, businessDate) {
    var existingSession = LearningSessionSheetRepository.findDailyByMembershipAndBusinessDate(
      me.membership.membership_id,
      businessDate
    );

    if (existingSession) {
      return {
        session: SessionPresenter.toSummary(existingSession),
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

  return {
    execute: execute
  };
})();
