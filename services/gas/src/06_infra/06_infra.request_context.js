// 1回の呼び出しのあいだだけ覚えておくもの（ID・始めた時刻・シートの読みこみ）。
// 中身：RequestContext。
// 呼ぶところ：01_entry.web.js（始める・終える）・06_infra.spreadsheet_gateway.js・06_infra.script_lock.js。
var RequestContext = (function () {
  var current_ = null;

  // 呼び出しを始める（ID と時刻を決める）
  function start(meta) {
    current_ = {
      requestId: Utilities.getUuid(),
      startedAtMillis: new Date().getTime(),
      startedAtIso: new Date().toISOString(),
      meta: meta || {},
      cache: {}
    };
    return current_;
  }

  // いまの呼び出しのようす
  function get() {
    return current_;
  }

  // 覚えておく（呼び出しの外なら覚えない）。値をそのまま返す
  function putCache(namespace, key, value) {
    if (!current_) {
      return value;
    }

    if (!current_.cache[namespace]) {
      current_.cache[namespace] = {};
    }

    current_.cache[namespace][key] = value;
    return value;
  }

  // 覚えたものを読む（なければ null）
  function getCache(namespace, key) {
    if (!current_ || !current_.cache[namespace]) {
      return null;
    }

    return current_.cache[namespace][key];
  }

  // 覚えたものを消す（key がなければ、その種類を全部）
  function clearCache(namespace, key) {
    if (!current_ || !current_.cache[namespace]) {
      return;
    }

    if (key === undefined) {
      delete current_.cache[namespace];
      return;
    }

    delete current_.cache[namespace][key];
  }

  // 呼び出しを終え、覚えたものを捨てる
  function finish() {
    var snapshot = current_;
    current_ = null;
    return snapshot;
  }

  return {
    start: start,
    get: get,
    putCache: putCache,
    getCache: getCache,
    clearCache: clearCache,
    finish: finish
  };
})();
