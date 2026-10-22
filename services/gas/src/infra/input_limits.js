// 外から来る値の形と長さをそろえる。長すぎる文字は切り、数は範囲に入れる。
var InputLimits = (function () {
  var MAX = {
    displayName: 60,
    id: 100,
    shareChannel: 30,
    answerPayload: 2000,
    photoUrl: 500
  };

  function text(value, maxLength) {
    if (value === undefined || value === null) {
      return "";
    }
    return String(value).trim().slice(0, maxLength);
  }

  function id(value) {
    var result = text(value, MAX.id);
    return /^[A-Za-z0-9_.:\-]+$/.test(result) ? result : "";
  }

  function number(value, min, max, fallback) {
    var n = Number(value);
    if (!isFinite(n)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, n));
  }

  function httpsUrl(value) {
    var result = text(value, MAX.photoUrl);
    return /^https:\/\/[^\s"'<>]+$/.test(result) ? result : "";
  }

  return {
    MAX: MAX,
    text: text,
    id: id,
    number: number,
    httpsUrl: httpsUrl
  };
})();
