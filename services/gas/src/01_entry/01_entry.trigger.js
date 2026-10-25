// 時間のトリガーから呼ばれる入口。
// 中身：cleanupOldDebugLogs（毎日 4 時ごろ。debug_logs の古い行を消す）。
// 呼ぶところ：installDebugLogCleanupTrigger（00_run.js）で作ったトリガー。名前を変えるとトリガーが動かなくなるので、変えない。

// debug_logs の古い行を消す（毎日のトリガー）。動いた時刻を残し（自己点検で見る）、消した行の数を返す
function cleanupOldDebugLogs() {
  qHeartbeat(DEBUG_LOG_CLEANUP_FUNCTION);
  return DebugLogCleanup.deleteOld();
}
