// 今日の5問の画面（learn.js）と管理の画面（admin.js）の両方で使う小さな道具（window.LearningCommon）。
// 中身：HTML に入れる文字の直し・日本の日付の形・GAS の返事の読み方。
// 読むところ：learn.html・admin.html（それぞれの画面の JS の前）。
(function (root) {
  // HTML に入れる文字の < > & " ' をそのまま出す形にする
  function escapeHtml(value) {
    return String(value === undefined || value === null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // シートの日付は "2026-10-23" か ISO の日時で来る。日本の時刻の Date（UTC の欄で読む）にする。読めなければ null
  function toJstDate(value) {
    var text = String(value || "");
    var date = /^\d{4}-\d{2}-\d{2}$/.test(text) ? new Date(text + "T00:00:00+09:00") : new Date(text);
    return isNaN(date.getTime()) ? null : new Date(date.getTime() + 9 * 60 * 60 * 1000);
  }

  // 日付を「M月d日」にする（読めなければ空）
  function formatDate(value) {
    var jst = toJstDate(value);
    return jst ? (jst.getUTCMonth() + 1) + "月" + jst.getUTCDate() + "日" : "";
  }

  // 日時を「M月d日 H:mm」にする（読めなければ空）
  function formatDateTime(value) {
    var jst = toJstDate(value);
    if (!jst) {
      return "";
    }
    var minutes = String(jst.getUTCMinutes()).padStart(2, "0");
    return (jst.getUTCMonth() + 1) + "月" + jst.getUTCDate() + "日 " + jst.getUTCHours() + ":" + minutes;
  }

  // GAS の返事を JSON で読む。うまくいかなかった返事（error が入っている）は、その中身で失敗にする
  function readJsonResponse(response) {
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
  }

  var api = {
    escapeHtml: escapeHtml,
    toJstDate: toJstDate,
    formatDate: formatDate,
    formatDateTime: formatDateTime,
    readJsonResponse: readJsonResponse
  };
  root.LearningCommon = api;
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
})(typeof window !== "undefined" ? window : this);
