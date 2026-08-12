var RequestContext = (function () {
  var current_ = null;

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

  function get() {
    return current_;
  }

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

  function getCache(namespace, key) {
    if (!current_ || !current_.cache[namespace]) {
      return null;
    }

    return current_.cache[namespace][key];
  }

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
