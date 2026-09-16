# GitHubプロフィールカード忠実再現 設計書

**日付:** 2026-09-15  
**ステータス:** ユーザー承認済み（方式1）

## 目的

READMEのStatsセクションが依存している`github-profile-summary-cards.vercel.app`の障害影響をなくす。現在の外部カード5枚に限りなく近い静的SVGを、このリポジトリ内のTypeScriptコードで日次生成し、生成物もリポジトリへ保存する。

## スコープ

- `profile-details.svg`
- `most-commit-language.svg`
- `repos-per-language.svg`
- `profile-stats.svg`
- `productive-time.svg`（UTC+9）
- 上記5枚の生成コード、fixture、テスト、GitHub Actions
- 現在失敗しているGitHub Actionsの原因修正と手動実行による確認

README.mdはこの段階では変更しない。Privateリポジトリ由来の情報および集計値も扱わない。ヘッダーとフッターの`capsule-render.vercel.app`は対象外とする。

## 採用方式

既存のTypeScriptジェネレーターを維持し、MITライセンスの上流プロジェクトを表示仕様の参照実装として使う。`blueberry`テーマの寸法、配色、タイポグラフィ、余白、アイコン、グラフ形状、ラベル、数値表記をカードごとに再現する。

上流サービスや画像URLを実行時に参照しない。SVGは外部CSS、画像、フォント、JavaScriptを含まない自己完結形式とする。

## データ取得

GitHub GraphQL APIから`renkonmaster`の公開情報だけを取得する。認証にはRepository Secret `PROFILE_GITHUB_TOKEN`に保存した、公開情報専用のPersonal Access Tokenを使用する。

クエリは公開リポジトリに限定し、Privateリポジトリの名前、活動、集計値をレスポンスモデルへ取り込まない。ログにはトークンやGraphQLレスポンス本文を出さない。一方、障害調査に必要な範囲で、安全なエラー分類（HTTPステータス、GraphQLエラー種別、失敗した操作名）は残す。

カードごとの意味は上流実装に合わせる。

- Profile Details: 公開Contributionカレンダーとアカウント情報
- Most Commit Language: 公開Contributionに含まれるリポジトリの言語別commit数
- Repos per Language: 所有する公開・非forkリポジトリの主要言語別件数
- Stats: stars、commits、PRs、issues、contributed repositories
- Productive Time: 公開リポジトリのcommit時刻をUTC+9で時間帯別に集計

## 描画構成

共通テーマとSVGプリミティブを描画層へ集約し、カード固有のレイアウトを個別rendererに分ける。既存の`profile-stats.svg`を基準カードとして維持し、残り4枚を上流の出力寸法と構造へ合わせる。

数値やユーザー由来文字列はXMLエスケープする。円グラフなどの座標は決定的に計算し、同じ入力から同じSVGを生成する。GitHub上で表示できないCSS機能や外部リソースには依存しない。

## GitHub Actions

Workflowは毎日1回の`schedule`と`workflow_dispatch`で動作する。

1. checkout
2. Node.jsセットアップと`npm ci`
3. テストと型チェック
4. `PROFILE_GITHUB_TOKEN`を使った公開データ取得
5. 5枚のSVG生成
6. 差分がある生成物だけcommit・push

現在の失敗は最初のGraphQL呼び出しで発生し、同一クエリは有効なユーザートークンでは成功するため、Secretのトークン状態・権限差が根本原因候補である。新しく登録された公開情報専用PATで再実行し、なお失敗する場合は安全な診断情報によって操作単位まで特定して修正する。

## テストと検証

- 上流レイアウトに対応する寸法、主要座標、色、タイトル、ラベルのスナップショットまたは構造テスト
- fixtureによる5枚の決定的生成
- 公開リポジトリだけが集計されることのAPIモックテスト
- トークンやGraphQL本文がエラーへ漏れないことのテスト
- `npm test`と`npm run typecheck`
- fixture生成後のSVG妥当性検査
- README.mdに差分がないことの確認
- `workflow_dispatch`の成功と生成物commitの確認

## 完了条件

1. 5枚が外部カードの`blueberry`テーマに限りなく近い見た目で生成される。
2. 生成SVGが自己完結し、リポジトリへ保存される。
3. 使用する統計値が公開情報だけに限定される。
4. 日次Workflowと手動Workflowが成功する。
5. テストと型チェックが成功する。
6. README.mdが変更されていない。
7. トークンや機密情報がコード、生成物、ログへ含まれない。
