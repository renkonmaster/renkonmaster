# Profile README 自作SVGカード生成基盤 設計書

**日付:** 2026-08-19  
**ステータス:** ユーザー承認済み（方式A）

## 目的

プロフィールREADMEに表示している外部のGitHub Profile Summary Cardsへの依存を減らし、同じ公開プロフィールリポジトリ内で自分のカード生成コードと生成済みSVGを管理する。

初期段階では、Private Repoを含む集計値を使った自作カードを1枚生成する。生成プログラムはローカル開発環境でも実行でき、GitHub Actionsから定期的に実行して生成物を更新できるようにする。

## 現状とスコープ

現在のリポジトリにはREADME.mdのみがあり、Statsセクションの5枚の画像が`github-profile-summary-cards.vercel.app`を参照している。ヘッダーとフッターの`capsule-render.vercel.app`参照は今回の初期スコープには含めず、Statsカードの移行に集中する。

### 初期スコープ

- TypeScript/Node.js製の自作SVGジェネレーターを同じ公開リポジトリに追加する
- GitHub GraphQL APIから直近12か月の集計値を取得する
- Private Repo由来の活動を、リポジトリ名などを公開せずに集計する
- `Commits`、`Pull Requests`、`Issues`、`Repositories contributed to`を表示するカードを1枚作る
- GitHubトークンなしのfixtureモードでローカル生成できるようにする
- GitHub Actionsの定期実行・手動実行で実データのSVGを生成し、リポジトリへ保存する
- READMEのStatsセクションを生成済みSVGの相対パス参照へ変更する

### 初期スコープ外

- リアルタイムでSVGを返すHTTP API
- 他ユーザー向けのカードサービス
- 既存の5種類のカードの完全な再現
- ヘッダー・フッター画像のセルフホスト化
- Private Repoの名前、Issueタイトル、コミットメッセージ、コード内容の公開

## 採用方式

### 自作TypeScriptジェネレーターを同居させる

生成コードをプロフィール用公開リポジトリに置き、Actionsはそのコードを実行するオーケストレーターに限定する。API取得、集計、描画をActionsのYAMLに埋め込まないため、将来VPSのcronや別のCIへ移行しても同じCLIを再利用できる。

Node.jsの標準`fetch`でGitHub GraphQL APIを呼び出し、SVGはXML文字列として直接描画する。初期カードに複雑な画像処理ライブラリを導入せず、SVGの構造とデザインをコードで明示する。環境変数のローカル読み込みには`dotenv`を使う。

### 代替案を採用しない理由

- Python方式は実現可能だが、現状リポジトリにPython基盤がなく、Actionsとローカルの初期セットアップを増やす。
- 既存プロジェクトのfork方式は短期的には速いが、既存のデータモデルとカード設計に依存し、自作カードの拡張境界が不明確になる。

## コンポーネントと責務

```text
src/
  types.ts                 # API結果から描画までの型
  config.ts                # 環境変数と実行モードの解決
  data/github.ts           # GitHub GraphQL APIからの取得
  data/fixture.ts          # トークンなしの開発用データ
  cards/profile-stats.ts   # 指標をカード用モデルへ変換
  render/svg.ts            # SVG共通部品・エスケープ・描画
  generate.ts              # 全カード生成とファイル出力
```

生成物は`generated/profile-stats.svg`に置く。READMEはこのファイルを相対パスで参照する。

### データ契約

取得層と描画層の間では、リポジトリ固有の情報を持たない次のような集計モデルだけを渡す。

```ts
type ProfileStats = {
  username: string;
  periodLabel: string;
  commits: number;
  pullRequests: number;
  issues: number;
  repositoriesContributed: number;
};
```

GitHub APIのレスポンス形式をカード描画コードへ漏らさないことで、将来別APIやfixtureへ差し替えられるようにする。

## データ取得とPrivate Repoの扱い

実データモードでは`GITHUB_TOKEN`を使ってGitHub GraphQL APIの`contributionsCollection`を取得する。期間は直近12か月とし、カード上にも期間を明示する。Private Repoの活動が集計されるかどうかは、PATのリポジトリ読み取り権限とGitHubプロフィールの「Private contributionsをプロフィールに含める」設定に依存する。

公開SVGには集計値だけを出し、リポジトリ識別子や個別活動のテキストは出力しない。Actions Secretの値、GraphQLレスポンス、認証ヘッダーはログへ出力しない。

ローカルでは、`GITHUB_TOKEN`がない場合はfixtureモードを使う。実データを明示的に要求した場合にトークンがないときは、認証設定が不足していることを示して終了する。

## SVG設計

初期カードは固定サイズ・固定viewBoxの静的SVGとする。濃色背景、青系アクセント、4つのメトリクス行を持つ簡潔なデザインにし、あとからカードを追加できるよう描画関数をカード単位で分離する。

SVGには外部CSS、外部画像、JavaScriptを参照させない。テキストはXMLエスケープし、数値は描画前に安全な文字列へ変換する。README上では画像として表示されるため、インタラクティブUIは初期スコープに含めない。

## 実行モード

- `DATA_SOURCE=fixture`: ローカル確認用。トークン不要。
- `DATA_SOURCE=github`: GitHub APIを使用。`GITHUB_TOKEN`と`GITHUB_USERNAME`が必要。
- `OUTPUT_DIR`: 生成先。既定値は`generated`。

ローカルの基本操作は次のとおりとする。

```bash
npm install
npm run generate
GITHUB_TOKEN=... DATA_SOURCE=github npm run generate
npm test
npm run typecheck
```

## GitHub Actions

Workflowは日次の`schedule`と`workflow_dispatch`で起動する。`push`を起動条件にしないことで、生成物のcommitによる無限実行を防ぐ。

- `actions/checkout`でプロフィールリポジトリを取得
- Node.jsをセットアップし、`npm ci`を実行
- `DATA_SOURCE=github`でジェネレーターを実行
- `generated/`に差分がある場合のみcommit・push
- リポジトリ内への書き戻しにはActions標準の`GITHUB_TOKEN`と`contents: write`を使う
- GitHub API読み取り用PATは`PROFILE_GITHUB_TOKEN` Secretとして注入する

第三者Actionは可能な限り完全なコミットSHAへ固定する。API用PATの権限は対象Private Repoへのreadに限定する。

## テストと検証

ネットワークに依存しないテストを中心にする。

- fixtureから期待した`ProfileStats`が生成される
- rendererが有効な`<svg>`、`viewBox`、主要テキストを出力する
- XML特殊文字を含むユーザー名などがエスケープされる
- 各メトリクスの値がSVGに反映される
- トークンなしのローカル生成が成功する
- APIモードでトークン不足・GraphQLエラーを安全に扱う
- Actionsと同じ`npm run generate`をローカルで実行し、生成物の差分を確認する

## 完了条件

1. トークンなしでローカルからfixture SVGを生成できる。
2. トークンを設定すれば、Private Repoを含む集計値で同じカードを生成できる。
3. Actionsの手動実行で`generated/profile-stats.svg`を更新できる。
4. READMEのStatsセクションが外部Summary Cards APIではなく、生成済みSVGを参照する。
5. テスト、型チェック、fixture生成が成功する。
6. ソース、生成物、Workflowのいずれにもトークン値が含まれない。
