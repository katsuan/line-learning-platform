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
})();
