// 見本の問題のデータ（seedLearningPlatformMvp で入れる 30 問）。コードはなく、データだけ。
// 呼ぶところ：09_setup.sheets.js の seedCourseAndQuestionData_。
// 見本の問題（小学1年生の漢字の読み）。id・問題・答え・説明。seedLearningPlatformMvp で入れる
var TRIAL_QUESTIONS = [
  {
    id: "question_demo_001",
    text: "「一つ」の読み方は？",
    answer: "ひとつ",
    explanation: "「一つ」は「ひとつ」と読みます。"
  },
  {
    id: "question_demo_002",
    text: "「右手」の読み方は？",
    answer: "みぎて",
    explanation: "「右手」は「みぎて」と読みます。"
  },
  {
    id: "question_demo_003",
    text: "「大雨」の読み方は？",
    answer: "おおあめ",
    explanation: "「大雨」は「おおあめ」と読みます。"
  },
  {
    id: "question_demo_004",
    text: "「百円」の読み方は？",
    answer: "ひゃくえん",
    explanation: "「百円」は「ひゃくえん」と読みます。"
  },
  {
    id: "question_demo_005",
    text: "「王様」の読み方は？",
    answer: "おうさま",
    explanation: "「王様」は「おうさま」と読みます。"
  },
  {
    id: "question_demo_006",
    text: "「足音」の読み方は？",
    answer: "あしおと",
    explanation: "「足音」は「あしおと」と読みます。"
  },
  {
    id: "question_demo_007",
    text: "「下水」の読み方は？",
    answer: "げすい",
    explanation: "「下水」は「げすい」と読みます。"
  },
  {
    id: "question_demo_008",
    text: "「花火」の読み方は？",
    answer: "はなび",
    explanation: "「花火」は「はなび」と読みます。"
  },
  {
    id: "question_demo_009",
    text: "「花見」の読み方は？",
    answer: "はなみ",
    explanation: "「花見」は「はなみ」と読みます。"
  },
  {
    id: "question_demo_010",
    text: "「貝がら」の読み方は？",
    answer: "かいがら",
    explanation: "「貝がら」は「かいがら」と読みます。"
  },
  {
    id: "question_demo_011",
    text: "「学校」の読み方は？",
    answer: "がっこう",
    explanation: "「学校」は「がっこう」と読みます。"
  },
  {
    id: "question_demo_012",
    text: "「天気」の読み方は？",
    answer: "てんき",
    explanation: "「天気」は「てんき」と読みます。"
  },
  {
    id: "question_demo_013",
    text: "「九つ」の読み方は？",
    answer: "ここのつ",
    explanation: "「九つ」は「ここのつ」と読みます。"
  },
  {
    id: "question_demo_014",
    text: "「休み」の読み方は？",
    answer: "やすみ",
    explanation: "「休み」は「やすみ」と読みます。"
  },
  {
    id: "question_demo_015",
    text: "「目玉」の読み方は？",
    answer: "めだま",
    explanation: "「目玉」は「めだま」と読みます。"
  },
  {
    id: "question_demo_016",
    text: "「お金」の読み方は？",
    answer: "おかね",
    explanation: "「お金」は「おかね」と読みます。"
  },
  {
    id: "question_demo_017",
    text: "「青空」の読み方は？",
    answer: "あおぞら",
    explanation: "「青空」は「あおぞら」と読みます。"
  },
  {
    id: "question_demo_018",
    text: "「月見」の読み方は？",
    answer: "つきみ",
    explanation: "「月見」は「つきみ」と読みます。"
  },
  {
    id: "question_demo_019",
    text: "「子犬」の読み方は？",
    answer: "こいぬ",
    explanation: "「子犬」は「こいぬ」と読みます。"
  },
  {
    id: "question_demo_020",
    text: "「見学」の読み方は？",
    answer: "けんがく",
    explanation: "「見学」は「けんがく」と読みます。"
  },
  {
    id: "question_demo_021",
    text: "「入口」の読み方は？",
    answer: "いりぐち",
    explanation: "「入口」は「いりぐち」と読みます。"
  },
  {
    id: "question_demo_022",
    text: "「高校」の読み方は？",
    answer: "こうこう",
    explanation: "「高校」は「こうこう」と読みます。"
  },
  {
    id: "question_demo_023",
    text: "「左折」の読み方は？",
    answer: "させつ",
    explanation: "「左折」は「させつ」と読みます。"
  },
  {
    id: "question_demo_024",
    text: "「三日」の読み方は？",
    answer: "みっか",
    explanation: "「三日」は「みっか」と読みます。"
  },
  {
    id: "question_demo_025",
    text: "「富士山」の読み方は？",
    answer: "ふじさん",
    explanation: "「富士山」は「ふじさん」と読みます。"
  },
  {
    id: "question_demo_026",
    text: "「子供」の読み方は？",
    answer: "こども",
    explanation: "「子供」は「こども」と読みます。"
  },
  {
    id: "question_demo_027",
    text: "「四角」の読み方は？",
    answer: "しかく",
    explanation: "「四角」は「しかく」と読みます。"
  },
  {
    id: "question_demo_028",
    text: "「毛糸」の読み方は？",
    answer: "けいと",
    explanation: "「毛糸」は「けいと」と読みます。"
  },
  {
    id: "question_demo_029",
    text: "「文字」の読み方は？",
    answer: "もじ",
    explanation: "「文字」は「もじ」と読みます。"
  },
  {
    id: "question_demo_030",
    text: "「耳元」の読み方は？",
    answer: "みみもと",
    explanation: "「耳元」は「みみもと」と読みます。"
  }
];
