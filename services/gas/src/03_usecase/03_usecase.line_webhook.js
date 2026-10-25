// LINE の知らせ（メッセージ・友だち追加）に返事するところ。
// 中身：LineWebhookUsecase（返事をするか決める・カードで返す・断られたら文で返しなおす・管理者の #テスト）。
// 呼ぶところ：02_router.line_webhook.js。返事の中身は 05_presenter.line_message_builder.js で作る。
var LineWebhookUsecase = (function () {
  // 知らせを1つ処理し、返事をしたかの結果を返す
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

  // メッセージに返事する（#テスト は管理者だけ。知らない言葉には返事しない）
  function handleMessageEvent_(event) {
    if (!event.replyToken) {
      return {
        handled: false,
        eventType: event.type,
        reason: "missing_reply_token"
      };
    }

    var messageText = event.message && event.message.type === "text" ? String(event.message.text || "").trim() : "";
    var testCommand = parseTestCommand_(messageText);
    if (testCommand !== null && isAdminSender_(event)) {
      return replyOnly_(event, buildTestDeskReply_(testCommand));
    }
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

  // 友だち追加に、使い方のカードで返事する
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

  // 管理者のテストの窓口（ux.md H11）。「#テスト」「#test」（全角の ＃ も）と、そのあとの言葉
  function parseTestCommand_(text) {
    var match = /^[#＃]\s*(テスト|test)(?:\s+(.*))?$/i.exec(String(text || "").trim());
    return match ? String(match[2] || "").trim() : null;
  }

  // 送った人が管理者か（システム管理者か、ふだんの教室の ADMIN・OWNER）
  function isAdminSender_(event) {
    var lineUserId = event.source && event.source.userId ? event.source.userId : "";
    try {
      return AdminAccess.isAdminLineUser(lineUserId, ScriptConfig.getPublicConfig().defaultTenantId);
    } catch (error) {
      // シートが読めないときは、システム管理者だけ
      return !!lineUserId && lineUserId === ScriptConfig.getLineMessagingConfig().systemAdminLineUserId;
    }
  }

  // #テスト のあとの言葉（見本・文・点検）に合う返事を作る。ほかは窓口のカード
  function buildTestDeskReply_(command) {
    if (command === "見本") {
      return LineMessageBuilder.buildSampleMessages();
    }
    if (command === "文") {
      return LineMessageBuilder.buildTextFallbackSampleMessages();
    }
    if (command === "点検") {
      try {
        return LineMessageBuilder.buildSelfCheckMessages(qCheckAll());
      } catch (error) {
        return LineMessageBuilder.buildSelfCheckFailedMessages(error && error.code);
      }
    }
    return LineMessageBuilder.buildTestDeskMessages();
  }

  // 窓口は reply だけで返す（push は使わない）。断られたら原因だけ残す
  function replyOnly_(event, messages) {
    try {
      LineMessagingClient.replyMessage(event.replyToken, messages);
      return { handled: true, eventType: event.type, messageCount: messages.length, reason: "test_desk" };
    } catch (error) {
      DebugLogger.recordLineError({
        eventType: event.type,
        code: error && error.code ? error.code : "",
        message: error && error.message ? error.message : String(error)
      });
      return { handled: false, eventType: event.type, reason: "test_desk_reply_failed" };
    }
  }

  // LINE の送りなおしの知らせか
  function isRedelivery_(event) {
    return !!(event.deliveryContext && event.deliveryContext.isRedelivery);
  }

  // push の送り先（グループ・トークルーム・人の順）
  function pushTarget_(event) {
    var source = event.source || {};
    return source.groupId || source.roomId || source.userId || "";
  }

  return {
    handleEvent: handleEvent
  };

  // 返事をしない言葉か（空・提出コードの文・返事をする言葉が入っていない）
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
