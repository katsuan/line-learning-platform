// 日付の決まり。「今日」は日本の日付（yyyy-MM-dd）で数える。
var DatePolicy = (function () {
  var TIME_ZONE = "Asia/Tokyo";

  function todayBusinessDate() {
    return Utilities.formatDate(new Date(), TIME_ZONE, "yyyy-MM-dd");
  }

  // シートは "2026-10-23" を書くと日付に変えるので、読んだ値（Date や ISO の文字）を yyyy-MM-dd にそろえる
  function toBusinessDate(value) {
    if (value === undefined || value === null || value === "") {
      return "";
    }
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value;
    }
    var date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) {
      return String(value);
    }
    return Utilities.formatDate(date, TIME_ZONE, "yyyy-MM-dd");
  }

  return {
    todayBusinessDate: todayBusinessDate,
    toBusinessDate: toBusinessDate
  };
})();
