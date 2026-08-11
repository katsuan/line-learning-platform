var LineMessageBuilder = (function () {
  function buildReplyMessages(context) {
    var config = ScriptConfig.getLineMessagingConfig();
    var liffUrl = buildLiffUrl_(config);
    var userText = extractUserText_(context.event);

    return [
      {
        type: "flex",
        altText: "LearningPlatform を開く",
        contents: buildLaunchBubble_(liffUrl, userText)
      },
      {
        type: "text",
        text: "LIFF を開いて学習を続けられます。"
      }
    ];
  }

  function buildFollowMessages() {
    var config = ScriptConfig.getLineMessagingConfig();
    var liffUrl = buildLiffUrl_(config);

    return [
      {
        type: "flex",
        altText: "LearningPlatform へようこそ",
        contents: buildLaunchBubble_(liffUrl, "学習を始める")
      },
      {
        type: "text",
        text: "友だち追加ありがとうございます。学習を始めるボタンから LIFF を開いてください。"
      }
    ];
  }

  function buildLaunchBubble_(liffUrl, userText) {
    return {
      type: "bubble",
      hero: {
        type: "box",
        layout: "vertical",
        paddingAll: "20px",
        backgroundColor: "#17624A",
        contents: [
          {
            type: "text",
            text: "LearningPlatform",
            color: "#F8F4ED",
            weight: "bold",
            size: "xl"
          },
          {
            type: "text",
            text: "LINE から学習を始める",
            color: "#DDEFE7",
            margin: "md",
            size: "sm"
          }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "text",
            text: "LIFF を開いて、今日の5問や学習履歴を確認できます。",
            wrap: true,
            size: "sm",
            color: "#3E3A34"
          },
          {
            type: "box",
            layout: "vertical",
            cornerRadius: "12px",
            paddingAll: "12px",
            backgroundColor: "#F6EFE4",
            contents: [
              {
                type: "text",
                text: "受信メッセージ",
                size: "xs",
                color: "#7A7165"
              },
              {
                type: "text",
                text: userText || "学習を始める",
                wrap: true,
                size: "sm",
                weight: "bold",
                color: "#1C1B18",
                margin: "sm"
              }
            ]
          }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#17624A",
            action: {
              type: "uri",
              label: "学習を開く",
              uri: liffUrl
            }
          }
        ]
      }
    };
  }

  function buildLiffUrl_(config) {
    if (config.liffId) {
      return "https://liff.line.me/" + config.liffId;
    }

    return config.appBaseUrl || "https://example.github.io/LearningPlatform/";
  }

  function extractUserText_(event) {
    if (!event || !event.message || event.message.type !== "text") {
      return "";
    }

    return event.message.text || "";
  }

  return {
    buildReplyMessages: buildReplyMessages,
    buildFollowMessages: buildFollowMessages
  };
})();
