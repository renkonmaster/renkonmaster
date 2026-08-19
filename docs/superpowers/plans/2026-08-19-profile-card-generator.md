# Profile README 自作SVGカード生成基盤 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 公開プロフィールリポジトリ内のTypeScriptジェネレーターで、Private Repoを含む集計値から自作SVGカードを生成し、ローカルとGitHub Actionsの両方で再生成できるようにする。

**Architecture:** API取得、fixture、カードモデル、SVG描画、ファイル出力を独立したモジュールに分ける。GitHub Actionsは`npm run generate`を定期・手動実行し、`generated/profile-stats.svg`に差分があるときだけ同じリポジトリへコミットする。生成ロジックはActions固有APIを使わず、将来cronや別CIからも実行できるCLIにする。

**Tech Stack:** Node.js 22、TypeScript、`tsx`、`dotenv`、Node標準`fetch`、GitHub GraphQL API、Node標準テストランナー

## Global Constraints

- 対象リポジトリは公開プロフィールリポジトリで、現在の対象ブランチは`main`。
- 生成物は`generated/profile-stats.svg`としてGit管理し、READMEから相対パスで参照する。
- Private Repoの名前、Issueタイトル、コミットメッセージ、コード内容は取得モデルにもSVGにも含めない。
- API用トークンは`.env`またはGitHub Actions Secretからのみ読み込み、ソース・テスト・生成物・ログへ出力しない。
- トークンなしのローカル実行はfixtureモードで成功する。
- `DATA_SOURCE=github`ではトークン不足、GraphQLエラー、対象ユーザー不在を明示的なエラーとして終了する。
- SVGは外部CSS、外部画像、JavaScriptを参照しない静的SVGとする。
- GitHub Actionsの起動条件は`schedule`と`workflow_dispatch`だけにし、生成物のpushによる無限実行を防ぐ。
- Actionsの書き戻しは組み込み`GITHUB_TOKEN`の`contents: write`だけを使用し、API読み取り用PATとは分離する。
- 第三者Actionは完全なコミットSHAに固定する。この作業セッションから`git push`は実行しない。将来Actionsが生成物を更新するためのpush処理はWorkflow内に含める。
- 各タスクは実装後に対象テストまたは検証コマンドを実行し、必要な変更だけをコミットする。

---

## Task 1: Node.js/TypeScript実行基盤を作る

**Files:**
- Create: `package.json`
- Create: `package-lock.json`
- Create: `tsconfig.json`
- Create: `.nvmrc`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `src/types.ts`

**Interfaces:**
- Produces `ProfileStats`、`DataSource`、`GeneratorConfig`の型を後続タスクへ提供する。

- [ ] **Step 1: `package.json`のスクリプトと依存関係を定義する**

  `package.json`にはNode.js 22以上の`engines`と次のスクリプトを定義する。

  ```json
  {
    "engines": { "node": ">=22" },
    "scripts": {
      "generate": "node --import tsx src/generate.ts",
      "test": "node --import tsx --test tests/*.test.ts",
      "typecheck": "tsc --noEmit"
    }
  }
  ```

  実行依存は`dotenv`、開発依存は`@types/node`、`tsx`、`typescript`に限定する。Node標準`fetch`を使うため、GitHub APIクライアントやSVG描画フレームワークは追加しない。

- [ ] **Step 2: Node.jsとTypeScript設定を作る**

  `.nvmrc`には`22`を記載する。`tsconfig.json`はNode.js 22向けにES Modulesを使い、`src`と`tests`を型チェック対象にする。生成物と`node_modules`は対象外にする。

- [ ] **Step 3: 秘密情報と生成物のignore設定を作る**

  `.gitignore`には`.env`、`node_modules/`、`*.log`だけを追加し、`generated/`はignoreしない。`.env.example`には値を入れず、以下のキー名だけを記載する。

  ```env
  DATA_SOURCE=fixture
  GITHUB_USERNAME=renkonmaster
  GITHUB_TOKEN=
  OUTPUT_DIR=generated
  ```

- [ ] **Step 4: ドメイン型を定義する**

  `src/types.ts`に次の型を定義する。

  ```ts
  export type DataSource = "fixture" | "github";

  export type ProfileStats = {
    username: string;
    periodLabel: string;
    commits: number;
    pullRequests: number;
    issues: number;
    repositoriesContributed: number;
  };

  export type GeneratorConfig = {
    dataSource: DataSource;
    username: string;
    token: string | undefined;
    outputDir: string;
  };
  ```

- [ ] **Step 5: 基盤の型チェックを実行する**

  Run: `npm run typecheck`

  Expected: PASS。まだ実装ファイルがないことによる入力ファイルエラーが出る場合は、空の`src/types.ts`以外を参照しない設定に修正してからPASSを確認する。

- [ ] **Step 6: コミットする**

  ```bash
  git add package.json package-lock.json tsconfig.json .nvmrc .gitignore .env.example src/types.ts
  git commit -m "build: add TypeScript SVG generator foundation"
  ```

## Task 2: 設定解決とfixtureデータを実装する

**Files:**
- Create: `src/config.ts`
- Create: `src/data/fixture.ts`
- Create: `tests/config.test.ts`
- Create: `tests/fixture.test.ts`

**Interfaces:**
- Consumes: `DataSource`, `ProfileStats`, `GeneratorConfig` from `src/types.ts`.
- Produces: `loadConfig(env?: NodeJS.ProcessEnv): GeneratorConfig` and `getFixtureStats(username: string): ProfileStats`.

- [ ] **Step 1: 設定解決の失敗テストを書く**

  `tests/config.test.ts`で、次をテストする。

  ```ts
  test("トークンなしの既定値はfixtureになる", () => {
    const config = loadConfig({ GITHUB_USERNAME: "renkonmaster" });
    assert.deepEqual(config, {
      dataSource: "fixture",
      username: "renkonmaster",
      token: undefined,
      outputDir: "generated",
    });
  });

  test("githubモードはトークンなしで失敗する", () => {
    assert.throws(
      () => loadConfig({ DATA_SOURCE: "github", GITHUB_USERNAME: "renkonmaster" }),
      /GITHUB_TOKEN/,
    );
  });
  ```

- [ ] **Step 2: fixtureの内容と設定解決を実装する**

  fixtureは固定値を返し、実データや秘密情報へアクセスしない。`DATA_SOURCE`未指定時はトークンがあれば`github`、なければ`fixture`とする。`DATA_SOURCE=fixture`ではトークンを無視し、`DATA_SOURCE=github`ではユーザー名とトークンを必須にする。

- [ ] **Step 3: fixtureの決定性をテストする**

  `getFixtureStats("renkonmaster")`が固定の`ProfileStats`を返し、ユーザー名だけが引数に応じて変わることを確認する。数値は正の整数で、Private Repoの名前などのフィールドを持たないことを検証する。

- [ ] **Step 4: 対象テストと型チェックを実行する**

  Run: `node --import tsx --test tests/config.test.ts tests/fixture.test.ts`

  Expected: PASS。

  Run: `npm run typecheck`

  Expected: PASS。

- [ ] **Step 5: コミットする**

  ```bash
  git add src/config.ts src/data/fixture.ts tests/config.test.ts tests/fixture.test.ts
  git commit -m "feat: add generator configuration and fixtures"
  ```

## Task 3: GitHub GraphQL APIアダプターを実装する

**Files:**
- Create: `src/data/github.ts`
- Create: `tests/github.test.ts`

**Interfaces:**
- Consumes: `ProfileStats` from `src/types.ts`.
- Produces: `fetchGithubStats(username: string, token: string, now?: Date, fetchImpl?: typeof fetch): Promise<ProfileStats>`.

- [ ] **Step 1: 成功レスポンスのモックテストを書く**

  `tests/github.test.ts`ではネットワークを使わず、`fetchImpl`にモック関数を渡す。モックレスポンスには次のGraphQLデータを使う。

  ```json
  {
    "data": {
      "user": {
        "contributionsCollection": {
          "totalCommitContributions": 1284,
          "totalPullRequestContributions": 76,
          "totalIssueContributions": 42,
          "totalRepositoryContributions": 18
        }
      }
    }
  }
  ```

  返却値の4つの数値と`username`、直近12か月を示す`periodLabel`を検証する。

- [ ] **Step 2: HTTPエラー、GraphQLエラー、ユーザー不在のテストを書く**

  HTTPステータスが200以外、レスポンスに`errors`が含まれる場合、`data.user`がnullの場合に、それぞれトークンやGraphQLレスポンス全体をメッセージへ含めずに例外となることをテストする。

- [ ] **Step 3: GraphQLクエリと認証付きfetchを実装する**

  `contributionsCollection(from: $from, to: $to)`へ直近12か月のISO日時を渡し、次の4フィールドだけを取得する。

  ```graphql
  totalCommitContributions
  totalPullRequestContributions
  totalIssueContributions
  totalRepositoryContributions
  ```

  `Authorization: Bearer <token>`、`Content-Type: application/json`を設定し、レスポンス本文をログ出力しない。`now`引数はテストで期間を固定するために使う。

- [ ] **Step 4: APIアダプターのテストを実行する**

  Run: `node --import tsx --test tests/github.test.ts`

  Expected: PASS。ネットワーク接続が発生しないことを確認する。

- [ ] **Step 5: コミットする**

  ```bash
  git add src/data/github.ts tests/github.test.ts
  git commit -m "feat: fetch private-aware contribution aggregates"
  ```

## Task 4: カードモデルとSVGレンダラーを実装する

**Files:**
- Create: `src/cards/profile-stats.ts`
- Create: `src/render/svg.ts`
- Create: `tests/profile-stats.test.ts`
- Create: `tests/svg.test.ts`

**Interfaces:**
- Consumes: `ProfileStats` from `src/types.ts`.
- Produces: `ProfileStatsCardModel`, `buildProfileStatsCard(stats: ProfileStats): ProfileStatsCardModel`, and `renderProfileStatsSvg(model: ProfileStatsCardModel): string`.

  ```ts
  export type ProfileStatsCardModel = {
    title: string;
    periodLabel: string;
    rows: Array<{ label: string; value: string }>;
  };
  ```

- [ ] **Step 1: カードモデルのテストを書く**

  `buildProfileStatsCard`へfixture相当の`ProfileStats`を渡し、タイトル、期間ラベル、次の表示順の4行を検証する。

  ```ts
  [
    { label: "Commits", value: "1,284" },
    { label: "Pull Requests", value: "76" },
    { label: "Issues", value: "42" },
    { label: "Repositories", value: "18" },
  ]
  ```

- [ ] **Step 2: SVG構造のテストを書く**

  `renderProfileStatsSvg`の出力が、固定の`width`、`height`、`viewBox`、`<rect>`、`<text>`を含み、4つの値と期間ラベルを含むことを検証する。XML特殊文字を含むタイトルを渡し、`&`、`<`、`>`、`"`、`'`が適切にエスケープされることも検証する。

- [ ] **Step 3: カードモデルとSVG描画を実装する**

  `profile-stats.ts`は数値を3桁区切りへ整形し、表示用の行へ変換する。`render/svg.ts`は次の固定テーマを使う。

  ```ts
  const theme = {
    background: "#1e1e2e",
    foreground: "#cdd6f4",
    muted: "#a6adc8",
    accent: "#89b4fa",
    panel: "#313244",
  };
  ```

  SVGは幅520、高さ180、viewBox`0 0 520 180`とし、タイトル、期間、4つのメトリクス行を描画する。外部参照を作らず、すべてのテキストを共通の`escapeXml`関数に通す。

- [ ] **Step 4: rendererのテストと型チェックを実行する**

  Run: `node --import tsx --test tests/profile-stats.test.ts tests/svg.test.ts`

  Expected: PASS。

  Run: `npm run typecheck`

  Expected: PASS。

- [ ] **Step 5: コミットする**

  ```bash
  git add src/cards/profile-stats.ts src/render/svg.ts tests/profile-stats.test.ts tests/svg.test.ts
  git commit -m "feat: render custom profile stats SVG"
  ```

## Task 5: CLI生成処理とローカル検証を接続する

**Files:**
- Create: `src/generate.ts`
- Create: `tests/generate.test.ts`
- Create: `generated/profile-stats.svg`

**Interfaces:**
- Consumes: `loadConfig`, `getFixtureStats`, `fetchGithubStats`, `buildProfileStatsCard`, `renderProfileStatsSvg`.
- Produces: `npm run generate` and `writeGeneratedCard(config, stats): Promise<string>`.

- [ ] **Step 1: CLIのfixture生成テストを書く**

  `tests/generate.test.ts`では一時ディレクトリを作り、fixture設定で`writeGeneratedCard`を実行する。生成ファイルが存在し、UTF-8のSVGとして読み取れ、fixtureの数値を含むことを検証する。テスト終了時に一時ディレクトリを削除する。

- [ ] **Step 2: データソース選択と出力処理を実装する**

  `src/generate.ts`は設定を読み、`fixture`ならfixtureアダプター、`github`ならGraphQLアダプターを選ぶ。`OUTPUT_DIR`を再帰的に作成し、`profile-stats.svg`をUTF-8で書き込む。成功時は出力先のパスだけを表示し、トークンやAPIレスポンスは表示しない。

- [ ] **Step 3: ローカルfixture生成を実行する**

  Run: `npm run generate`

  Expected: `generated/profile-stats.svg`が生成され、XML先頭が`<svg`で始まり、READMEから参照可能な相対パスに存在する。

- [ ] **Step 4: 全テストと型チェックを実行する**

  Run: `npm test`

  Expected: PASS。

  Run: `npm run typecheck`

  Expected: PASS。

- [ ] **Step 5: コミットする**

  ```bash
  git add src/generate.ts tests/generate.test.ts generated/profile-stats.svg
  git commit -m "feat: add local SVG generation command"
  ```

## Task 6: Actions Workflowで定期生成する

**Files:**
- Create: `.github/workflows/generate-cards.yml`

**Interfaces:**
- Consumes: `npm ci`, `npm run generate`, `PROFILE_GITHUB_TOKEN` Secret.
- Produces: 日次または手動の実データ生成と、差分がある場合の`generated/profile-stats.svg`更新。

- [ ] **Step 1: Workflowの静的設定を作る**

  `schedule`と`workflow_dispatch`だけをトリガーにし、ジョブへ次の権限を設定する。

  ```yaml
  permissions:
    contents: write
  ```

  `actions/checkout`、`actions/setup-node`、Node.js 22、`npm ci`、`npm run generate`を順に実行する。`actions/setup-node`は`.nvmrc`のNode.jsバージョンを読む。`DATA_SOURCE=github`、`GITHUB_USERNAME=renkonmaster`、`GITHUB_TOKEN=${{ secrets.PROFILE_GITHUB_TOKEN }}`を設定する。

- [ ] **Step 2: 生成物の差分コミットを実装する**

  生成後に、追跡済みかつ差分なしの場合だけ「変更なし」と判定する。未追跡の初回生成物もcommit対象にするため、`git diff --quiet -- generated/profile-stats.svg && git ls-files --error-unmatch generated/profile-stats.svg`の両方が成功した場合だけ早期終了する。それ以外はActions標準の`GITHUB_TOKEN`で`generated/profile-stats.svg`をcommit・pushする。これは将来のGitHub Actions実行時の処理であり、この作業セッションから`git push`は実行しない。コミットメッセージは`chore: update generated profile card`に固定する。

- [ ] **Step 3: 秘密情報を参照しないWorkflowであることを確認する**

  Workflow本文にPAT値を直接書かず、`PROFILE_GITHUB_TOKEN` Secret参照だけを使う。`set -x`、レスポンス出力、環境変数全体のdumpを追加しない。

- [ ] **Step 4: YAMLと生成コマンドをローカルで検証する**

  Run: `npm run generate`

  Expected: fixtureで生成が成功する。

  Run: `git diff --check`

  Expected: whitespace errorなし。GitHub上での実行はSecret設定後に`workflow_dispatch`で確認する。

- [ ] **Step 5: コミットする**

  ```bash
  git add .github/workflows/generate-cards.yml
  git commit -m "ci: generate profile card on schedule"
  ```

## Task 7: READMEを生成SVGへ切り替える

**Files:**
- Modify: `README.md:21-34`

**Interfaces:**
- Consumes: `generated/profile-stats.svg`.
- Produces: 外部Summary Cards APIに依存しないStats表示。

- [ ] **Step 1: 既存Stats画像の置換を確認する**

  `README.md`のStatsセクションから5つの`github-profile-summary-cards.vercel.app`画像を削除し、次の相対パス参照へ置き換える。

  ```html
  <p align="center">
    <img src="./generated/profile-stats.svg" alt="GitHub profile statistics" />
  </p>
  ```

- [ ] **Step 2: READMEと生成物のパスを検証する**

  Run: `test -f generated/profile-stats.svg`

  Expected: PASS。

  Run: `rg -n "github-profile-summary-cards|generated/profile-stats.svg" README.md`

  Expected: Summary Cards URLが0件、生成SVG参照が1件。

- [ ] **Step 3: README変更をコミットする**

  ```bash
  git add README.md
  git commit -m "feat: use self-generated profile stats card"
  ```

## Task 8: 最終検証と運用手順を確認する

**Files:**
- Modify: `.env.example`（Task 1のキーと実装の差異がある場合のみ）
- Modify: `README.md`（ローカル生成手順を短く追記する場合のみ）

**Interfaces:**
- Consumes: 全タスクの生成コマンド、Workflow、README参照。
- Produces: ローカル・fixture・実データ・Actionsの運用確認結果。

- [ ] **Step 1: fixtureモードの再生成を確認する**

  Run: `npm ci && npm test && npm run typecheck && npm run generate`

  Expected: 全テストPASS、型チェックPASS、既存SVGを安全に上書きして再生成成功。

- [ ] **Step 2: 生成SVGの秘密情報混入を検査する**

  Run: `rg -n "ghp_|github_pat_|Authorization|Bearer|private|\.git" generated/profile-stats.svg`

  Expected: トークン、認証ヘッダー、Private Repo識別情報に該当する出力なし。カードの固定文言に`private`を含めない設計なら全件0件。

- [ ] **Step 3: 差分とコミット状態を確認する**

  Run: `git diff --check && git status --short && git log -5 --oneline`

  Expected: whitespace errorなし。意図したファイルだけが変更されていることを確認する。`git push`は実行しない。

- [ ] **Step 4: 実データ実行の手動確認手順を記録する**

  GitHubリポジトリのActions Secretに、対象Private Repoへのread権限だけを持つ`PROFILE_GITHUB_TOKEN`を登録し、Actionsの`workflow_dispatch`を実行する。完了後、`generated/profile-stats.svg`の差分コミットとプロフィールREADMEの表示を確認する。失敗時はGraphQLレスポンスやトークンをログに出さず、Secret権限、Private contributions設定、Actions権限を順に確認する。

- [ ] **Step 5: 最終コミットを作る**

  ```bash
  git add docs/superpowers/specs/2026-08-19-profile-card-generator-design.md docs/superpowers/plans/2026-08-19-profile-card-generator.md
  git commit -m "docs: add profile card generator implementation plan"
  ```

  このステップでも`git push`は実行しない。
