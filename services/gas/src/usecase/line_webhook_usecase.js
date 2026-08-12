var LineWebhookUsecase = (function () {
  function handleEvent(event) {
    if (!event || !event.type) {
      return {
        handled: false,
        reason: "missing_event_type"
      };
    }

    switch (event.type) {
      case "message":
        return handleMessageEvent_(event);
      case "follow":
        return handleFollowEvent_(event);
      default:
        return {
          handled: false,
          eventType: event.type,
          reason: "unsupported_event_type"
        };
    }
  }

  function handleMessageEvent_(event) {
    if (!event.replyToken) {
      return {
        handled: false,
        eventType: event.type,
        reason: "missing_reply_token"
      };
    }

    var messageText = event.message && event.message.type === "text" ? String(event.message.text || "").trim() : "";
    if (shouldIgnoreMessageText_(messageText)) {
      return {
        handled: false,
        eventType: event.type,
        reason: "ignored_message"
      };
    }

    var messages = LineMessageBuilder.buildReplyMessages({
      event: event
    });

    LineMessagingClient.replyMessage(event.replyToken, messages);

    return {
      handled: true,
      eventType: event.type,
      messageCount: messages.length
    };
  }

  function handleFollowEvent_(event) {
    if (!event.replyToken) {
      return {
        handled: false,
        eventType: event.type,
        reason: "missing_reply_token"
      };
    }

    var messages = LineMessageBuilder.buildFollowMessages({
      event: event
    });

    LineMessagingClient.replyMessage(event.replyToken, messages);

    return {
      handled: true,
      eventType: event.type,
      messageCount: messages.length
    };
  }

  return {
    handleEvent: handleEvent
  };

  function shouldIgnoreMessageText_(messageText) {
    if (!messageText) {
      return true;
    }

    if (/提出コード\s+LPR-[A-Z0-9-]+/i.test(messageText)) {
      return true;
    }

    return !/(学習|学習する|5問|ヘルプ|使い方|はじめかた|初め方|案内|導入|有料|料金|契約|相談|法人|申し込み|申込|管理|一覧|学習者|履歴|記録|成績|メニュー)/.test(messageText);
  }
})();
