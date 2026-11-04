// 管理者のテストの窓口（#テスト。ux.md H11）の返事を作るところ。見本はどれも 🧪 を付け、ためしのデータだけで作る。
// 中身：TestDeskBuilder（窓口のカード・全部の返事の見本・カードが断られたときの文の見本・自己点検の結果）。
// 呼ぶところ：03_usecase.line_webhook.js と、自己点検の 01_selfcheck_config.js。カードの形は LineMessageBuilder.forTestDesk を使う。
var TestDeskBuilder = (function () {
  // カードの部品（LineMessageBuilder.forTestDesk）。読みこみの順に頼らないよう、使うときに取りに行く
  function parts_() {
    return LineMessageBuilder.forTestDesk;
  }
  var TEST_PREFIX = "🧪 ";

  // #テスト の窓口のクイックリプライ（見本・自己点検・文の返事・窓口）
  function buildTestQuickReply_() {
    return {
      items: [
        { label: "🧪 返事の見本", text: "#テスト 見本" },
        { label: "🧪 自己点検", text: "#テスト 点検" },
        { label: "🧪 文の返事", text: "#テスト 文" },
        { label: "🧪 窓口", text: "#テスト" }
      ].map(function (item) {
        return { type: "action", action: { type: "message", label: item.label, text: item.text } };
      })
    };
  }

  // #テスト の窓口のカード1通
  function buildTestCard_(mode) {
    return {
      type: "flex",
      altText: mode.altText,
      contents: parts_().buildBubble(mode),
      quickReply: buildTestQuickReply_()
    };
  }

  // #テスト の窓口のカード（何を試せるかの案内）
  function buildTestDeskMessages() {
    var config = ScriptConfig.getLineMessagingConfig();
    return [buildTestCard_({
      altText: "🧪 テストの窓口（管理者だけ）",
      category: "🧪 管理者だけ",
      title: "テストの窓口",
      body: "下のクイックリプライで試せます。\n・返事の見本：全部の返事を、ためしの数字で\n・自己点検：設定・シート・トリガーのようす\n・文の返事：カードが断られたときの返事\n\n本物の記録には書きません。見本にはどれも 🧪 が付きます。あとで見るときは「#テスト」と送ると、この窓口がまた出ます。",
      buttonLabel: "📊 管理の画面を開く",
      url: parts_().buildAdminUrl(config)
    })];
  }

  // 全部の返事を、ためしのデータで1つの横並びのカードに（大きさはどれも同じ mega）
  function buildSampleMessages() {
    var config = ScriptConfig.getLineMessagingConfig();
    var today = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd");
    var follow = parts_().resolveMode(config, "ヘルプ", false);
    follow.category = "ようこそ";
    follow.title = "友だち追加ありがとう！";
    var modes = [
      parts_().resolveMode(config, "5問", false),
      parts_().buildProgressMode(config, { businessDate: today, total: 5, answered: 0, correct: 0, overallAccuracyRate: null }),
      parts_().buildProgressMode(config, { businessDate: today, total: 5, answered: 3, correct: 2, overallAccuracyRate: 80 }),
      parts_().buildProgressMode(config, { businessDate: today, total: 5, answered: 5, correct: 4, overallAccuracyRate: 85 }),
      parts_().resolveMode(config, "ヘルプ", false),
      parts_().resolveMode(config, "導入相談", false),
      follow,
      parts_().resolveMode(config, "管理", true)
    ];
    return [{
      type: "flex",
      altText: "🧪 返事の見本（" + modes.length + "枚）",
      contents: {
        type: "carousel",
        contents: modes.map(function (mode) {
          var copy = Object.assign({}, mode, { category: TEST_PREFIX + "見本・" + mode.category });
          return parts_().buildBubble(copy);
        })
      },
      quickReply: buildTestQuickReply_()
    }];
  }

  // カードが断られたときに返す文（H5）を、reply で見せる
  function buildTextFallbackSampleMessages() {
    var config = ScriptConfig.getLineMessagingConfig();
    var sample = LineMessageBuilder.toTextFallback([parts_().buildCardMessage(parts_().resolveMode(config, "5問", false), false)])[0];
    return [{
      type: "text",
      text: TEST_PREFIX + "見本：カードが断られたときは、この文で返します（push で）。\n\n" + sample.text,
      quickReply: buildTestQuickReply_()
    }];
  }

  // 自己点検（qCheckAll）の結果。直すもの・見てほしいものを先に
  function buildSelfCheckMessages(result) {
    var config = ScriptConfig.getLineMessagingConfig();
    var rows = (result && result.results) || [];
    var order = { "❌": 0, "⚠️": 1, "✅": 2 };
    var count = { "❌": 0, "⚠️": 0, "✅": 0 };
    rows.forEach(function (row) {
      count[row.level] = (count[row.level] || 0) + 1;
    });
    // 今月の送信数は、いつも先頭に（✅ でも行が多くて切れないように）
    var rank = function (row) {
      return row.area === "送信数" ? -1 : order[row.level] === undefined ? 3 : order[row.level];
    };
    var sorted = rows.slice().sort(function (a, b) {
      return rank(a) - rank(b);
    });
    var lines = sorted.slice(0, 25).map(function (row) {
      return row.level + " " + row.area + "：" + row.text;
    });
    if (sorted.length > 25) {
      lines.push("ほか " + (sorted.length - 25) + " 件（GAS の実行ログに全部出ます）");
    }
    var summary = "❌ " + count["❌"] + "・⚠️ " + count["⚠️"] + "・✅ " + count["✅"];
    return [buildTestCard_({
      altText: TEST_PREFIX + "自己点検：" + summary,
      category: TEST_PREFIX + "自己点検",
      title: summary,
      body: (lines.join("\n") || "確かめる項目がありませんでした。").slice(0, 1800),
      buttonLabel: "📊 管理の画面を開く",
      url: parts_().buildAdminUrl(config)
    })];
  }

  // 自己点検を動かせなかったときの文
  function buildSelfCheckFailedMessages(code) {
    return [{
      type: "text",
      text: TEST_PREFIX + "自己点検を動かせませんでした（" + (code || "internal_error") + "）。GAS エディタで qCheckAll を実行して、実行ログを見てください。",
      quickReply: buildTestQuickReply_()
    }];
  }

  return {
    buildTestDeskMessages: buildTestDeskMessages,
    buildSampleMessages: buildSampleMessages,
    buildTextFallbackSampleMessages: buildTextFallbackSampleMessages,
    buildSelfCheckMessages: buildSelfCheckMessages,
    buildSelfCheckFailedMessages: buildSelfCheckFailedMessages
  };
})();
