// 外から来る値をそろえるところ。中身：InputLimits（文字・ID・数・https の URL）。
// 外から来る値の形と長さをそろえる。長すぎる文字は切り、数は範囲に入れる。
// 呼ぶところ：03_usecase の各ファイル・06_infra.repositories.js。
var InputLimits = (function () {
  var MAX = {
    displayName: 60,
    id: 100,
    shareChannel: 30,
    answerPayload: 2000,
    photoUrl: 500
  };

  // 文字にして前後の空白を取り、長すぎれば切る
  function text(value, maxLength) {
    if (value === undefined || value === null) {
      return "";
    }
    return String(value).trim().slice(0, maxLength);
  }

  // ID の形（英数字と _ . : -）だけ通す。ちがえば空
  function id(value) {
    var result = text(value, MAX.id);
    return /^[A-Za-z0-9_.:\-]+$/.test(result) ? result : "";
  }

  // 数にして、範囲に入れる。数でなければ fallback
  function number(value, min, max, fallback) {
    var n = Number(value);
    if (!isFinite(n)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, n));
  }

  // https の URL だけ通す。ちがえば空
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
