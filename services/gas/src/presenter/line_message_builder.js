var LineMessageBuilder = (function () {
  var ACCENT = "#17624A";
  // 返事をする言葉。どれにも当たらない言葉には返事しない（LineWebhookUsecase）
  var KEYWORDS = {
    help: /ヘルプ|使い方|はじめかた|初め方|案内/,
    plans: /導入|有料|料金|契約|相談|法人|申し込み|申込/,
    admin: /管理|一覧|学習者/,
    history: /履歴|記録|成績/,
    start: /学習|5問|メニュー/
  };

  function isReplyText(text) {
    var normalized = String(text || "").trim();
    return Object.keys(KEYWORDS).some(function (key) {
      return KEYWORDS[key].test(normalized);
    });
  }

  // 返事は1通のカードにまとめ、最後のメッセージに次の操作（クイックリプライ）を付ける
  function buildReplyMessages(context) {
    var config = ScriptConfig.getLineMessagingConfig();
    var event = context.event || {};
    var isAdmin = isAdmin_(config, event);
    var mode = resolveMode_(config, extractUserText_(event), isAdmin);
    return [buildCardMessage_(mode, isAdmin)];
  }

  function buildFollowMessages(context) {
    var config = ScriptConfig.getLineMessagingConfig();
    var event = (context && context.event) || {};
    var isAdmin = isAdmin_(config, event);
    var mode = resolveMode_(config, "ヘルプ", isAdmin);
    mode.altText = "友だち追加ありがとう！使い方の案内です";
    mode.category = "ようこそ";
    mode.title = "友だち追加ありがとう！";
    return [buildCardMessage_(mode, isAdmin)];
  }

  // カードが通らなかったときの、文字だけの返事（同じ中身とクイックリプライ）
  function toTextFallback(messages) {
    return (messages || []).map(function (message) {
      if (message.type !== "flex") {
        return message;
      }
      var fallback = {
        type: "text",
        text: message.fallbackText || message.altText || "5問を開く"
      };
      if (message.quickReply) {
        fallback.quickReply = message.quickReply;
      }
      return fallback;
    }).map(stripFallbackText_);
  }

  // LINE に送る前に、手元だけで使う fallbackText を外す
  function stripFallbackText_(message) {
    if (!message || message.fallbackText === undefined) {
      return message;
    }
    var copy = {};
    Object.keys(message).forEach(function (key) {
      if (key !== "fallbackText") {
        copy[key] = message[key];
      }
    });
    return copy;
  }

  function buildCardMessage_(mode, isAdmin) {
    return {
      type: "flex",
      altText: mode.altText,
      contents: buildBubble_(mode),
      quickReply: buildQuickReply_(isAdmin),
      fallbackText: mode.title + "\n" + mode.body + "\n\n" + mode.buttonLabel + "：" + mode.url
    };
  }

  // 色の帯（小さく区分、太く見出し）→ 中身 → ボタン1つ
  function buildBubble_(mode) {
    return {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        paddingAll: "16px",
        backgroundColor: ACCENT,
        contents: [
          {
            type: "text",
            text: mode.category,
            color: "#DDEFE7",
            size: "xs"
          },
          {
            type: "text",
            text: mode.title,
            color: "#F8F4ED",
            weight: "bold",
            size: "lg",
            margin: "sm",
            wrap: true
          }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: mode.body,
            wrap: true,
            size: "sm",
            color: "#3E3A34"
          }
        ]
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            style: "primary",
            color: ACCENT,
            action: {
              type: "uri",
              label: mode.buttonLabel,
              uri: mode.url
            }
          }
        ]
      }
    };
  }

  // 押したらそのまま返事が来る操作だけ（13個まで・ラベル20字まで）
  function buildQuickReply_(isAdmin) {
    var items = [
      { label: "📚 5問を解く", text: "5問" },
      { label: "📈 今日の記録", text: "記録" },
      { label: "❓ 使い方", text: "ヘルプ" },
      { label: "💬 導入の相談", text: "導入相談" }
    ];
    if (isAdmin) {
      items.push({ label: "📊 学習者の一覧", text: "管理" });
    }

    return {
      items: items.map(function (item) {
        return {
          type: "action",
          action: {
            type: "message",
            label: item.label,
            text: item.text
          }
        };
      })
    };
  }

  function isAdmin_(config, event) {
    var userId = event && event.source && event.source.userId ? event.source.userId : "";
    return !!(userId && config.systemAdminLineUserId && userId === config.systemAdminLineUserId);
  }

  function buildLiffUrl_(config, params) {
    if (config.liffId) {
      return appendParams_("https://liff.line.me/" + config.liffId, params);
    }

    return appendParams_(buildAppUrl_(config.appBaseUrl, "learn.html"), params);
  }

  // 管理の画面は LIFF ではなく公開ページ。APP_BASE_URL が見本のままなら、学習画面の入口にする
  function buildAdminUrl_(config) {
    var base = String(config.appBaseUrl || "");
    if (!base || /example\.github\.io/.test(base)) {
      return buildLiffUrl_(config, { entry: "admin" });
    }
    return buildAppUrl_(base, "admin.html");
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

  function resolveMode_(config, userText, isAdmin) {
    var normalized = String(userText || "").trim();

    if (KEYWORDS.help.test(normalized)) {
      return {
        altText: "使い方の案内です",
        category: "使い方",
        title: "はじめての方へ",
        body: "① 下のボタンで、今日の5問を開く\n② 答えると、すぐ答え合わせ\n③ 5問おわったら、結果を LINE で送れる",
        buttonLabel: "📚 5問を解く",
        url: buildLiffUrl_(config, { entry: "help" })
      };
    }

    if (KEYWORDS.plans.test(normalized)) {
      return {
        altText: "導入の相談の案内です",
        category: "導入の相談",
        title: "まずは5問を試してね",
        body: "続けて使いたいときは、有料プランや学校・会社での導入を相談できます。",
        buttonLabel: "📚 5問を試す",
        url: buildLiffUrl_(config, { entry: "plans" })
      };
    }

    // 管理者だけの案内。ふつうの人には出さない（下の「5問」の案内になる）
    if (isAdmin && KEYWORDS.admin.test(normalized)) {
      return {
        altText: "学習者の進み具合を開く",
        category: "管理者だけ",
        title: "学習者の進み具合",
        body: "だれが、どれだけ解いたかを見られます。",
        buttonLabel: "📊 一覧を開く",
        url: buildAdminUrl_(config)
      };
    }

    if (KEYWORDS.history.test(normalized)) {
      return {
        altText: "今日の記録を開く",
        category: "記録",
        title: "今日の進み具合",
        body: "今日の5問の、答えた数と答え合わせを見られます。続きからも解けます。",
        buttonLabel: "📈 記録を見る",
        url: buildLiffUrl_(config, { entry: "history" })
      };
    }

    return {
      altText: "今日の5問を開く",
      category: "今日の5問",
      title: "今日の5問を解こう",
      body: "1問ずつ答えて、すぐ答え合わせ。5問で数分です。",
      buttonLabel: "📚 5問を解く",
      url: buildLiffUrl_(config, { entry: "start" })
    };
  }

  return {
    buildReplyMessages: buildReplyMessages,
    buildFollowMessages: buildFollowMessages,
    isReplyText: isReplyText,
    toTextFallback: toTextFallback,
    toSendable: function (messages) {
      return (messages || []).map(stripFallbackText_);
    }
  };
})();
