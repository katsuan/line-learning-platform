// 回（learning_sessions の行）を、画面に返す形にするところ。
// 中身：SessionPresenter（回と問題・進み具合）。
// 呼ぶところ：04_domain.learning_service.js。
var SessionPresenter = (function () {
  // 回を、問題の一覧と進み具合つきで返す（正解の設定も入る。画面ですぐ答え合わせするため）
  function toSummary(session) {
    var sessionQuestions = SessionQuestionSheetRepository.listByLearningSessionId(session.learning_session_id);
    var answeredCount = AnswerStats.answeredQuestionCount(
      session.learning_session_id,
      AnswerEventSheetRepository.listByMembershipId(session.membership_id)
    );

    return {
      sessionId: session.learning_session_id,
      sessionType: session.session_type,
      status: AnswerStats.sessionStatus(session, answeredCount),
      questionCount: toNumber_(session.question_count),
      completedCount: answeredCount,
      businessDate: session.business_date || "",
      courseId: session.course_id || "",
      questions: sessionQuestions.map(function (row) {
        var question = QuestionSheetRepository.findByQuestionId(row.question_id);
        var gradingConfig = QuestionGradingConfigSheetRepository.findByQuestionId(row.question_id);
        return {
          sessionQuestionId: row.session_question_id,
          questionId: row.question_id,
          displayOrder: toNumber_(row.display_order),
          questionType: question ? question.question_type : "",
          gradingType: question ? question.grading_type : "",
          questionText: question ? question.question_text : "",
          explanation: question ? question.explanation : "",
          gradingConfig: normalizeGradingConfig_(gradingConfig)
        };
      })
    };
  }

  // 正解の設定を、画面で使う形にする
  function normalizeGradingConfig_(gradingConfig) {
    if (!gradingConfig) {
      return null;
    }

    return {
      answerSchema: JsonText.parse(gradingConfig.answer_schema),
      correctAnswerPayload: JsonText.parse(gradingConfig.correct_answer_payload),
      tolerance: gradingConfig.tolerance === "" ? null : Number(gradingConfig.tolerance || 0),
      maxScore: toNumber_(gradingConfig.max_score)
    };
  }


  // 数にする（空なら 0）
  function toNumber_(value) {
    return Number(value || 0);
  }

  return {
    toSummary: toSummary
  };
})();
