var LineMessageBuilder = (function () {
  function buildReplyMessages(context) {
    var config = ScriptConfig.getLineMessagingConfig();
    var userText = extractUserText_(context.event);
    var mode = resolveMode_(config, userText);

    return [
      {
        type: "flex",
        altText: mode.altText,
        contents: buildLaunchBubble_(mode.url, userText, mode)
      },
      {
        type: "text",
        text: mode.followUpText
      }
    ];
  }

  function buildFollowMessages() {
    var config = ScriptConfig.getLineMessagingConfig();
    var startMode = resolveMode_(config, "");

    return [
      {
        type: "flex",
        altText: "LearningPlatform へようこそ",
        contents: buildLaunchBubble_(startMode.url, "学習を始める", startMode)
      },
      {
        type: "text",
        text: "友だち追加ありがとうございます。学習を始めるボタンから LIFF を開いてください。"
      }
    ];
  }

  function buildLaunchBubble_(destinationUrl, userText, mode) {
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
            text: mode.title,
            color: "#F8F4ED",
            weight: "bold",
            size: "xl"
          },
          {
            type: "text",
            text: mode.subtitle,
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
            text: mode.body,
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
              label: mode.buttonLabel,
              uri: destinationUrl
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

    return buildAppUrl_(config.appBaseUrl, "learn.html");
  }

  function buildAppUrl_(baseUrl, path) {
    var base = baseUrl || "https://example.github.io/LearningPlatform/";
    if (!path) {
      return base;
    }

    return base.replace(/\/+$/, "") + "/" + path.replace(/^\/+/, "");
  }

  function extractUserText_(event) {
    if (!event || !event.message || event.message.type !== "text") {
      return "";
    }

    return event.message.text || "";
  }

  function resolveMode_(config, userText) {
    var normalized = String(userText || "").trim();

    if (/管理|一覧|学習者/.test(normalized)) {
      return {
        altText: "管理画面を開く",
        title: "管理メニュー",
        subtitle: "学習者の進み具合を確認",
        body: "管理画面から学習者一覧や最近の進捗を確認できます。",
        buttonLabel: "管理画面を開く",
        url: buildAppUrl_(config.appBaseUrl, "admin.html"),
        followUpText: "管理画面を開けます。学習者の進み具合を確認したいときに使ってください。"
      };
    }

    if (/履歴|記録|成績/.test(normalized)) {
      return {
        altText: "学習を再開する",
        title: "学習履歴",
        subtitle: "前回までの学習を確認",
        body: "学習履歴や正答率を確認できます。続きから学習したいときもここから開けます。",
        buttonLabel: "学習を開く",
        url: buildLiffUrl_(config),
        followUpText: "学習履歴や続きの学習を開けます。"
      };
    }

    return {
      altText: "LearningPlatform を開く",
      title: "LearningPlatform",
      subtitle: "LINE から学習を始める",
      body: "LIFF を開いて、今日の5問や学習履歴を確認できます。",
      buttonLabel: "学習を開く",
      url: buildLiffUrl_(config),
      followUpText: "LIFF を開いて学習を続けられます。"
    };
  }

  return {
    buildReplyMessages: buildReplyMessages,
    buildFollowMessages: buildFollowMessages
  };
})();
