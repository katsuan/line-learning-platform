// 今日の5問の画面（learn.html）の動き。
// 中身：LIFF の準備 → GAS から今日の5問を読む → 1問ずつ答えて保存 → 結果を LINE に送る。
// 読むところ：learn.html（ui.js・LIFF の SDK・config.js のあと）。設定は config.js の APP_CONFIG。
(function () {
  var config = window.APP_CONFIG || {};
  var UI = window.LineShareUI || {
    // ui.js が読めないときの代わり：知らせを出さない
    toast: function () {},
    // ui.js が読めないときの代わり：はじめの案内を出さない
    firstTip: function () {},
    // ui.js が読めないときの代わり：送ったあとの案内を出さない
    afterSent: function () {},
    // ui.js が読めないときの代わり：待っているあいだの文をそのまま出す
    progress: function (label, show) { show(label + "…"); return function () {}; }
  };
  var CACHE_KEY = "learningPlatform:lastBootstrap:v1";
  var AUDIO_KEY = "learningPlatformAudioSettings";

  var state = {
    me: null,
    home: null,
    session: null,
    // ready：ネットの返事が来て、答えを保存できる状態
    ready: false,
    loading: false,
    loadFailed: false,
    loadErrorCode: "",
    fromCache: false,
    sharing: false,
    shareReceiptCodes: {},
    liff: {
      ready: false,
      loggedIn: false,
      inClient: false,
      profile: null,
      userId: "",
      idToken: "",
      contextType: "",
      canSendMessages: false,
      canShareTargetPicker: false
    },
    currentQuestionIndex: 0,
    answers: {},
    results: {},
    saveState: {},
    answerError: "",
    audio: {
      enabled: true,
      volume: 0.55
    }
  };

  var progressLabelEl = document.getElementById("progressLabel");
  var progressCountEl = document.getElementById("progressCount");
  var progressFillEl = document.getElementById("progressFill");
  var questionMapEl = document.getElementById("questionMap");
  var questionShellEl = document.getElementById("questionShell");
  var soundToggleButtonEl = document.getElementById("soundToggleButton");
  var responsePanelEl = document.getElementById("responsePanel");
  var debugPanelEl = document.getElementById("debugPanel");
  var versionTextEl = document.getElementById("versionText");
  var debugMode = new URLSearchParams(window.location.search).get("debug") === "1";
  var activeSessionId = "";
  var stopWaitText = null;

  if (debugMode) {
    debugPanelEl.hidden = false;
  }

  if ("serviceWorker" in navigator && window.isSecureContext) {
    navigator.serviceWorker.register("./sw.js").catch(function () {});
  }

  renderVersion_(config.appVersion);
  loadVersionInfo_();
  initializeAudioSettings_();

  UI.firstTip("learning-platform", [
    "1問ずつ答えると、すぐ答え合わせが出ます",
    "上の番号を押すと、ほかの問題に移れます",
    "5問おわったら、LINEで結果を送れます"
  ], questionShellEl);

  restoreFromCache_();
  bootstrap_();

  // ---- 読みこみ ----

  function bootstrap_() {
    state.loading = true;
    state.loadFailed = false;
    renderAll_();

    initializeLiff_()
      .then(fetchBootstrapPayload_)
      .then(function (payload) {
        applyBootstrapPayload_(payload, { resetQuestionIndex: !state.fromCache });
        state.loading = false;
        state.ready = true;
        state.fromCache = false;
        saveCache_();
        renderAll_();
        renderResponse_(payload);
      })
      .catch(function (error) {
        state.loading = false;
        state.loadFailed = true;
        state.loadErrorCode = errorCode_(error);
        renderAll_();
        renderError_(error);
        if (state.session) {
          // つながらないとき以外（ログイン・教室・問題）は、その原因を知らせる
          var reason = LOAD_ERROR_REASONS[state.loadErrorCode];
          UI.toast(reason && state.loadErrorCode !== "busy"
            ? "前に開いた内容を出しています。" + reason.text
            : "つながらないので、前に開いた内容を出しています", { actionLabel: "もう一度", onAction: bootstrap_ });
        }
      });
  }

  // LIFF を準備する。LINE の外でログインしていなければ、ログインの画面へ移る（ここで止める）
  function initializeLiff_() {
    if (!config.liffId || !window.liff || !/^https?:/i.test(String(window.location.href || ""))) {
      return Promise.resolve();
    }

    return window.liff.init({ liffId: config.liffId })
      .then(function () {
        state.liff.ready = true;
        state.liff.inClient = window.liff.isInClient();
        state.liff.loggedIn = window.liff.isLoggedIn();
        state.liff.idToken = window.liff.getIDToken ? (window.liff.getIDToken() || "") : "";

        if (!state.liff.loggedIn && !state.liff.inClient) {
          // ログインの画面へ移るので、ここで止める（だれの記録か分からないまま読みこまない）
          window.liff.login({ redirectUri: window.location.href });
          return new Promise(function () {});
        }

        return Promise.all([
          loadLiffProfile_(),
          loadLiffCapabilities_()
        ]);
      })
      .catch(function (error) {
        renderError_({ liff: error && error.message ? error.message : String(error) });
      });
  }

  // LINE のプロフィール（名前・写真）を読む
  function loadLiffProfile_() {
    if (!state.liff.loggedIn) {
      return Promise.resolve();
    }

    return window.liff.getProfile()
      .then(function (profile) {
        state.liff.profile = profile;
        state.liff.userId = profile && profile.userId ? profile.userId : "";
      })
      .catch(function () {});
  }

  // このトークに送れるか・ほかのトークに送れるかを調べる
  function loadLiffCapabilities_() {
    var context = window.liff.getContext ? window.liff.getContext() : null;
    state.liff.contextType = context && context.type ? context.type : "";
    state.liff.canShareTargetPicker = window.liff.isApiAvailable
      ? window.liff.isApiAvailable("shareTargetPicker")
      : false;
    var inTalk = state.liff.inClient && /utou|group|room/.test(String(state.liff.contextType || ""));

    if (!window.liff.permission || !window.liff.permission.query) {
      state.liff.canSendMessages = state.liff.inClient;
      return Promise.resolve();
    }

    return window.liff.permission.query("chat_message.write")
      .then(function (permission) {
        state.liff.canSendMessages = !!(permission && permission.state === "granted") && inTalk;
      })
      .catch(function () {
        state.liff.canSendMessages = inTalk;
      });
  }

  // 今日の回を GAS に作ってもらい、画面を出しなおす（今日の回がまだないとき）
  function resolveDailySession_() {
    if (state.loading) {
      return;
    }

    state.loading = true;
    state.loadFailed = false;
    renderAll_();

    requestJson_("POST", config.resolveDailySessionAction || "resolveDailySession", {
      action: config.resolveDailySessionAction || "resolveDailySession",
      tenantId: config.tenantId
    })
      .then(function (payload) {
        applySessionPayload_(payload, { resetQuestionIndex: true });
        state.loading = false;
        state.ready = true;
        saveCache_();
        renderAll_();
        renderResponse_(payload);
      })
      .catch(function (error) {
        state.loading = false;
        state.loadFailed = true;
        state.loadErrorCode = errorCode_(error);
        renderAll_();
        renderError_(error);
      });
  }

  // 画面を開いたときの中身（本人・ホーム・今日の回）を GAS から読む
  function fetchBootstrapPayload_() {
    return requestJson_("POST", config.bootstrapAction || "bootstrapLearning", {
      action: config.bootstrapAction || "bootstrapLearning",
      tenantId: config.tenantId
    });
  }

  // 読んだ中身を画面の状態に入れ、まだ答えていない問題に合わせる
  function applyBootstrapPayload_(payload, options) {
    state.me = payload.me || null;
    state.home = payload.home || null;
    var reset = applySessionPayload_(payload, options);
    hydrateResultsFromHome_(state.home);
    if (reset) {
      // 答えた分を入れてから、まだの問題に合わせる
      state.currentQuestionIndex = firstUnansweredIndex_();
    }
    clampCurrentQuestionIndex_();
  }

  // 回を入れかえる。回が変わったら答えを空にして、まだの問題に合わせる。合わせなおしたかを返す
  function applySessionPayload_(payload, options) {
    state.session = payload.session || null;
    var changed = syncStateWithSession_();
    var reset = changed || !!(options && options.resetQuestionIndex);
    if (reset) {
      state.currentQuestionIndex = firstUnansweredIndex_();
    }
    clampCurrentQuestionIndex_();
    return reset;
  }

  // いまの問題の番号を、問題の数の中に入れる
  function clampCurrentQuestionIndex_() {
    var questions = getQuestions_();
    if (questions.length === 0) {
      state.currentQuestionIndex = 0;
      return;
    }
    state.currentQuestionIndex = Math.max(0, Math.min(state.currentQuestionIndex, questions.length));
    if (state.currentQuestionIndex === questions.length && getAnsweredCount_() < questions.length) {
      state.currentQuestionIndex = questions.length - 1;
    }
  }

  // まだ答えていない、はじめの問題の番号（全部答えたら問題の数）
  function firstUnansweredIndex_() {
    var questions = getQuestions_();
    for (var i = 0; i < questions.length; i += 1) {
      if (!state.results[questions[i].sessionQuestionId]) {
        return i;
      }
    }
    return questions.length;
  }

  // 今日の答えを、画面の答えと答え合わせに入れる
  function hydrateResultsFromHome_(homePayload) {
    if (!homePayload || !homePayload.todayAnswerEvents || !state.session) {
      return;
    }

    var questionMap = {};
    getQuestions_().forEach(function (question) {
      questionMap[question.sessionQuestionId] = question;
    });

    homePayload.todayAnswerEvents.forEach(function (entry) {
      var question = questionMap[entry.sessionQuestionId];
      if (!question) {
        return;
      }

      state.answers[entry.sessionQuestionId] = entry.answerValue || state.answers[entry.sessionQuestionId] || "";
      state.results[entry.sessionQuestionId] = {
        isCorrect: entry.isCorrect === true,
        score: Number(entry.score || 0),
        explanation: question.explanation || "",
        normalizedAnswer: entry.answerValue || "",
        correctAnswerText: toCorrectAnswerText_(question, (question.gradingConfig && question.gradingConfig.correctAnswerPayload) || {})
      };
      state.saveState[entry.sessionQuestionId] = "saved";
    });
  }

  // 今日の答えの一覧に、いまの答えを入れる（同じ問題なら入れかえる）
  function upsertTodayAnswerEvent_(question, currentAnswer, gradingResult) {
    if (!state.home) {
      state.home = {};
    }
    if (!Array.isArray(state.home.todayAnswerEvents)) {
      state.home.todayAnswerEvents = [];
    }

    var nextEntry = {
      sessionQuestionId: question.sessionQuestionId,
      questionId: question.questionId,
      answerValue: String(currentAnswer),
      isCorrect: gradingResult.isCorrect === true,
      score: Number(gradingResult.score || 0),
      answeredAt: new Date().toISOString()
    };
    var updated = false;
    state.home.todayAnswerEvents = state.home.todayAnswerEvents.map(function (entry) {
      if (entry.sessionQuestionId === question.sessionQuestionId) {
        updated = true;
        return nextEntry;
      }
      return entry;
    });
    if (!updated) {
      state.home.todayAnswerEvents.push(nextEntry);
    }
  }

  // ---- 前に開いたときの中身（端末に残す。きょうの分だけ使う） ----

  function todayJst_() {
    return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }

  // 今日の回と答えを端末に残す（次に開いたとき、すぐ出すため）
  function saveCache_() {
    if (!state.session) {
      return;
    }
    try {
      window.localStorage.setItem(CACHE_KEY, JSON.stringify({
        savedDate: todayJst_(),
        currentQuestionIndex: state.currentQuestionIndex,
        payload: {
          session: state.session,
          home: { todayAnswerEvents: (state.home && state.home.todayAnswerEvents) || [] }
        }
      }));
    } catch (error) {
      // 残せなくても使える
    }
  }

  // 端末に残した今日の分があれば、先に出す（日付がちがえば使わない）
  function restoreFromCache_() {
    try {
      var cached = JSON.parse(window.localStorage.getItem(CACHE_KEY) || "null");
      if (!cached || cached.savedDate !== todayJst_() || !cached.payload || !cached.payload.session) {
        return;
      }
      applyBootstrapPayload_(cached.payload, { resetQuestionIndex: true });
      state.fromCache = true;
    } catch (error) {
      // 読めないときは、ネットの返事を待つ
    }
  }

  // ---- 通信 ----

  function requestJson_(method, action, body) {
    var url = new URL(config.gasWebAppUrl, window.location.href);
    url.searchParams.set("action", action);
    if (config.tenantId) {
      url.searchParams.set("tenantId", config.tenantId);
    }

    var options = {
      method: method,
      mode: "cors",
      headers: { "Accept": "application/json" }
    };

    if (method === "POST") {
      options.body = JSON.stringify(Object.assign({}, buildAuthPayload_(), body || {}, {
        action: action,
        tenantId: config.tenantId
      }));
    }

    return fetch(url.toString(), options).then(function (response) {
      return response.text().then(function (text) {
        var payload;
        try {
          payload = JSON.parse(text);
        } catch (error) {
          payload = { raw: text };
        }

        if (!response.ok || (payload && payload.error)) {
          throw payload;
        }

        return payload;
      });
    });
  }

  // GAS に送る本人の印（LINE の ID トークン・名前・写真）
  function buildAuthPayload_() {
    return {
      lineIdToken: state.liff.idToken || "",
      lineDisplayName: state.liff.profile && state.liff.profile.displayName ? state.liff.profile.displayName : "",
      linePhotoUrl: state.liff.profile && state.liff.profile.pictureUrl ? state.liff.profile.pictureUrl : ""
    };
  }

  // ---- 表示 ----

  function renderAll_() {
    renderProgress_();
    renderQuestionMap_();
    renderQuestionView_();
  }

  // 上の「○月○日の5問・○/○問」と進み具合の帯を出す
  function renderProgress_() {
    var questions = getQuestions_();
    if (!questions.length) {
      progressLabelEl.textContent = "今日の5問";
      progressCountEl.textContent = "—";
      progressFillEl.style.width = "0%";
      return;
    }

    var answered = getAnsweredCount_();
    var dateText = formatDate_(state.session.businessDate);
    progressLabelEl.textContent = dateText ? dateText + " の" + questions.length + "問" : "今日の" + questions.length + "問";
    progressCountEl.textContent = answered + " / " + questions.length + " 問";
    progressFillEl.style.width = ((answered / questions.length) * 100) + "%";
  }

  // 上の問題の番号のボタンを出す（正解・まちがい・まだ）
  function renderQuestionMap_() {
    var questions = getQuestions_();
    questionMapEl.innerHTML = "";
    questionMapEl.hidden = questions.length === 0;

    questions.forEach(function (question, index) {
      var result = state.results[question.sessionQuestionId];
      var button = document.createElement("button");
      button.type = "button";
      button.className = "ls-chip";
      if (index === state.currentQuestionIndex) {
        button.setAttribute("aria-current", "step");
        button.classList.add("is-active");
      }
      var label = document.createElement("span");
      label.textContent = String(index + 1);
      button.appendChild(label);
      if (result) {
        var mark = document.createElement("span");
        mark.className = result.isCorrect ? "mark-ok" : "mark-ng";
        mark.textContent = result.isCorrect ? "○" : "×";
        mark.setAttribute("aria-hidden", "true");
        button.appendChild(mark);
      }
      button.setAttribute("aria-label", "第" + (index + 1) + "問" + (result ? (result.isCorrect ? "（正解）" : "（見なおす）") : "（まだ）"));
      button.addEventListener("click", function () {
        moveToQuestion_(index);
      });
      questionMapEl.appendChild(button);
    });

    if (questions.length && getAnsweredCount_() >= questions.length) {
      var resultButton = document.createElement("button");
      resultButton.type = "button";
      resultButton.className = "ls-chip";
      resultButton.textContent = "🏁 結果";
      if (state.currentQuestionIndex >= questions.length) {
        resultButton.setAttribute("aria-current", "step");
        resultButton.classList.add("is-active");
      }
      resultButton.addEventListener("click", function () {
        state.currentQuestionIndex = questions.length;
        renderAll_();
      });
      questionMapEl.appendChild(resultButton);
    }
  }

  // いまの問題か、結果の画面を出す
  function renderQuestionView_() {
    stopWaitText_();
    var questions = getQuestions_();

    if (!questions.length) {
      if (state.loading) {
        renderSkeleton_();
      } else if (state.loadFailed) {
        renderLoadError_();
      } else {
        renderNoSession_();
      }
      return;
    }

    if (isSessionCompleted_()) {
      renderCompletionView_();
      return;
    }

    var question = questions[state.currentQuestionIndex];
    var answerKey = question.sessionQuestionId;
    var savedAnswer = state.answers[answerKey] || "";
    var result = state.results[answerKey] || null;
    var canAnswer = state.ready && !result;

    questionShellEl.innerHTML = [
      '<article class="ls-panel question-card" aria-labelledby="questionText">',
      '  <div class="question-meta">',
      '    <span class="question-type">' + escapeHtml_(toQuestionTypeLabel_(question.questionType)) + '</span>',
      '    <span>第' + (state.currentQuestionIndex + 1) + '問</span>',
      '  </div>',
      '  <p id="questionText" class="question-text">' + escapeHtml_(question.questionText) + '</p>',
      '  <div class="answer-zone">',
      renderAnswerControl_(question, savedAnswer, !canAnswer),
      '    <p id="answerError" class="ls-hint is-error"' + (state.answerError ? '' : ' hidden') + '>' + escapeHtml_(state.answerError) + '</p>',
      result ? renderResultCard_(question, result) : renderSubmitButton_(),
      '  </div>',
      '</article>',
      result ? '' : renderQuestionNav_()
    ].join("");

    bindQuestionView_(question, answerKey);
  }

  // 「答える」ボタンの HTML
  function renderSubmitButton_() {
    var label = "✏️ 答える";
    var hint = "";
    if (!state.ready) {
      label = state.loadFailed ? "✏️ 答える" : "読みこみ中…";
      if (state.loadFailed) {
        hint = '<p class="ls-hint">つながると、答えを送れます。</p>';
      }
    }
    return '<button id="submitAnswerButton" class="ls-button is-primary is-block big-button" type="button"' + (state.ready ? '' : ' disabled') + '>' + label + '</button>' + hint;
  }

  // 前の問題・次の問題のボタンの HTML
  function renderQuestionNav_() {
    var last = getQuestions_().length - 1;
    return [
      '<div class="question-nav">',
      '  <button id="prevQuestionButton" class="ls-button" type="button"' + (state.currentQuestionIndex === 0 ? ' disabled' : '') + '>← 前の問題</button>',
      '  <button id="nextQuestionButton" class="ls-button" type="button"' + (state.currentQuestionIndex >= last ? ' disabled' : '') + '>次の問題 →</button>',
      '</div>'
    ].join("");
  }

  // 問題の入力とボタンに、押したときの動きを付ける
  function bindQuestionView_(question, answerKey) {
    var answerInputEl = document.getElementById("answerInput");
    if (answerInputEl) {
      answerInputEl.addEventListener("input", function (event) {
        state.answers[answerKey] = event.target.value;
        if (state.answerError) {
          state.answerError = "";
          document.getElementById("answerError").hidden = true;
        }
      });
      answerInputEl.addEventListener("keydown", function (event) {
        if (event.key === "Enter" && !event.isComposing && event.keyCode !== 229) {
          event.preventDefault();
          submitAnswer_(question);
        }
      });
    }

    Array.prototype.forEach.call(questionShellEl.querySelectorAll("[data-tf]"), function (chip) {
      chip.addEventListener("click", function () {
        state.answers[answerKey] = chip.getAttribute("data-tf");
        state.answerError = "";
        renderQuestionView_();
      });
    });

    bindClick_("submitAnswerButton", function () {
      submitAnswer_(question);
    });
    bindClick_("prevQuestionButton", function () {
      moveToQuestion_(state.currentQuestionIndex - 1);
    });
    bindClick_("nextQuestionButton", function () {
      moveToQuestion_(state.currentQuestionIndex + 1, { focus: true });
    });
    bindClick_("finishSessionButton", function () {
      state.currentQuestionIndex = getQuestions_().length;
      renderAll_();
      scrollToTop_();
    });
    bindClick_("retrySaveButton", function () {
      persistAnswerEvent_(question, state.answers[answerKey], state.results[answerKey]);
    });
  }

  // 読みこみ中の形を出す
  function renderSkeleton_() {
    questionShellEl.innerHTML = [
      '<div class="ls-panel skeleton-card" aria-busy="true" aria-label="読みこみ中">',
      '  <span class="ls-skeleton is-short"></span>',
      '  <span class="ls-skeleton is-text"></span>',
      '  <span class="ls-skeleton"></span>',
      '  <span class="ls-skeleton"></span>',
      '  <p id="waitText" class="wait-text" role="status">今日の5問を準備しています…</p>',
      '</div>'
    ].join("");

    // 3秒をこえたら、経過秒数と理由を出す（秒数は読みこみを始めたときから数える）
    var waitTextEl = document.getElementById("waitText");
    var startedAt = Date.now();
    stopWaitText = UI.progress("今日の5問を準備しています", function (text) {
      if (Date.now() - startedAt >= 3000) {
        waitTextEl.textContent = text;
      }
    }, { slowAfter: 6, slowNote: "はじめて開くときは、少し時間がかかります。" });
  }

  // 待っているあいだの文を止める
  function stopWaitText_() {
    if (stopWaitText) {
      stopWaitText();
      stopWaitText = null;
    }
  }

  // 読めなかったときの案内（GAS が返したエラーの番号ごと。ない番号は電波の案内）
  var LOAD_ERROR_REASONS = {
    login_required: { icon: "🔑", text: "だれの記録かを確かめられませんでした。LINE から開きなおしてね。" },
    not_member: { icon: "🏫", text: "この教室の学習者として登録されていません。先生に聞いてね。" },
    questions_not_found: { icon: "📭", text: "まだ問題が用意されていません。先生に聞いてね。" },
    busy: { icon: "⏳", text: "いま混みあっています。少し待ってから、もう一度ためしてね。" },
    network: { icon: "📶", text: "電波のよいところで、もう一度ためしてね。" }
  };

  // 読めなかったときの案内と「もう一度」を出す
  function renderLoadError_() {
    var canOpenInLine = !!config.liffId && !state.liff.inClient;
    var reason = LOAD_ERROR_REASONS[state.loadErrorCode] || LOAD_ERROR_REASONS.network;
    questionShellEl.innerHTML = [
      '<section class="ls-panel">',
      '  <div class="ls-empty">',
      '    <span class="ls-empty-icon" aria-hidden="true">' + reason.icon + '</span>',
      '    <strong>今日の5問を読みこめませんでした</strong>',
      '    <span>' + reason.text + '</span>',
      '    <div class="ls-actions">',
      '      <button id="retryLoadButton" class="ls-button is-primary" type="button">🔄 もう一度</button>',
      canOpenInLine ? '      <a class="ls-button" href="' + escapeHtml_(buildLiffUrl_()) + '">💬 LINEで開きなおす</a>' : '',
      '    </div>',
      '  </div>',
      '</section>'
    ].join("");
    bindClick_("retryLoadButton", bootstrap_);
  }

  // 今日の問題がないときの案内を出す
  function renderNoSession_() {
    questionShellEl.innerHTML = [
      '<section class="ls-panel">',
      '  <div class="ls-empty">',
      '    <span class="ls-empty-icon" aria-hidden="true">📚</span>',
      '    <strong>今日の5問を始めよう</strong>',
      '    <button id="startDailyButton" class="ls-button is-primary" type="button">▶ 今日の5問を始める</button>',
      '  </div>',
      '</section>'
    ].join("");
    bindClick_("startDailyButton", resolveDailySession_);
  }

  // 答えを入れるところ（文字・数字・正しいかまちがいか）の HTML
  function renderAnswerControl_(question, savedAnswer, disabled) {
    var disabledAttr = disabled ? " disabled" : "";

    if (question.questionType === "TRUE_FALSE") {
      return [
        '<div class="tf-choices" role="radiogroup" aria-label="答え">',
        renderTfChip_("true", "⭕ 正しい", savedAnswer, disabledAttr),
        renderTfChip_("false", "❌ まちがい", savedAnswer, disabledAttr),
        '</div>'
      ].join("");
    }

    var inputMode = question.questionType === "NUMBER" ? ' inputmode="decimal"' : '';
    var placeholder = question.questionType === "NUMBER" ? "数字を入れる" : "答えを入れる";
    return '<input id="answerInput" class="ls-input" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="done"' + inputMode +
      ' aria-label="答え" aria-describedby="answerError" placeholder="' + placeholder + '" value="' + escapeHtml_(savedAnswer) + '"' + disabledAttr + '>';
  }

  // 「正しい・まちがい」のボタン1つの HTML
  function renderTfChip_(value, label, savedAnswer, disabledAttr) {
    var checked = savedAnswer === value;
    return '<button type="button" class="ls-chip" role="radio" data-tf="' + value + '" aria-checked="' + (checked ? "true" : "false") + '"' + disabledAttr + '>' + label + '</button>';
  }

  // 答え合わせ（正解・まちがい・答え・説明）の HTML
  function renderResultCard_(question, result) {
    var key = question.sessionQuestionId;
    var explanation = result.explanation || "";
    var isLast = state.currentQuestionIndex >= getQuestions_().length - 1;
    var allAnswered = getAnsweredCount_() >= getQuestions_().length;

    return [
      '<div class="result ' + (result.isCorrect ? 'is-correct' : 'is-incorrect') + '" role="status">',
      '  <div class="result-head">',
      '    <span class="result-mark" aria-hidden="true">' + (result.isCorrect ? '○' : '×') + '</span>',
      '    <div>',
      '      <h2 class="result-title">' + (result.isCorrect ? '正解！' : 'おしい！') + '</h2>',
      result.correctAnswerText ? '      <span>答え：<b>' + escapeHtml_(result.correctAnswerText) + '</b></span>' : '',
      '    </div>',
      '  </div>',
      explanation ? '  <p class="result-body">' + escapeHtml_(explanation) + '</p>' : '',
      renderSaveLine_(key),
      '</div>',
      (isLast || allAnswered)
        ? '<button id="finishSessionButton" class="ls-button is-primary is-block big-button" type="button">🏁 結果を見る</button>'
        : '<button id="nextQuestionButton" class="ls-button is-primary is-block big-button" type="button">次の問題へ →</button>'
    ].join("");
  }

  // 保存のようす（保存しています・保存しました・もう一度）の HTML
  function renderSaveLine_(key) {
    var saveState = state.saveState[key] || "";
    if (saveState === "saving") {
      return '<p class="save-line">保存しています…</p>';
    }
    if (saveState === "failed") {
      return '<p class="save-line is-error"><span>まだ保存できていません</span><button id="retrySaveButton" class="ls-button" type="button">🔄 もう一度</button></p>';
    }
    if (saveState === "saved") {
      return '<p class="save-line">✓ 保存しました</p>';
    }
    return '';
  }

  // 結果の画面（正解の数・見なおす・送る）を出す
  function renderCompletionView_() {
    var total = getQuestions_().length;
    var correctCount = getCorrectCount_();
    var incorrectCount = total - correctCount;
    var accuracy = total === 0 ? 0 : Math.round((correctCount / total) * 100);

    questionShellEl.innerHTML = [
      '<section class="ls-panel" aria-labelledby="completionTitle">',
      '  <h2 id="completionTitle" class="completion-title">🎉 ' + total + '問おわり！</h2>',
      '  <div class="ls-grid-2">',
      '    <div class="stat"><span class="stat-label">正解</span><span class="stat-value">' + correctCount + ' / ' + total + '</span></div>',
      '    <div class="stat"><span class="stat-label">正答率</span><span class="stat-value">' + accuracy + '%</span></div>',
      '  </div>',
      incorrectCount > 0
        ? '  <button id="reviewIncorrectButton" class="ls-button is-block" type="button">🔍 まちがえた問題を見なおす</button>'
        : '  <button id="reviewFirstButton" class="ls-button is-block" type="button">🔁 1問目から見なおす</button>',
      '</section>',
      renderShareSection_(total, accuracy)
    ].join("");

    bindClick_("reviewIncorrectButton", function () {
      var targetIndex = getFirstIncorrectQuestionIndex_();
      moveToQuestion_(targetIndex === -1 ? 0 : targetIndex);
    });
    bindClick_("reviewFirstButton", function () {
      moveToQuestion_(0);
    });
    bindClick_("shareTargetPickerButton", function () {
      shareViaTargetPicker_();
    });
    bindClick_("shareCurrentChatButton", shareToCurrentChat_);
  }

  // 結果を送るところ（見本・ボタン・有料プランの案内）の HTML
  function renderShareSection_(total, accuracy) {
    var canPicker = canUsePremiumShare_();
    var canCurrent = canShareCurrentChat_();
    var buttons = [];
    var notes = [];

    if (canPicker) {
      buttons.push('<button id="shareTargetPickerButton" class="ls-send" type="button"' + (state.sharing ? ' disabled' : '') + '>' + (state.sharing ? '送っています…' : '💬 LINEで送る') + '</button>');
    }
    if (canCurrent) {
      buttons.push('<button id="shareCurrentChatButton" class="' + (canPicker ? 'ls-button is-block' : 'ls-send') + '" type="button"' + (state.sharing ? ' disabled' : '') + '>' + (state.sharing && !canPicker ? '送っています…' : '💬 このトークに送る') + '</button>');
    }

    var outside = "";
    if (!state.liff.inClient && config.liffId) {
      outside = [
        '<div class="ls-outside">',
        '  <p class="ls-outside-text">LINE の外で開いています。LINEで開くと送れます：</p>',
        '  <div class="ls-outside-actions">',
        '    <a class="ls-outside-button is-app" href="' + escapeHtml_(buildLiffUrl_()) + '">💬 LINEで開く</a>',
        '  </div>',
        '</div>'
      ].join("");
    } else if (state.liff.inClient) {
      if (!canCurrent && !canPicker) {
        notes.push("この開き方では送れません。トークの中のリンクから開くと、そのトークに送れます。");
      }
      if (!canPicker && !hasEntitlement_(config.premiumShareEntitlementKey || "shareTargetPicker")) {
        notes.push("ほかのトークに送るのは、有料プランで使えます。");
      }
    }

    return [
      '<section class="ls-panel" aria-labelledby="shareTitle">',
      '  <h2 id="shareTitle" class="ls-panel-title">💬 結果を送る</h2>',
      renderTalkPreview_(total, accuracy),
      outside,
      buttons.join(""),
      notes.map(function (note) {
        return '<p class="ls-hint">' + escapeHtml_(note) + '</p>';
      }).join(""),
      '</section>'
    ].join("");
  }

  // トークに届くカードの見本の HTML
  function renderTalkPreview_(total, accuracy) {
    var receipt = getShareReceiptForSession_();
    return [
      '<div class="talk-preview" aria-label="送るカードの見本">',
      '  <div class="talk-card">',
      '    <div class="talk-card-band"><small>' + escapeHtml_((formatDate_(state.session.businessDate) || "5問体験") + "・" + getLearnerName_(receipt)) + '</small><strong>5問体験 完了</strong></div>',
      '    <div class="talk-card-body">',
      '      <div><small>演習数</small><b>' + total + '問</b></div>',
      '      <div><small>正答率</small><b>' + accuracy + '%</b></div>',
      '      <div class="talk-card-code"><span><small>提出コード</small><b>' + escapeHtml_(receipt && receipt.receiptCode ? receipt.receiptCode : "送るときに作ります") + '</b></span>' +
        (receipt && receipt.receiptCode ? '<span class="talk-card-pill">📋 コピー</span>' : '') + '</div>',
      '    </div>',
      '    <div class="talk-card-actions"><span class="is-primary">📚 5問をやってみる</span></div>',
      '  </div>',
      '</div>'
    ].join("");
  }

  // ---- 答える ----

  function submitAnswer_(question) {
    var answerKey = question.sessionQuestionId;
    if (!state.ready || state.results[answerKey]) {
      return;
    }

    var currentAnswer = String(state.answers[answerKey] || "").trim();
    if (currentAnswer === "") {
      state.answerError = question.questionType === "TRUE_FALSE" ? "どちらかを選んでね" : "答えを入れてね";
      var errorEl = document.getElementById("answerError");
      if (errorEl) {
        errorEl.textContent = state.answerError;
        errorEl.hidden = false;
      }
      return;
    }
    if (question.questionType === "NUMBER" && !isFinite(Number(toHalfWidth_(currentAnswer)))) {
      state.answerError = "数字で入れてね";
      renderQuestionView_();
      return;
    }

    state.answerError = "";
    state.answers[answerKey] = question.questionType === "NUMBER" ? toHalfWidth_(currentAnswer) : currentAnswer;
    var gradingResult = gradeAnswer_(question, state.answers[answerKey]);
    state.results[answerKey] = gradingResult;
    playResultSound_(gradingResult.isCorrect);
    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }
    persistAnswerEvent_(question, state.answers[answerKey], gradingResult);
  }

  // 答えは先に画面に出し（E3）、保存はあとから。保存できなかったら「もう一度」を出す
  function persistAnswerEvent_(question, currentAnswer, gradingResult) {
    var answerKey = question.sessionQuestionId;
    var questionIndex = getQuestions_().indexOf(question);
    state.saveState[answerKey] = "saving";
    upsertTodayAnswerEvent_(question, currentAnswer, gradingResult);
    saveCache_();
    renderAll_();

    requestJson_("POST", config.createAnswerEventAction || "createAnswerEvent", {
      action: config.createAnswerEventAction || "createAnswerEvent",
      tenantId: config.tenantId,
      learningSessionId: state.session.sessionId,
      sessionQuestionId: question.sessionQuestionId,
      questionId: question.questionId,
      idempotencyKey: state.session.sessionId + "_" + question.sessionQuestionId + "_" + questionIndex,
      answerPayload: {
        value: gradingResult.normalizedAnswer
      },
      isCorrect: gradingResult.isCorrect,
      score: gradingResult.score,
      elapsedMs: 0,
      explanationViewed: true
    })
      .then(function (response) {
        state.saveState[answerKey] = "saved";
        renderSaveState_(answerKey);
        renderResponse_(response);
      })
      .catch(function (error) {
        state.saveState[answerKey] = "failed";
        renderSaveState_(answerKey);
        renderError_(error);
        UI.toast("答えを保存できませんでした", {
          actionLabel: "もう一度",
          // 知らせの「もう一度」：同じ答えをもう一度保存する
          onAction: function () {
            persistAnswerEvent_(question, currentAnswer, gradingResult);
          }
        });
      });
  }

  // いまの問題が保存したものなら、出しなおす
  function renderSaveState_(answerKey) {
    var question = getQuestions_()[state.currentQuestionIndex];
    if (question && question.sessionQuestionId === answerKey && !isSessionCompleted_()) {
      renderQuestionView_();
    }
  }

  // 答え合わせをする（GAS の 04_domain.answer_grader.js と同じ決まり）
  function gradeAnswer_(question, rawAnswer) {
    var gradingConfig = question.gradingConfig || {};
    var answerPayload = gradingConfig.correctAnswerPayload || {};
    var normalizedAnswer = normalizeAnswer_(question, rawAnswer);
    var isCorrect = false;

    switch (question.questionType) {
      case "TRUE_FALSE":
        isCorrect = String(normalizedAnswer) === String(answerPayload.exact);
        break;
      case "NUMBER":
        var tolerance = gradingConfig.tolerance === null || gradingConfig.tolerance === undefined ? 0 : Number(gradingConfig.tolerance);
        isCorrect = Math.abs(Number(normalizedAnswer) - Number(answerPayload.exact)) <= tolerance;
        break;
      case "TEXT_EXACT":
      default:
        isCorrect = String(normalizedAnswer).trim().toLowerCase() === String(answerPayload.exact || "").trim().toLowerCase();
        break;
    }

    return {
      isCorrect: isCorrect,
      score: isCorrect ? (gradingConfig.maxScore || 1) : 0,
      explanation: question.explanation || "",
      normalizedAnswer: normalizedAnswer,
      correctAnswerText: toCorrectAnswerText_(question, answerPayload)
    };
  }

  // 答えをそろえる（数字は数に、文字は前後の空白を取る）
  function normalizeAnswer_(question, rawAnswer) {
    if (question.questionType === "NUMBER") {
      return rawAnswer === "" ? "" : Number(rawAnswer);
    }
    if (question.questionType === "TRUE_FALSE") {
      return rawAnswer;
    }
    return String(rawAnswer || "").trim();
  }

  // 全角の数字・点・マイナスを半角にする
  function toHalfWidth_(value) {
    return String(value || "").replace(/[０-９．－]/g, function (ch) {
      return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0);
    }).replace(/ー/g, "-");
  }

  // 正解を、画面に出す文にする
  function toCorrectAnswerText_(question, answerPayload) {
    if (!answerPayload || answerPayload.exact === undefined || answerPayload.exact === null) {
      return "";
    }
    if (question.questionType === "TRUE_FALSE") {
      return String(answerPayload.exact) === "true" ? "正しい" : "まちがい";
    }
    return String(answerPayload.exact);
  }

  // ---- 移動 ----

  function moveToQuestion_(index, options) {
    var questions = getQuestions_();
    state.currentQuestionIndex = Math.max(0, Math.min(index, questions.length - 1));
    state.answerError = "";
    renderAll_();
    scrollToTop_();
    if (options && options.focus) {
      var input = document.getElementById("answerInput");
      if (input && !input.disabled) {
        input.focus({ preventScroll: true });
      }
    }
  }

  // 上が見えないときだけ、進み具合のところまで戻る
  function scrollToTop_() {
    var panel = document.querySelector(".progress-panel");
    if (panel && panel.getBoundingClientRect().top < 0) {
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  // はじめにまちがえた問題の番号（なければ -1）
  function getFirstIncorrectQuestionIndex_() {
    return getQuestions_().findIndex(function (question) {
      var result = state.results[question.sessionQuestionId];
      return result && !result.isCorrect;
    });
  }

  // ---- 効果音 ----

  function initializeAudioSettings_() {
    try {
      var raw = window.localStorage.getItem(AUDIO_KEY);
      if (raw) {
        state.audio.enabled = JSON.parse(raw).enabled !== false;
      }
    } catch (error) {
      state.audio.enabled = true;
    }

    soundToggleButtonEl.addEventListener("click", function () {
      state.audio.enabled = !state.audio.enabled;
      try {
        window.localStorage.setItem(AUDIO_KEY, JSON.stringify({ enabled: state.audio.enabled }));
      } catch (error) {
        // 残せなくても切りかえはできる
      }
      updateAudioUi_();
      UI.toast(state.audio.enabled ? "🔊 効果音をオンにしました" : "🔇 効果音をオフにしました", { ms: 2000 });
    });
    updateAudioUi_();
  }

  // 効果音のボタンの見た目を変える
  function updateAudioUi_() {
    soundToggleButtonEl.setAttribute("aria-pressed", state.audio.enabled ? "true" : "false");
  }

  // 正解・まちがいの効果音を鳴らす（音を切っていれば鳴らさない）
  function playResultSound_(isCorrect) {
    if (!state.audio.enabled || !window.AudioContext) {
      return;
    }

    try {
      var context = new window.AudioContext();
      if (typeof context.resume === "function") {
        context.resume();
      }
      var now = context.currentTime;
      var gainNode = context.createGain();
      gainNode.gain.value = 1;
      gainNode.connect(context.destination);

      if (isCorrect) {
        playTone_(context, gainNode, 523.25, now, 0.11, state.audio.volume);
        playTone_(context, gainNode, 659.25, now + 0.12, 0.16, state.audio.volume * 0.9);
      } else {
        playTone_(context, gainNode, 330.0, now, 0.14, state.audio.volume * 0.8);
        playTone_(context, gainNode, 262.0, now + 0.12, 0.2, state.audio.volume * 0.7);
      }

      window.setTimeout(function () {
        context.close().catch(function () {});
      }, 500);
    } catch (error) {
      // 音が出せなくても続けられる
    }
  }

  // 音を1つ鳴らす
  function playTone_(context, gainNode, frequency, startAt, duration, volume) {
    var oscillator = context.createOscillator();
    var noteGain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    noteGain.gain.setValueAtTime(0.0001, startAt);
    noteGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), startAt + 0.02);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    oscillator.connect(noteGain);
    noteGain.connect(gainNode);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.02);
  }

  // ---- LINE で送る ----

  function canShareCurrentChat_() {
    return state.liff.ready && state.liff.loggedIn && state.liff.canSendMessages;
  }

  // ほかのトークに送れるか（有料の機能があり、LINE の中で使えるとき）
  function canUsePremiumShare_() {
    return !!(
      state.liff.ready &&
      state.liff.inClient &&
      state.liff.loggedIn &&
      state.liff.canShareTargetPicker &&
      hasEntitlement_(config.premiumShareEntitlementKey || "shareTargetPicker")
    );
  }

  // 教室で、その機能が使えるか
  function hasEntitlement_(featureKey) {
    if (!state.me || !state.me.entitlements || !featureKey) {
      return false;
    }
    return state.me.entitlements.some(function (entry) {
      return entry.feature_key === featureKey && (entry.enabled === true || entry.enabled === "true");
    });
  }

  // 結果に出す名前（提出コード・LINE の名前・「学習者」の順）
  function getLearnerName_(receipt) {
    if (receipt && receipt.learnerName) {
      return receipt.learnerName;
    }
    if (state.liff.profile && state.liff.profile.displayName) {
      return state.liff.profile.displayName;
    }
    return state.me && state.me.user && state.me.user.display_name ? state.me.user.display_name : "学習者";
  }

  // この回の提出コード（前に作ったもの）
  function getShareReceiptForSession_() {
    var sessionId = state.session && state.session.sessionId ? state.session.sessionId : "";
    return sessionId && state.shareReceiptCodes[sessionId] ? state.shareReceiptCodes[sessionId] : null;
  }

  // トークに送るメッセージ（結果のカード）
  function buildShareMessages_() {
    var receipt = getShareReceiptForSession_();
    return [{
      type: "flex",
      altText: "5問体験の結果（提出コード " + (receipt && receipt.receiptCode ? receipt.receiptCode : "") + "）",
      contents: buildShareResultBubble_(receipt)
    }];
  }

  // 結果のカード（日付・名前・数字・提出コードとコピー・5問をやってみるボタン）
  function buildShareResultBubble_(receipt) {
    var receiptCode = receipt && receipt.receiptCode ? receipt.receiptCode : "発行準備中";
    var totalQuestions = receipt && receipt.totalQuestions ? Number(receipt.totalQuestions) : getQuestions_().length;
    var accuracyRate = receipt && receipt.accuracyRate !== undefined && receipt.accuracyRate !== null
      ? Number(receipt.accuracyRate)
      : (totalQuestions === 0 ? 0 : Math.round((getCorrectCount_() / totalQuestions) * 100));

    return {
      type: "bubble",
      header: {
        type: "box",
        layout: "vertical",
        paddingAll: "16px",
        backgroundColor: "#17624A",
        contents: [
          { type: "text", text: (formatDate_(state.session && state.session.businessDate) || "5問体験") + "・" + getLearnerName_(receipt), color: "#DDEFE7", size: "xs", wrap: true },
          { type: "text", text: "5問体験 完了", color: "#F8F4ED", weight: "bold", size: "xl", margin: "sm" }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "box",
            layout: "horizontal",
            spacing: "sm",
            contents: [
              buildStatBox_("演習数", String(totalQuestions) + "問"),
              buildStatBox_("正答率", String(accuracyRate) + "%")
            ]
          },
          buildReceiptCodeRow_(receiptCode, !!(receipt && receipt.receiptCode)),
          { type: "text", text: "くわしい結果は、提出コードで管理者が確かめます。", size: "xs", wrap: true, color: "#7A7165" }
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
            action: { type: "uri", label: "📚 5問をやってみる", uri: buildLiffUrl_({ entry: "shared-result" }) }
          }
        ]
      }
    };
  }

  // 提出コードの行。コードがあるときだけ、行の右端に丸いコピーのボタン
  function buildReceiptCodeRow_(receiptCode, canCopy) {
    var row = {
      type: "box",
      layout: "horizontal",
      backgroundColor: "#F6EFE4",
      cornerRadius: "12px",
      paddingAll: "12px",
      spacing: "sm",
      contents: [
        {
          type: "box",
          layout: "vertical",
          flex: 1,
          contents: [
            { type: "text", text: "提出コード", size: "xs", color: "#7A7165" },
            { type: "text", text: receiptCode, size: "xl", weight: "bold", color: "#1C1B18", margin: "sm" }
          ]
        }
      ]
    };
    if (canCopy) {
      row.contents.push({
        type: "box",
        layout: "vertical",
        flex: 0,
        justifyContent: "center",
        contents: [
          {
            type: "box",
            layout: "vertical",
            cornerRadius: "xxl",
            borderWidth: "1px",
            borderColor: "#17624A",
            backgroundColor: "#FFFFFF",
            paddingTop: "6px",
            paddingBottom: "6px",
            paddingStart: "12px",
            paddingEnd: "12px",
            action: { type: "clipboard", label: "コピー", clipboardText: receiptCode },
            contents: [
              { type: "text", text: "📋 コピー", size: "xs", weight: "bold", color: "#17624A", align: "center" }
            ]
          }
        ]
      });
    }
    return row;
  }

  // 結果のカードの数字の箱1つ
  function buildStatBox_(label, value) {
    return {
      type: "box",
      layout: "vertical",
      flex: 1,
      cornerRadius: "12px",
      paddingAll: "12px",
      backgroundColor: "#F6EFE4",
      contents: [
        { type: "text", text: label, size: "xs", color: "#7A7165" },
        { type: "text", text: value, size: "lg", weight: "bold", color: "#1C1B18", margin: "sm" }
      ]
    };
  }

  // この画面の LIFF の URL（LIFF がなければ learn.html）
  function buildLiffUrl_(params) {
    var search = new URLSearchParams(params || {}).toString();
    if (config.liffId) {
      return "https://liff.line.me/" + encodeURIComponent(config.liffId) + (search ? "?" + search : "");
    }
    var url = new URL("./learn.html", window.location.href);
    Object.keys(params || {}).forEach(function (key) {
      url.searchParams.set(key, params[key]);
    });
    return url.toString();
  }

  // 提出コードを用意する（なければ GAS に作ってもらう）
  function ensureShareReceipt_(shareChannel) {
    var existing = getShareReceiptForSession_();
    if (existing && existing.receiptCode) {
      return Promise.resolve(existing);
    }

    var total = getQuestions_().length;
    return requestJson_("POST", config.createShareReceiptAction || "createShareReceipt", {
      action: config.createShareReceiptAction || "createShareReceipt",
      tenantId: config.tenantId,
      learningSessionId: state.session.sessionId,
      totalQuestions: total,
      correctCount: getCorrectCount_(),
      accuracyRate: total === 0 ? 0 : Math.round((getCorrectCount_() / total) * 100),
      shareChannel: shareChannel || ""
    }).then(function (response) {
      var receipt = response && response.receipt ? response.receipt : null;
      if (!receipt || !receipt.receiptCode) {
        throw new Error("share_receipt_not_created");
      }
      state.shareReceiptCodes[state.session.sessionId] = receipt;
      return receipt;
    });
  }

  // 送っているあいだかを変えて、結果の画面を出しなおす
  function setSharing_(sharing) {
    state.sharing = sharing;
    if (isSessionCompleted_()) {
      renderCompletionView_();
    }
  }

  // いまのトークに結果を送る
  function shareToCurrentChat_() {
    if (!canShareCurrentChat_() || state.sharing) {
      return;
    }

    setSharing_(true);
    ensureShareReceipt_("current_chat")
      .then(function () {
        return window.liff.sendMessages(buildShareMessages_());
      })
      .then(function () {
        setSharing_(false);
        UI.afterSent({ title: "このトークに送りました" });
      })
      .catch(function (error) {
        setSharing_(false);
        renderError_({ shareCurrentChat: error && error.message ? error.message : String(error) });
        UI.toast("送れませんでした", { actionLabel: "もう一度", onAction: shareToCurrentChat_ });
      });
  }

  // 送れたら true（afterSent の「続けて別のトークにも送る」からも呼ぶ）
  function shareViaTargetPicker_(fromAfterSent) {
    if (!canUsePremiumShare_() || state.sharing) {
      return Promise.resolve(false);
    }

    setSharing_(true);
    return ensureShareReceipt_("share_target_picker")
      .then(function () {
        return window.liff.shareTargetPicker(buildShareMessages_(), { isMultiple: false });
      })
      .then(function (result) {
        setSharing_(false);
        if (result && !fromAfterSent) {
          UI.afterSent({
            // 送ったあとの案内の「続けて別のトークにも送る」
            resend: function () {
              return shareViaTargetPicker_(true);
            }
          });
        }
        return !!result;
      })
      .catch(function (error) {
        setSharing_(false);
        renderError_({ shareTargetPicker: error && error.message ? error.message : String(error) });
        if (fromAfterSent) {
          throw error;
        }
        UI.toast("送れませんでした", {
          actionLabel: "もう一度",
          // 知らせの「もう一度」：もう一度ほかのトークをえらぶ
          onAction: function () {
            shareViaTargetPicker_();
          }
        });
        return false;
      });
  }

  // ---- 小さな道具 ----

  function getQuestions_() {
    return state.session && state.session.questions ? state.session.questions : [];
  }

  // 答えた問題の数
  function getAnsweredCount_() {
    return getSessionResultEntries_().length;
  }

  // 全部答えて、結果の画面にいるか
  function isSessionCompleted_() {
    var questions = getQuestions_();
    return questions.length > 0 && getAnsweredCount_() >= questions.length && state.currentQuestionIndex >= questions.length;
  }

  // 正解の数
  function getCorrectCount_() {
    return getSessionResultEntries_().filter(function (entry) {
      return entry.isCorrect;
    }).length;
  }

  // この回の答え合わせの一覧（答えた分だけ）
  function getSessionResultEntries_() {
    return getQuestions_().map(function (question) {
      return state.results[question.sessionQuestionId] || null;
    }).filter(Boolean);
  }

  // 回が変わったら答えを空にする。同じ回なら、ない問題の答えを外す。空にしたかを返す
  function syncStateWithSession_() {
    var nextSessionId = state.session && state.session.sessionId ? state.session.sessionId : "";
    var allowedKeys = {};
    getQuestions_().forEach(function (question) {
      allowedKeys[question.sessionQuestionId] = true;
    });

    if (nextSessionId !== activeSessionId) {
      activeSessionId = nextSessionId;
      state.answers = {};
      state.results = {};
      state.saveState = {};
      return true;
    }

    state.answers = filterByKeys_(state.answers, allowedKeys);
    state.results = filterByKeys_(state.results, allowedKeys);
    state.saveState = filterByKeys_(state.saveState, allowedKeys);
    return false;
  }

  // 決めた名前の項目だけ残す
  function filterByKeys_(source, allowedKeys) {
    return Object.keys(source || {}).reduce(function (accumulator, key) {
      if (allowedKeys[key]) {
        accumulator[key] = source[key];
      }
      return accumulator;
    }, {});
  }

  // 問題の種類の名前
  function toQuestionTypeLabel_(questionType) {
    switch (questionType) {
      case "TEXT_EXACT":
        return "✏️ 書いて答える";
      case "TRUE_FALSE":
        return "⭕ 正しいか、まちがいか";
      case "NUMBER":
        return "🔢 数字で答える";
      default:
        return "";
    }
  }

  // シートの日付は "2026-10-23" か、日付に変わった "2026-10-22T15:00:00.000Z" で来る
  function formatDate_(value) {
    if (!value) {
      return "";
    }
    var text = String(value);
    var date = /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(text + "T00:00:00+09:00") : new Date(text);
    if (isNaN(date.getTime())) {
      return "";
    }
    var jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
    return (jst.getUTCMonth() + 1) + "月" + jst.getUTCDate() + "日";
  }

  // ID の要素があれば、押したときの動きを付ける
  function bindClick_(id, handler) {
    var element = document.getElementById(id);
    if (element) {
      element.addEventListener("click", handler);
    }
  }

  // version.json から版を読んで、下に出す
  function loadVersionInfo_() {
    fetch("./version.json", { cache: "no-store" })
      .then(function (response) {
        return response.ok ? response.json() : null;
      })
      .then(function (payload) {
        renderVersion_(payload && (payload.version || payload.commit) ? (payload.version || payload.commit) : config.appVersion);
      })
      .catch(function () {
        renderVersion_(config.appVersion);
      });
  }

  // 下の版の文字を出す
  function renderVersion_(version) {
    versionTextEl.textContent = version ? "ver " + version : "ver dev";
  }

  // くわしい中身は ?debug=1 のときだけ（ふつうの人には出さない）
  function renderResponse_(payload) {
    if (debugMode) {
      responsePanelEl.textContent = JSON.stringify(payload, null, 2);
    }
  }

  // エラーの番号（GAS が返した error.code）
  function errorCode_(error) {
    return error && error.error && error.error.code ? String(error.error.code) : "";
  }

  // くわしいエラーは ?debug=1 のときだけ出す
  function renderError_(error) {
    if (debugMode) {
      responsePanelEl.textContent = JSON.stringify(error, null, 2);
    }
  }

  // HTML に入れる文字の < > & " ' をそのまま出す形にする
  function escapeHtml_(value) {
    return String(value === undefined || value === null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
