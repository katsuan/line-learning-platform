// 管理の API は、LINE でログインした管理者だけが使える。そのことを Node で確かめる。
// 動かし方：node --test services/gas/test
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SRC = path.join(__dirname, "..", "src");
const SYSTEM_ADMIN = "Usystemadmin";
const TENANT = "tenant_demo_001";

function listJs(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listJs(full);
    return entry.name.endsWith(".js") ? [full] : [];
  }).sort();
}

// シートの中身。教室の先生（ADMIN）と、ふつうの学習者が1人ずつ
function sampleSheets() {
  return {
    tenants: [{ tenant_id: TENANT, tenant_name: "デモ" }],
    users: [
      { user_id: "user_teacher", line_user_id: "Uteacher", display_name: "先生" },
      { user_id: "user_learner", line_user_id: "Ulearner", display_name: "学習者A" }
    ],
    memberships: [
      { membership_id: "m_teacher", tenant_id: TENANT, user_id: "user_teacher", role: "ADMIN", status: "ACTIVE" },
      { membership_id: "m_learner", tenant_id: TENANT, user_id: "user_learner", role: "LEARNER", status: "ACTIVE" }
    ],
    answer_events: [
      { membership_id: "m_learner", is_correct: true, answered_at: "2026-10-23T01:00:00Z" }
    ],
    learning_sessions: []
  };
}

// ID トークンは「token:<LINE のユーザー ID>」とし、偽物の LINE がその人だと答える
function loadGas() {
  const store = {
    LIFF_ID: "2011071914-4lKlbUGo",
    DEFAULT_TENANT_ID: TENANT,
    SYSTEM_ADMIN_LINE_USER_ID: SYSTEM_ADMIN
  };
  const sheets = sampleSheets();
  const verifyCalls = [];
  const context = {
    console,
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key) => (store[key] === undefined ? null : store[key]),
        getProperties: () => Object.assign({}, store)
      })
    },
    UrlFetchApp: {
      fetch: (url, options) => {
        verifyCalls.push({ url, payload: options.payload });
        const token = String(options.payload.id_token || "");
        if (!token.startsWith("token:")) {
          return { getResponseCode: () => 400, getContentText: () => '{"error":"invalid_request","error_description":"IdToken expired."}' };
        }
        return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ sub: token.slice("token:".length) }) };
      }
    },
    ContentService: {
      MimeType: { JSON: "json" },
      createTextOutput: (text) => ({ text, setMimeType() { return this; } })
    },
    Utilities: { getUuid: () => "uuid", formatDate: () => "2026-10-23" }
  };
  vm.createContext(context);
  const code = listJs(SRC).map((file) => fs.readFileSync(file, "utf8")).join("\n;\n");
  vm.runInContext(code, context);
  // シートは偽物に差しかえる
  context.SpreadsheetGateway = { readObjects: (name) => sheets[name] || [] };

  function call(action, body = {}) {
    return dispatch({ method: "POST", action, params: {}, body: Object.assign({ action, tenantId: TENANT }, body) });
  }

  function dispatch(request) {
    try {
      return { ok: true, data: context.RequestRouter.dispatch(request) };
    } catch (error) {
      return { ok: false, error, response: JSON.parse(context.JsonPresenter.error(error).text) };
    }
  }

  return { call, dispatch, sheets, verifyCalls };
}

for (const action of ["listAdminLearners", "getAdminLearnerDetail"]) {
  test(`${action}：ログインしていなければ断る（403）`, () => {
    const gas = loadGas();
    const result = gas.call(action, { membershipId: "m_learner" });
    assert.equal(result.ok, false);
    assert.equal(result.error.status, 403);
    assert.equal(result.response.error.code, "admin_login_required");
    assert.equal(result.response.error.status, 403, "画面が見分けられるよう、本文にも 403 を入れる");
    assert.ok(!JSON.stringify(result.response).includes("学習者A"), "名前を返さない");
  });

  test(`${action}：ふつうの学習者は断る（403）`, () => {
    const gas = loadGas();
    const result = gas.call(action, { membershipId: "m_learner", lineIdToken: "token:Ulearner" });
    assert.equal(result.ok, false);
    assert.equal(result.error.status, 403);
    assert.equal(result.response.error.code, "admin_only");
  });

  test(`${action}：シートにいない LINE の人は断り、学習者として登録もしない`, () => {
    const gas = loadGas();
    const result = gas.call(action, { membershipId: "m_learner", lineIdToken: "token:Ustranger" });
    assert.equal(result.response.error.code, "admin_only");
    assert.equal(gas.sheets.users.length, 2);
    assert.equal(gas.sheets.memberships.length, 2);
  });

  test(`${action}：確かめられない ID トークン（期限切れなど）は、ログインし直してもらう`, () => {
    const gas = loadGas();
    const result = gas.call(action, { membershipId: "m_learner", lineIdToken: "expired" });
    assert.equal(result.error.status, 403);
    assert.equal(result.response.error.code, "admin_login_required");
  });

  test(`${action}：URL に入れた ID トークンは使わない（記録に残りやすいので）`, () => {
    const gas = loadGas();
    const result = gas.dispatch({
      method: "GET",
      action,
      params: { action, tenantId: TENANT, membershipId: "m_learner", lineIdToken: "token:" + SYSTEM_ADMIN },
      body: {}
    });
    assert.equal(result.response.error.code, "admin_login_required");
  });
}

test("SYSTEM_ADMIN_LINE_USER_ID の人は、一覧とくわしい記録を見られる", () => {
  const gas = loadGas();
  const list = gas.call("listAdminLearners", { lineIdToken: "token:" + SYSTEM_ADMIN });
  assert.equal(list.ok, true);
  assert.deepEqual(list.data.learners.map((learner) => learner.displayName), ["先生", "学習者A"]);

  const detail = gas.call("getAdminLearnerDetail", { membershipId: "m_learner", lineIdToken: "token:" + SYSTEM_ADMIN });
  assert.equal(detail.ok, true);
  assert.equal(detail.data.learner.summary.totalAnsweredCount, 1);
});

test("memberships の role が ADMIN / OWNER の人は見られる", () => {
  const gas = loadGas();
  assert.equal(gas.call("listAdminLearners", { lineIdToken: "token:Uteacher" }).ok, true);

  gas.sheets.memberships[0].role = "owner";
  assert.equal(gas.call("listAdminLearners", { lineIdToken: "token:Uteacher" }).ok, true, "小文字でも通す");
});

test("ADMIN でも、やめた（ACTIVE でない）membership なら断る", () => {
  const gas = loadGas();
  gas.sheets.memberships[0].status = "INACTIVE";
  const result = gas.call("listAdminLearners", { lineIdToken: "token:Uteacher" });
  assert.equal(result.response.error.code, "admin_only");
});

test("ほかの教室の ADMIN は、この教室を見られない", () => {
  const gas = loadGas();
  gas.sheets.memberships[0].tenant_id = "tenant_other";
  const result = gas.call("listAdminLearners", { lineIdToken: "token:Uteacher" });
  assert.equal(result.response.error.code, "admin_only");
});
