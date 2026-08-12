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
    var startMode = resolveMode_(config, "ヘルプ");

    return [
      {
        type: "flex",
        altText: "LearningPlatform へようこそ",
        contents: buildLaunchBubble_(startMode.url, "学習を始める", startMode)
      },
      {
        type: "text",
        text: "友だち追加ありがとうございます。まずは使い方を確認して、5問体験から始められます。"
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

  function buildLiffUrl_(config, params) {
    if (config.liffId) {
      var baseUrl = "https://liff.line.me/" + config.liffId;
      return appendParams_(baseUrl, params);
    }

    return appendParams_(buildAppUrl_(config.appBaseUrl, "learn.html"), params);
  }

  function buildAppUrl_(baseUrl, path) {
    var base = baseUrl || "https://example.github.io/LearningPlatform/";
    if (!path) {
      return base;
    }

    return base.replace(/\/+$/, "") + "/" + path.replace(/^\/+/, "");
  }

  function appendParams_(url, params) {
    var entries = Object.keys(params || {}).filter(function (key) {
      return params[key] !== undefined && params[key] !== null && params[key] !== "";
    }).map(function (key) {
      return encodeURIComponent(key) + "=" + encodeURIComponent(String(params[key]));
    });

    if (!entries.length) {
      return url;
    }

    return url + (url.indexOf("?") === -1 ? "?" : "&") + entries.join("&");
  }

  function extractUserText_(event) {
    if (!event || !event.message || event.message.type !== "text") {
      return "";
    }

    return event.message.text || "";
  }

  function resolveMode_(config, userText) {
    var normalized = String(userText || "").trim();

    if (/ヘルプ|使い方|はじめかた|初め方|案内/.test(normalized)) {
      return {
        altText: "使い方を見る",
        title: "はじめての方へ",
        subtitle: "まずは流れを確認",
        body: "まずは使い方を確認してから、個人で5問体験を始められます。導入相談の窓口もこちらから案内します。",
        buttonLabel: "学習画面を開く",
        url: buildLiffUrl_(config, { entry: "help" }),
        followUpText: "LINEアプリ内の学習画面から、使い方を確認できます。"
      };
    }

    if (/導入|有料|料金|契約|相談|法人|申し込み|申込/.test(normalized)) {
      return {
        altText: "導入相談を見る",
        title: "導入相談",
        subtitle: "個人利用の先へ進みたい方へ",
        body: "まずは個人で5問体験を試し、その後に有料プランや組織導入の相談へ進めます。",
        buttonLabel: "学習画面を開く",
        url: buildLiffUrl_(config, { entry: "plans" }),
        followUpText: "LINEアプリ内の学習画面から、導入相談の入口を開けます。"
      };
    }

    if (/管理|一覧|学習者/.test(normalized)) {
      return {
        altText: "管理画面を開く",
        title: "管理メニュー",
        subtitle: "学習者の進み具合を確認",
        body: "管理画面から学習者一覧や最近の進捗を確認できます。",
        buttonLabel: "学習画面を開く",
        url: buildLiffUrl_(config, { entry: "admin" }),
        followUpText: "LINEアプリ内の学習画面から、学習者の進み具合を確認できます。"
      };
    }

    if (/履歴|記録|成績/.test(normalized)) {
      return {
        altText: "学習を再開する",
        title: "学習履歴",
        subtitle: "前回までの学習を確認",
        body: "学習履歴や正答率を確認できます。続きから学習したいときもここから開けます。",
        buttonLabel: "学習を開く",
        url: buildLiffUrl_(config, { entry: "history" }),
        followUpText: "LINEアプリ内の学習画面から、学習履歴や続きの学習を開けます。"
      };
    }

    return {
      altText: "LearningPlatform を開く",
      title: "5問体験",
      subtitle: "まずは個人で試す",
      body: "学習画面を開いて、まずは5問体験を始められます。今日の学習や履歴の確認もここから進められます。",
      buttonLabel: "5問体験を始める",
      url: buildLiffUrl_(config, { entry: "start" }),
      followUpText: "LINEアプリ内で、個人の5問体験を始められます。"
    };
  }

  return {
    buildReplyMessages: buildReplyMessages,
    buildFollowMessages: buildFollowMessages
  };
})();
