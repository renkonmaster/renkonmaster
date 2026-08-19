import assert from "node:assert/strict";
import { test } from "node:test";

import { fetchGithubStats } from "../src/data/github.ts";

const successPayload = {
  data: {
    user: {
      contributionsCollection: {
        totalCommitContributions: 1284,
        totalPullRequestContributions: 76,
        totalIssueContributions: 42,
        totalRepositoryContributions: 18,
      },
    },
  },
};

test("GitHub GraphQLの集計値をProfileStatsへ変換する", async () => {
  let requestUrl = "";
  let requestInit: RequestInit | undefined;
  const fetchImpl: typeof fetch = async (input, init) => {
    requestUrl = String(input);
    requestInit = init;
    return new Response(JSON.stringify(successPayload), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const stats = await fetchGithubStats(
    "renkonmaster",
    "secret-token",
    new Date("2026-08-19T00:00:00.000Z"),
    fetchImpl,
  );

  assert.equal(requestUrl, "https://api.github.com/graphql");
  assert.equal((requestInit?.headers as Record<string, string>).Authorization, "Bearer secret-token");
  const requestBody = JSON.parse(String(requestInit?.body)) as {
    variables: { login: string; from: string; to: string };
  };
  assert.deepEqual(requestBody.variables, {
    login: "renkonmaster",
    from: "2025-08-19T00:00:00.000Z",
    to: "2026-08-19T00:00:00.000Z",
  });

  assert.deepEqual(stats, {
    username: "renkonmaster",
    periodLabel: "2025-08-19 – 2026-08-19",
    commits: 1284,
    pullRequests: 76,
    issues: 42,
    repositoriesContributed: 18,
  });
});

test("HTTPエラーは認証情報を含めずに失敗する", async () => {
  const fetchImpl: typeof fetch = async () => new Response("upstream failure", { status: 500 });

  await assert.rejects(
    fetchGithubStats("renkonmaster", "secret-token", new Date("2026-08-19T00:00:00.000Z"), fetchImpl),
    (error: unknown) => {
      assert(error instanceof Error);
      assert.match(error.message, /GitHub API request failed with status 500/);
      assert.doesNotMatch(error.message, /secret-token/);
      return true;
    },
  );
});

test("GraphQLエラーはレスポンス本文を露出せずに失敗する", async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response(JSON.stringify({ errors: [{ message: "secret repository name" }] }), { status: 200 });

  await assert.rejects(
    fetchGithubStats("renkonmaster", "secret-token", new Date("2026-08-19T00:00:00.000Z"), fetchImpl),
    (error: unknown) => {
      assert(error instanceof Error);
      assert.match(error.message, /GitHub GraphQL request failed/);
      assert.doesNotMatch(error.message, /secret repository name/);
      return true;
    },
  );
});

test("対象ユーザーが存在しない場合は明示的に失敗する", async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response(JSON.stringify({ data: { user: null } }), { status: 200 });

  await assert.rejects(
    fetchGithubStats("missing-user", "secret-token", new Date("2026-08-19T00:00:00.000Z"), fetchImpl),
    /GitHub user not found/,
  );
});
