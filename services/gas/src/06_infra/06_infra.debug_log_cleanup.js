// debug_logs（呼び出しのログのシート）の古い行を消す部品。
// 中身：DebugLogCleanup（古い行・前の形の行を見分けて、まとめて消す・毎日のトリガーを作る）。
// 呼ぶところ：01_entry.trigger.js の cleanupOldDebugLogs（毎日のトリガー）と、00_run.js の installDebugLogCleanupTrigger・purgeLegacyDebugLogs。
// トリガーが呼ぶ関数の名前（変えるとトリガーが動かなくなる）
var DEBUG_LOG_CLEANUP_FUNCTION = "cleanupOldDebugLogs";

var DebugLogCleanup = (function () {
  // 毎日 4 時ごろに cleanupOldDebugLogs を動かすトリガーを作る（前のものは消して、いつも1つだけ）。次にすることの文を返す
  function installTrigger() {
    ScriptApp.getProjectTriggers().forEach(function (trigger) {
      if (trigger.getHandlerFunction() === DEBUG_LOG_CLEANUP_FUNCTION) {
        ScriptApp.deleteTrigger(trigger);
      }
    });
    ScriptApp.newTrigger(DEBUG_LOG_CLEANUP_FUNCTION).timeBased().everyDays(1).atHour(4).create();
    return "毎日 4 時ごろに " + DEBUG_LOG_CLEANUP_FUNCTION + " が動きます";
  }

  // DEBUG_LOG_KEEP_DAYS（なければ 30）日より古い行を消し、消した行の数を返す
  function deleteOld() {
    var keepDays = Number(PropertiesService.getScriptProperties().getProperty("DEBUG_LOG_KEEP_DAYS")) || 30;
    var limit = Date.now() - keepDays * 24 * 60 * 60 * 1000;
    var deleted = deleteWhere(function (row) {
      var at = toTime(row.created_at);
      return at !== null && at < limit;
    });
    console.log(JSON.stringify({ message: "debug_logs_cleanup", keepDays: keepDays, deleted: deleted }));
    return deleted;
  }

  // 前の形の行（LINE のユーザー ID・送られた文がそのまま）を消し、消した行の数を返す
  function deleteLegacy() {
    var deleted = deleteWhere(isLegacyRow);
    console.log(JSON.stringify({ message: "debug_logs_purge_legacy", deleted: deleted }));
    return deleted;
  }

  // 前の形の行：LINE のユーザー ID がそのまま（U＋16進数32字）か、送られた文（messageTexts）が残っている
  function isLegacyRow(row) {
    var lineUserId = String(row.line_user_id || "");
    var summary = String(row.request_summary || "");
    return /^U[0-9a-f]{32}$/i.test(lineUserId) || summary.indexOf('"messageTexts"') !== -1;
  }

  // シートの時刻（Date か文字）を、ミリ秒にする。読めなければ null
  function toTime(value) {
    if (value === "" || value === null || value === undefined) {
      return null;
    }
    var time = value instanceof Date ? value.getTime() : new Date(value).getTime();
    return isFinite(time) ? time : null;
  }

  // 消す行を、続いているまとまりごとに、下から deleteRows で消す（行が多くても1回で終わる）
  function deleteWhere(shouldDelete) {
    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      var sheet = SpreadsheetApp.openById(ScriptConfig.getSpreadsheetId()).getSheetByName(DomainConstants.SHEETS.DEBUG_LOGS);
      if (!sheet || sheet.getLastRow() < 2) {
        return 0;
      }
      var values = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
      var headers = values[0];
      var runs = [];
      var deleted = 0;
      for (var i = 1; i < values.length; i++) {
        var row = {};
        for (var c = 0; c < headers.length; c++) {
          row[headers[c]] = values[i][c];
        }
        if (!shouldDelete(row)) {
          continue;
        }
        var sheetRow = i + 1;
        var last = runs[runs.length - 1];
        if (last && last.start + last.count === sheetRow) {
          last.count += 1;
        } else {
          runs.push({ start: sheetRow, count: 1 });
        }
        deleted += 1;
      }
      for (var r = runs.length - 1; r >= 0; r--) {
        deleteRuns_(sheet, runs[r]);
      }
      return deleted;
    } finally {
      lock.releaseLock();
    }
  }

  // 続いている行のまとまりを消す（データの行が全部なら、中身だけ消す）
  function deleteRuns_(sheet, run) {
    // シートの行をすべて消すことはできないので、データの行が全部消えるときは中身だけ消す
    if (run.start === 2 && run.start + run.count - 1 >= sheet.getMaxRows()) {
      sheet.getRange(2, 1, run.count, sheet.getLastColumn()).clearContent();
      return;
    }
    sheet.deleteRows(run.start, run.count);
  }

  return {
    installTrigger: installTrigger,
    deleteOld: deleteOld,
    deleteLegacy: deleteLegacy,
    isLegacyRow: isLegacyRow,
    toTime: toTime,
    deleteWhere: deleteWhere
  };
})();
