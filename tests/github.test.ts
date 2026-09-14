import assert from "node:assert/strict";
import { test } from "node:test";

import { fetchGithubStats } from "../src/data/github.ts";

const successPayload = {
  data: {
    user: {
      contributionsCollection: {
        contributionYears: [2026, 2025],
      },
      repositoriesContributedTo: { totalCount: 18 },
      pullRequests: { totalCount: 76 },
      issues: { totalCount: 42 },
      repositories: {
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: [{ stargazers: { totalCount: 24 } }],
      },
    },
  },
};

const commitPayloads = new Map([
  ["2026-01-01T00:00:00Z", 1000],
  ["2025-01-01T00:00:00Z", 284],
]);

test("GitHub GraphQLの集計値をProfileStatsへ変換する", async () => {
  let requestUrl = "";
  const requestBodies: Array<{ query: string; variables: Record<string, string | null> }> = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    requestUrl = String(input);
    const requestBody = JSON.parse(String(init?.body)) as {
      query: string;
      variables: Record<string, string | null>;
    };
    requestBodies.push(requestBody);
    const payload = requestBody.query.includes("ContributionsByYear")
      ? {
          data: {
            user: {
              contributionsCollection: {
                totalCommitContributions: commitPayloads.get(String(requestBody.variables.from)) ?? 0,
              },
            },
          },
        }
      : successPayload;
    return new Response(JSON.stringify(payload), {
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
  assert.deepEqual(requestBodies[0]?.variables, { login: "renkonmaster", after: null });
  assert.match(requestBodies[0]?.query ?? "", /includeUserRepositories: true/);
  assert.match(requestBodies[0]?.query ?? "", /privacy: PUBLIC/);
  assert.deepEqual(requestBodies.slice(1).map((body) => body.variables.from), [
    "2026-01-01T00:00:00Z",
    "2025-01-01T00:00:00Z",
  ]);

  assert.deepEqual(stats, {
    username: "renkonmaster",
    periodLabel: "All time",
    totalStars: 24,
    commits: 1284,
    pullRequests: 76,
    issues: 42,
    repositoriesContributed: 18,
  });
});

test("GitHub GraphQLの公開リポジトリスターをページングして合算する", async () => {
  const payloads = [
    {
      data: {
        user: {
          contributionsCollection: { contributionYears: [2026] },
          repositoriesContributedTo: { totalCount: 18 },
          pullRequests: { totalCount: 76 },
          issues: { totalCount: 42 },
          repositories: {
            pageInfo: { hasNextPage: true, endCursor: "cursor-1" },
            nodes: [{ stargazers: { totalCount: 24 } }],
          },
        },
      },
    },
    {
      data: {
        user: {
          contributionsCollection: { contributionYears: [2026] },
          repositoriesContributedTo: { totalCount: 18 },
          pullRequests: { totalCount: 76 },
          issues: { totalCount: 42 },
          repositories: {
            pageInfo: { hasNextPage: false, endCursor: null },
            nodes: [{ stargazers: { totalCount: 6 } }],
          },
        },
      },
    },
  ];
  let repositoryRequestCount = 0;
  let commitRequestCount = 0;
  const fetchImpl: typeof fetch = async (_input, init) => {
    const requestBody = JSON.parse(String(init?.body)) as {
      query: string;
      variables: { after?: string | null; from?: string };
    };
    if (requestBody.query.includes("ContributionsByYear")) {
      commitRequestCount += 1;
      return new Response(
        JSON.stringify({
          data: { user: { contributionsCollection: { totalCommitContributions: 1284 } } },
        }),
        { status: 200 },
      );
    }

    assert.equal(requestBody.variables.after, repositoryRequestCount === 0 ? null : "cursor-1");
    const payload = payloads[repositoryRequestCount];
    repositoryRequestCount += 1;
    return new Response(JSON.stringify(payload), { status: 200 });
  };

  const stats = await fetchGithubStats(
    "renkonmaster",
    "secret-token",
    new Date("2026-08-19T00:00:00.000Z"),
    fetchImpl,
  );

  assert.equal(repositoryRequestCount, 2);
  assert.equal(commitRequestCount, 1);
  assert.equal(stats.totalStars, 30);
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
