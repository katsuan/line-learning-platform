# LearningPlatform

LINEを入口にし、LIFF内で学習体験を完結させるマルチテナント型学習プラットフォームの実装リポジトリです。

現時点では、要件定義、MVP情報設計、データモデル、API契約、実装雛形を先に整えています。

## 参照順

1. [要件定義](/Users/katsu/GitHub/LearningPlatform/RULES/01_requirement_definition.md)
2. [MVP情報設計](/Users/katsu/GitHub/LearningPlatform/RULES/02_mvp_information_architecture.md)
3. [データモデルと認可](/Users/katsu/GitHub/LearningPlatform/RULES/03_data_model_and_authorization.md)
4. [画面遷移とAPIカタログ](/Users/katsu/GitHub/LearningPlatform/RULES/04_screen_flow_and_api_catalog.md)
5. [ER図とテーブル定義たたき台](/Users/katsu/GitHub/LearningPlatform/RULES/05_er_and_table_draft.md)
6. [OpenAPI 初版](/Users/katsu/GitHub/LearningPlatform/packages/openapi/openapi.yaml)

## ディレクトリ構成

- `apps/liff`
  学習者向けLIFFフロントエンド
- `apps/admin`
  Tenant管理者向けフロントエンド
- `services/api`
  認証、権限、学習ロジック、永続化を扱うBackend API
- `packages/domain`
  ドメインモデル、enum、ポリシー、ユースケース前提
- `packages/openapi`
  API契約の正本
- `packages/shared`
  フロントとAPIで共有する型や補助定義

## 今の前提

- 実装前の雛形段階のため、ビルド設定や依存関係はまだ固定していません
- 技術選定は、要件とAPI契約が固まった後に決める前提です
- ディレクトリ責務を先に固定し、後から全面書き換えになりにくい形を優先しています
