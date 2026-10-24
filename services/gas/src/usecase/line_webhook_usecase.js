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
      event: event,
      // 「記録」には、今日の数字をカードで返す（ux.md H10）
      progress: LineMessageBuilder.isProgressText(messageText)
        ? LineProgressUsecase.forLineUser(event.source && event.source.userId)
        : null
    });

    return replyWithFallback_(event, messages);
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

    return replyWithFallback_(event, messages);
  }

  // カードが通らないときは黙らず、文字だけで返す。原因は管理者が見られるところ（LAST_LINE_ERRORS）に残す。
  // 返事の合図（reply token）は1回しか使えないので、返しなおしは push で送る（1回の操作につき1回だけ）
  function replyWithFallback_(event, messages) {
    try {
      LineMessagingClient.replyMessage(event.replyToken, LineMessageBuilder.toSendable(messages));
      return {
        handled: true,
        eventType: event.type,
        messageCount: messages.length
      };
    } catch (error) {
      DebugLogger.recordLineError({
        eventType: event.type,
        code: error && error.code ? error.code : "",
        message: error && error.message ? error.message : String(error)
      });
      // LINE の送りなおし（isRedelivery）は、前の回で返事が届いているかもしれないので、push で重ねない
      if (isRedelivery_(event)) {
        return {
          handled: false,
          eventType: event.type,
          reason: "reply_failed_redelivery"
        };
      }
      var fallback = LineMessageBuilder.toTextFallback(messages);
      var to = pushTarget_(event);
      if (!to) {
        return {
          handled: false,
          eventType: event.type,
          reason: "reply_failed_no_push_target"
        };
      }
      LineMessagingClient.pushMessage(to, fallback);
      return {
        handled: true,
        eventType: event.type,
        messageCount: fallback.length,
        reason: "text_fallback"
      };
    }
  }

  function isRedelivery_(event) {
    return !!(event.deliveryContext && event.deliveryContext.isRedelivery);
  }

  function pushTarget_(event) {
    var source = event.source || {};
    return source.groupId || source.roomId || source.userId || "";
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

    return !LineMessageBuilder.isReplyText(messageText);
  }
})();
