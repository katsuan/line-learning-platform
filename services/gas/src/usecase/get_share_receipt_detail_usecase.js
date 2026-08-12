var GetShareReceiptDetailUsecase = (function () {
  function execute(request) {
    var me = MeUsecase.execute(request);
    var params = request.params || {};
    var body = request.body || {};
    var receiptCode = params.receiptCode || body.receiptCode || "";

    if (!receiptCode) {
      throw AppError.validation("missing_receipt_code", "receiptCode is required");
    }

    var receipt = ShareReceiptSheetRepository.findByReceiptCode(receiptCode);
    if (!receipt || receipt.tenant_id !== me.tenant.tenant_id) {
      throw AppError.notFound("share_receipt_not_found", "share receipt was not found");
    }

    return {
      ok: true,
      receipt: {
        receiptCode: receipt.receipt_code,
        learnerName: receipt.learner_name || "",
        learningSessionId: receipt.learning_session_id || "",
        membershipId: receipt.membership_id || "",
        userId: receipt.user_id || "",
        lineUserId: receipt.line_user_id || "",
        totalQuestions: Number(receipt.total_questions || 0),
        correctCount: Number(receipt.correct_count || 0),
        accuracyRate: Number(receipt.accuracy_rate || 0),
        shareChannel: receipt.share_channel || "",
        sharedAt: receipt.shared_at || receipt.created_at || ""
      }
    };
  }

  return {
    execute: execute
  };
})();
