var DatePolicy = (function () {
  function todayBusinessDate() {
    return Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd");
  }

  return {
    todayBusinessDate: todayBusinessDate
  };
})();
