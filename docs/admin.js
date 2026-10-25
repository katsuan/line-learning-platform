// 管理の画面（admin.html）の動き。
// 中身：LINE でログイン → 学習者の一覧とくわしい記録を GAS から読んで出す（管理者だけ）。
// 読むところ：admin.html（LIFF の SDK・config.js のあと）。設定は config.js の APP_CONFIG。
(function () {
  var config = window.APP_CONFIG || {};
  var state = {
    learners: [],
    loadingList: false,
    listFailed: false,
    selectedMembershipId: "",
    selectedLearner: null,
    loadingDetail: false,
    detailFailed: false,
    // 管理者かどうか："checking" → "ok" / "login" / "denied" / "liff_failed"
    access: "checking",
    idToken: ""
  };

  var gatePanelEl = document.getElementById("gatePanel");
  var statsPanelEl = document.getElementById("statsPanel");
  var layoutPanelEl = document.getElementById("layoutPanel");

  var learnerCountEl = document.getElementById("learnerCount");
  var totalAnsweredEl = document.getElementById("totalAnswered");
  var averageAccuracyEl = document.getElementById("averageAccuracy");
  var learnerListEl = document.getElementById("learnerList");
  var learnerDetailEl = document.getElementById("learnerDetail");
  var detailPanelEl = document.getElementById("detailPanel");
  var refreshButtonEl = document.getElementById("refreshButton");
  var responsePanelEl = document.getElementById("responsePanel");
  var debugMode = new URLSearchParams(window.location.search).get("debug") === "1";

  if (debugMode) {
    document.getElementById("debugPanel").hidden = false;
  }

  refreshButtonEl.addEventListener("click", loadLearners_);
  initializeLiff_().then(function (ready) {
    if (ready) {
      loadLearners_();
    }
  });

  // ---- ログイン（管理の API は、LINE の ID トークンがないと断られる） ----

  function initializeLiff_() {
    var liffId = config.adminLiffId || config.liffId;
    if (!liffId || !window.liff) {
      setAccess_("liff_failed");
      return Promise.resolve(false);
    }

    return window.liff.init({ liffId: liffId })
      .then(function () {
        state.idToken = window.liff.isLoggedIn() ? (window.liff.getIDToken() || "") : "";
        if (!state.idToken) {
          setAccess_("login");
          return false;
        }
        return true;
      })
      .catch(function (error) {
        setAccess_("liff_failed");
        renderResponse_({ liff: error && error.message ? error.message : String(error) });
        return false;
      });
  }

  // LINE のログインの画面へ移る（ちがうアカウントのときは、いったんログアウト）
  function login_() {
    if (!window.liff || !window.liff.login) {
      return;
    }
    // ちがうアカウントに替えるときは、いったんログアウトする（LINE アプリの中ではできない）
    if (window.liff.isLoggedIn() && !window.liff.isInClient()) {
      window.liff.logout();
    }
    window.liff.login({ redirectUri: window.location.href });
  }

  // 見られるか（ok・確かめ中・断られた・ログインがいる・つながらない）に合わせて、画面と案内を切りかえる
  function setAccess_(access) {
    state.access = access;
    var open = access === "ok" || access === "checking";
    gatePanelEl.hidden = open;
    statsPanelEl.hidden = !open;
    layoutPanelEl.hidden = !open;
    refreshButtonEl.hidden = !open;
    if (open) {
      gatePanelEl.innerHTML = "";
      return;
    }

    var gate = {
      denied: {
        icon: "🔒",
        title: "管理者だけが見られます",
        text: "この LINE のアカウントは、管理者として登録されていません。<br>ちがうアカウントなら、ログインし直してください。",
        button: "🔑 ちがうアカウントでログイン",
        primary: false
      },
      login: {
        icon: "🔑",
        title: "管理者だけが見られます",
        text: "LINE でログインすると、管理者かどうかを確かめます。",
        button: "LINE でログイン",
        primary: true
      },
      liff_failed: {
        icon: "📶",
        title: "LINE のログインを始められませんでした",
        text: "時間をおいて、もう一度開いてください。",
        button: "🔄 もう一度",
        primary: true
      }
    }[access];

    gatePanelEl.innerHTML = [
      '<div class="ls-empty">',
      '  <span class="ls-empty-icon" aria-hidden="true">' + gate.icon + '</span>',
      '  <strong>' + gate.title + '</strong>',
      '  <span>' + gate.text + '</span>',
      '  <button id="gateButton" class="ls-button' + (gate.primary ? ' is-primary' : '') + '" type="button">' + gate.button + '</button>',
      '</div>'
    ].join("");
    document.getElementById("gateButton").addEventListener("click", function () {
      if (access === "liff_failed") {
        window.location.reload();
      } else {
        login_();
      }
    });
  }

  // 断られたときは、一覧ではなく案内を出す
  function handleAccessError_(error) {
    var code = error && error.error ? error.error.code : "";
    if (code === "admin_only") {
      setAccess_("denied");
      return true;
    }
    if (code === "admin_login_required") {
      setAccess_("login");
      return true;
    }
    return false;
  }

  // 学習者の一覧を GAS から読み、上の数字と一覧を出す
  function loadLearners_() {
    if (state.loadingList) {
      return;
    }
    state.loadingList = true;
    state.listFailed = false;
    refreshButtonEl.disabled = true;
    renderLearnerList_();
    if (!state.selectedLearner) {
      renderLearnerDetail_();
    }

    requestJson_(config.adminLearnersAction || "listAdminLearners")
      .then(function (payload) {
        state.loadingList = false;
        setAccess_("ok");
        state.learners = payload.learners || [];
        var stillThere = state.learners.some(function (learner) {
          return learner.membershipId === state.selectedMembershipId;
        });
        if (!stillThere) {
          state.selectedMembershipId = state.learners[0] ? state.learners[0].membershipId : "";
        }
        renderSummary_();
        renderLearnerList_();
        renderResponse_(payload);
        if (state.selectedMembershipId) {
          loadLearnerDetail_(state.selectedMembershipId);
        } else {
          state.selectedLearner = null;
          renderLearnerDetail_();
        }
      })
      .catch(function (error) {
        state.loadingList = false;
        renderResponse_(error);
        if (handleAccessError_(error)) {
          return;
        }
        state.listFailed = true;
        renderLearnerList_();
        renderLearnerDetail_();
      })
      .then(function () {
        refreshButtonEl.disabled = false;
      });
  }

  // 1人のくわしい記録を GAS から読んで出す
  function loadLearnerDetail_(membershipId) {
    state.selectedMembershipId = membershipId;
    state.loadingDetail = true;
    state.detailFailed = false;
    renderLearnerList_();
    renderLearnerDetail_();

    requestJson_(config.adminLearnerDetailAction || "getAdminLearnerDetail", { membershipId: membershipId })
      .then(function (payload) {
        if (membershipId !== state.selectedMembershipId) {
          return;
        }
        state.loadingDetail = false;
        state.selectedLearner = payload.learner || null;
        renderLearnerDetail_();
        renderResponse_(payload);
      })
      .catch(function (error) {
        if (membershipId !== state.selectedMembershipId) {
          return;
        }
        state.loadingDetail = false;
        renderResponse_(error);
        if (handleAccessError_(error)) {
          return;
        }
        state.detailFailed = true;
        renderLearnerDetail_();
      });
  }

  // GAS に POST で送る（ID トークンは URL に入れず本文で）。エラーなら throw
  function requestJson_(action, extraParams) {
    var url = new URL(config.gasWebAppUrl, window.location.href);
    url.searchParams.set("action", action);
    if (config.tenantId) {
      url.searchParams.set("tenantId", config.tenantId);
    }

    // ID トークンは URL に入れず、本文で送る（本文は text/plain なので、事前の確認なしで届く）
    return fetch(url.toString(), {
      method: "POST",
      mode: "cors",
      headers: { "Accept": "application/json" },
      body: JSON.stringify(Object.assign({}, extraParams || {}, {
        action: action,
        tenantId: config.tenantId,
        lineIdToken: state.idToken
      }))
    }).then(function (response) {
      return response.text().then(function (text) {
        var payload;
        try {
          payload = JSON.parse(text);
        } catch (error) {
          payload = { raw: text };
        }
        if (!response.ok || payload.error) {
          throw payload;
        }
        return payload;
      });
    });
  }

  // 上の数字（学習者の数・答えた数・平均の正答率）を出す
  function renderSummary_() {
    var learners = state.learners;
    learnerCountEl.textContent = learners.length + "人";
    totalAnsweredEl.textContent = learners.reduce(function (sum, learner) {
      return sum + Number(learner.totalAnsweredCount || 0);
    }, 0) + "問";
    var average = learners.length === 0 ? 0 : learners.reduce(function (sum, learner) {
      return sum + Number(learner.accuracyRate || 0);
    }, 0) / learners.length;
    averageAccuracyEl.textContent = Math.round(average * 100) + "%";
  }

  // 学習者の一覧を出す（押すと、くわしい記録）
  function renderLearnerList_() {
    if (state.loadingList && state.learners.length === 0) {
      learnerListEl.innerHTML = '<span class="ls-skeleton"></span><span class="ls-skeleton"></span><span class="ls-skeleton"></span>';
      return;
    }

    if (state.listFailed) {
      learnerListEl.innerHTML = [
        '<div class="ls-empty">',
        '  <span class="ls-empty-icon" aria-hidden="true">📶</span>',
        '  <span>学習者を読みこめませんでした。</span>',
        '  <button id="retryListButton" class="ls-button is-primary" type="button">🔄 もう一度</button>',
        '</div>'
      ].join("");
      document.getElementById("retryListButton").addEventListener("click", loadLearners_);
      return;
    }

    if (state.learners.length === 0) {
      learnerListEl.innerHTML = '<div class="ls-empty"><span class="ls-empty-icon" aria-hidden="true">🌱</span><span>まだ学習者がいません。<br>LINE で5問を解いた人が、ここに出ます。</span></div>';
      return;
    }

    learnerListEl.innerHTML = "";
    state.learners.forEach(function (learner) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "ls-list-item learner-item";
      if (learner.membershipId === state.selectedMembershipId) {
        button.setAttribute("aria-current", "true");
      }
      var name = document.createElement("strong");
      name.textContent = learner.displayName || "名前なし";
      var meta = document.createElement("small");
      meta.textContent = Number(learner.totalAnsweredCount || 0) + "問・正答率 " + Math.round((learner.accuracyRate || 0) * 100) + "%" +
        (learner.lastLearnedAt ? "・" + formatDateTime_(learner.lastLearnedAt) : "");
      button.appendChild(name);
      button.appendChild(meta);
      button.addEventListener("click", function () {
        loadLearnerDetail_(learner.membershipId);
        if (window.matchMedia("(max-width: 899px)").matches) {
          detailPanelEl.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
      learnerListEl.appendChild(button);
    });
  }

  // えらんだ学習者のくわしい記録を出す
  function renderLearnerDetail_() {
    if (state.loadingDetail || (state.loadingList && !state.selectedLearner)) {
      learnerDetailEl.innerHTML = '<span class="ls-skeleton" style="width: 50%; min-height: 28px;"></span><span class="ls-skeleton" style="min-height: 72px;"></span><span class="ls-skeleton"></span><span class="ls-skeleton"></span>';
      return;
    }

    if (state.detailFailed) {
      learnerDetailEl.innerHTML = [
        '<div class="ls-empty">',
        '  <span class="ls-empty-icon" aria-hidden="true">📶</span>',
        '  <span>くわしい記録を読みこめませんでした。</span>',
        '  <button id="retryDetailButton" class="ls-button is-primary" type="button">🔄 もう一度</button>',
        '</div>'
      ].join("");
      document.getElementById("retryDetailButton").addEventListener("click", function () {
        loadLearnerDetail_(state.selectedMembershipId);
      });
      return;
    }

    if (!state.selectedLearner) {
      learnerDetailEl.innerHTML = '<div class="ls-empty"><span>学習者を選ぶと、ここに記録が出ます。</span></div>';
      return;
    }

    var learner = state.selectedLearner;
    var summary = learner.summary || {};
    var recentSessions = learner.recentSessions || [];

    learnerDetailEl.innerHTML = [
      '<h3 class="detail-name">' + escapeHtml_((learner.user && learner.user.display_name) || "名前なし") + '</h3>',
      '<div class="stats">',
      '  <div class="stat"><span class="stat-label">答えた数</span><span class="stat-value">' + Number(summary.totalAnsweredCount || 0) + '問</span></div>',
      '  <div class="stat"><span class="stat-label">正答率</span><span class="stat-value">' + Math.round((summary.accuracyRate || 0) * 100) + '%</span></div>',
      '  <div class="stat"><span class="stat-label">さいごに解いた日</span><span class="stat-value" style="font-size: 16px;">' + escapeHtml_(summary.lastLearnedAt ? formatDateTime_(summary.lastLearnedAt) : "まだ") + '</span></div>',
      '</div>',
      '<h3 class="ls-panel-title">🗓 最近の5問</h3>',
      renderRecentSessions_(recentSessions)
    ].join("");
  }

  // 最近の回の一覧の HTML
  function renderRecentSessions_(recentSessions) {
    if (!recentSessions.length) {
      return '<p class="ls-hint">まだ記録がありません。</p>';
    }

    return '<div class="ls-stack" style="gap: 6px;">' + recentSessions.map(function (session) {
      return '<div class="session-row"><span>' + escapeHtml_(formatDate_(session.businessDate || session.createdAt) || "日付なし") + '・' + escapeHtml_(toSessionTypeLabel_(session.sessionType)) + '</span>' +
        '<span>' + Number(session.questionCount || 0) + '問・' + escapeHtml_(toStatusLabel_(session.status)) + '</span></div>';
    }).join("") + '</div>';
  }

  // 回の種類の名前
  function toSessionTypeLabel_(type) {
    return type === "DAILY" ? "今日の5問" : "学習";
  }

  // 回の進み具合の名前（まだ・とちゅう・おわり）
  function toStatusLabel_(status) {
    switch (status) {
      case "COMPLETED":
        return "おわり";
      case "IN_PROGRESS":
        return "とちゅう";
      case "CREATED":
        return "まだ";
      default:
        return "—";
    }
  }

  // シートの日付は "2026-10-23" か ISO の日時で来る。日本の日付で出す
  function toJstDate_(value) {
    var text = String(value || "");
    var date = /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(text + "T00:00:00+09:00") : new Date(text);
    return isNaN(date.getTime()) ? null : new Date(date.getTime() + 9 * 60 * 60 * 1000);
  }

  // 日付を「M月d日」にする
  function formatDate_(value) {
    var jst = toJstDate_(value);
    return jst ? (jst.getUTCMonth() + 1) + "月" + jst.getUTCDate() + "日" : "";
  }

  // 日時を「M月d日 H:mm」にする
  function formatDateTime_(value) {
    var jst = toJstDate_(value);
    if (!jst) {
      return "";
    }
    var minutes = String(jst.getUTCMinutes()).padStart(2, "0");
    return (jst.getUTCMonth() + 1) + "月" + jst.getUTCDate() + "日 " + jst.getUTCHours() + ":" + minutes;
  }

  // くわしい中身は ?debug=1 のときだけ
  function renderResponse_(payload) {
    if (debugMode) {
      responsePanelEl.textContent = JSON.stringify(payload, null, 2);
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
