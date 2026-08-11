# services/api

Backend API の配置先です。

## 責務

- LIFF / 管理画面からのリクエスト受付
- 認証文脈解決
- Tenant文脈解決
- 権限判定入口
- 学習セッション生成、取得、再開
- 回答採点とAnswerEvent保存
- 学習履歴サマリ返却

## 推奨レイヤー

- `src/entry`
- `src/router`
- `src/usecase`
- `src/domain`
- `src/infra`
- `src/presenter`

ControllerやRouterに問題選定や採点の本体ロジックを長く置かない前提です。
