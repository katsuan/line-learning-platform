# LearningPlatform

LINEを入口にし、LIFF内で学習体験を完結させるマルチテナント型学習プラットフォームの実装リポジトリです。

現時点では、要件定義、MVP情報設計、データモデル、API契約、そして MVP を早く立ち上げるための `GitHub Pages + GAS Web App + Spreadsheet` 実装雛形を整えています。

## 参照順

要件定義・設計のメモは、開発者の手元で管理しています（非公開）。

1. [OpenAPI 初版](packages/openapi/openapi.yaml)

## ディレクトリ構成

- `docs`
  GitHub Pages の公開先（下の「画面のファイル」）
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

## 画面のファイル（`docs`）

| ファイル | 役わり |
|---|---|
| `learn.html`・`learn.js`・`learn.css` | 今日の5問の画面（LIFF の入口。答える・結果を LINE に送る） |
| `admin.html`・`admin.js`・`admin.css` | 管理の画面（学習者の一覧とくわしい記録。管理者だけ） |
| `index.html`・`app.js`・`style.css` | トップ（`?debug=1` のときだけ GAS との接続の確かめ） |
| `config.js` | 画面の設定（GAS の URL・action の名前・LIFF ID・教室） |
| `sw.js` | 電波がなくても開けるようにする（中身は line-share の共通の `sw-core.js`） |
| `version.json` | 版（GitHub Actions が push のたびに書きかえる） |

公開している URL（`learn.html`・`admin.html`・`index.html`）の名前は変えない。`js`・`css` を変えたら、HTML の `?v=` をそろえて上げる。

## 画面の決まり

- 画面の部品と色は、共通の部品集（`https://katsuan.github.io/line-share/shared/ui.css`・`ui.js`）を使い、色は今の緑（`--ls-accent`）にしている
- 名前・アイコン・ロゴ・OGP・紹介のボタン・カードの末尾の「Created by」は、名前が決まるまで付けない。検索には出さない（`noindex`）
- `?debug=1` を付けたときだけ、開発用の接続確認とログを出す（ふつうの人には出さない）

## GitHub Pages 設定

- `Source`: `Deploy from a branch`
- `Branch`: `main`
- `Folder`: `/docs`

最初の公開確認は [docs/index.html](docs/index.html) を使う。
