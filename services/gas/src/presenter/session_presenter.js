var SessionPresenter = (function () {
  function toSummary(session) {
    var sessionQuestions = SessionQuestionSheetRepository.listByLearningSessionId(session.learning_session_id);

    return {
      sessionId: session.learning_session_id,
      sessionType: session.session_type,
      status: session.status,
      questionCount: toNumber_(session.question_count),
      completedCount: 0,
      businessDate: session.business_date || "",
      courseId: session.course_id || "",
      questions: sessionQuestions.map(function (row) {
        var question = QuestionSheetRepository.findByQuestionId(row.question_id);
        return {
          sessionQuestionId: row.session_question_id,
          questionId: row.question_id,
          displayOrder: toNumber_(row.display_order),
          questionType: question ? question.question_type : "",
          gradingType: question ? question.grading_type : "",
          questionText: question ? question.question_text : ""
        };
      })
    };
  }

  function toNumber_(value) {
    return Number(value || 0);
  }

  return {
    toSummary: toSummary
  };
})();
