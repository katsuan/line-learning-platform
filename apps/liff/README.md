# apps/liff

学習者向けLIFFフロントエンドの配置先です。

GitHub Pages で配信する前提の公開フロントです。
初期段階の公開先は、まずリポジトリ直下の `docs/` を使う。

## 責務

- LINEから開かれる学習UI
- Home、今日の5問、学習履歴、設定
- ローカル状態保持
- 未同期AnswerEventの再送制御
- GitHub Pages 配信用の静的成果物生成

## この配下に置くもの

- 画面エントリ
- 画面別コンポーネント
- APIクライアント
- ローカル保存アダプタ
- Pages配信用設定ファイル

## 置かないもの

- 採点ロジック本体
- Tenant越境を伴う認可判断
- 永続化ロジック
- Secret や内部接続情報

## 配信前提

- 公開URLは GitHub Pages を使う
- GitHub Pages の公開フォルダは `main` の `/docs` を使う
- LIFF URL には GitHub Pages のURLを設定する
- ブラウザから呼ぶ先は GAS Web App を想定する
- 接続確認用に、最初は `health` 相当の軽い疎通導線を持つ
