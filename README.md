# LearningPlatform

LINEを入口にし、LIFF内で学習体験を完結させるマルチテナント型学習プラットフォームの実装リポジトリです。

現時点では、要件定義、MVP情報設計、データモデル、API契約、そして MVP を早く立ち上げるための `GitHub Pages + GAS Web App + Spreadsheet` 実装雛形を整えています。

## 参照順

1. [要件定義](/Users/katsu/GitHub/LearningPlatform/RULES/01_requirement_definition.md)
2. [MVP情報設計](/Users/katsu/GitHub/LearningPlatform/RULES/02_mvp_information_architecture.md)
3. [データモデルと認可](/Users/katsu/GitHub/LearningPlatform/RULES/03_data_model_and_authorization.md)
4. [画面遷移とAPIカタログ](/Users/katsu/GitHub/LearningPlatform/RULES/04_screen_flow_and_api_catalog.md)
5. [ER図とテーブル定義たたき台](/Users/katsu/GitHub/LearningPlatform/RULES/05_er_and_table_draft.md)
6. [GAS / Spreadsheet 実装方針](/Users/katsu/GitHub/LearningPlatform/RULES/06_gas_spreadsheet_mvp.md)
7. [OpenAPI 初版](/Users/katsu/GitHub/LearningPlatform/packages/openapi/openapi.yaml)

## ディレクトリ構成

- `docs`
  GitHub Pages の公開先。最小の疎通確認ページを配置
- `apps/liff`
  学習者向けLIFFフロントエンド
- `apps/admin`
  Tenant管理者向けフロントエンド
- `services/api`
  認証、権限、学習ロジック、永続化を扱うBackend API
- `services/gas`
  現在のMVP実装本体。GAS Web App、Spreadsheet Gateway、Script Properties管理
- `packages/domain`
  ドメインモデル、enum、ポリシー、ユースケース前提
- `packages/openapi`
  API契約の正本
- `packages/shared`
  フロントとAPIで共有する型や補助定義

## 今の前提

- フロント公開面は `GitHub Pages` を使う
- GitHub Pages の公開フォルダは `main` ブランチの `/docs` を使う
- MVPの簡易実装は `GAS Web App + Spreadsheet` を第一候補にする
- 構成は `GitHub Pages -> LIFF フロント -> GAS Web App -> Spreadsheet` を基本にする
- LIFFフロントは公開面、GASは秘密情報と学習ロジックを持つ private 面として分離する
- Spreadsheet はDB代替として使うが、責務分離は維持し、`doGet` `doPost` にロジックを集中させない
- 将来的に RDB へ移行しやすいよう、GAS でも repository / gateway 境界を先に置く

## GitHub Pages 設定

- `Source`: `Deploy from a branch`
- `Branch`: `main`
- `Folder`: `/docs`

最初の公開確認は [docs/index.html](/Users/katsu/GitHub/LearningPlatform/docs/index.html) を使う。
