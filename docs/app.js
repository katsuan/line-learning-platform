// トップ（index.html）の動き。
// 中身：?debug=1 のときだけ出す、GAS との接続の確かめ（health・getSetupStatus など）。
// 読むところ：index.html（config.js のあと）。
(function () {
  // ふつうの人には出さない。?debug=1 のときだけ接続確認を出す
  if (new URLSearchParams(window.location.search).get("debug") !== "1") {
    return;
  }

  var config = window.APP_CONFIG || {};
  var devPanelEl = document.getElementById("devPanel");
  var statusEl = document.getElementById("status");
  var responsePanelEl = document.getElementById("responsePanel");
  var endpointEl = document.getElementById("endpoint");
  var fetchedAtEl = document.getElementById("fetchedAt");
  var openEndpointEl = document.getElementById("openEndpoint");

  devPanelEl.hidden = false;
  devPanelEl.open = true;
  document.getElementById("appName").textContent = config.appName || "LearningPlatform";
  document.getElementById("tenantId").textContent = config.tenantId || "-";
  document.getElementById("origin").textContent = window.location.origin;

  Array.prototype.forEach.call(document.querySelectorAll("[data-action]"), function (button) {
    button.addEventListener("click", function () {
      runAction_(button.getAttribute("data-action"));
    });
  });
  runAction_("health");

  // 1つの確かめ（health など）を GAS に送り、結果を下の欄に出す
  function runAction_(actionKey) {
    var request = buildRequest_(actionKey);
    setStatus_("", "Checking…");
    responsePanelEl.textContent = "Loading...";
    endpointEl.textContent = request.url;
    openEndpointEl.href = request.url;

    fetch(request.url, {
      method: request.method,
      mode: "cors",
      headers: { "Accept": "application/json" },
      body: request.body
    })
      .then(function (response) {
        return response.text().then(function (text) {
          var payload;
          try {
            payload = JSON.parse(text);
          } catch (error) {
            payload = { raw: text };
          }
          if (!response.ok) {
            throw { message: "HTTP " + response.status, payload: payload };
          }
          setStatus_("is-ok", payload.ok ? "OK" : "Responded");
          fetchedAtEl.textContent = new Date().toLocaleString("ja-JP");
          responsePanelEl.textContent = JSON.stringify(payload, null, 2);
        });
      })
      .catch(function (error) {
        setStatus_("is-error", "Error");
        fetchedAtEl.textContent = new Date().toLocaleString("ja-JP");
        responsePanelEl.textContent = JSON.stringify({
          message: error && error.message ? error.message : "Request failed",
          payload: error && error.payload ? error.payload : null
        }, null, 2);
      });
  }

  // 上の「OK・Error」の印を変える
  function setStatus_(className, label) {
    statusEl.className = "dev-status " + className;
    statusEl.textContent = label;
  }

  // GAS の URL に action と tenantId を付ける
  function buildUrl_(action, tenantId) {
    var url = new URL(config.gasWebAppUrl, window.location.href);
    url.searchParams.set("action", action);
    if (tenantId) {
      url.searchParams.set("tenantId", tenantId);
    }
    return url.toString();
  }

  // ボタンの種類から、送る呼び出し（GET か POST・URL・本文）を決める
  function buildRequest_(actionKey) {
    var tenantId = config.tenantId || "";
    switch (actionKey) {
      case "setup":
        return { method: "GET", url: buildUrl_(config.setupStatusAction || "getSetupStatus", tenantId), body: null };
      case "me":
        return { method: "GET", url: buildUrl_(config.meAction || "getMe", tenantId), body: null };
      case "home":
        return { method: "GET", url: buildUrl_(config.homeAction || "getHome", tenantId), body: null };
      case "daily":
        return {
          method: "POST",
          url: buildUrl_(config.resolveDailySessionAction || "resolveDailySession", tenantId),
          body: JSON.stringify({ action: config.resolveDailySessionAction || "resolveDailySession", tenantId: tenantId })
        };
      case "health":
      default:
        return { method: "GET", url: buildUrl_(config.healthAction || "health", ""), body: null };
    }
  }
})();
