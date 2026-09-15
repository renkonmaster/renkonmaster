import assert from "node:assert/strict";
import { test } from "node:test";

import {
  fetchGithubCommitLanguages,
  fetchGithubProductiveTime,
  fetchGithubProfileDetails,
  fetchGithubRepoLanguages,
  fetchGithubStats,
} from "../src/data/github.ts";

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
    "unit-test-token",
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
    "unit-test-token",
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
    fetchGithubStats("renkonmaster", "unit-test-token", new Date("2026-08-19T00:00:00.000Z"), fetchImpl),
    (error: unknown) => {
      assert(error instanceof Error);
      assert.match(error.message, /GitHub API request failed with status 500/);
      assert.doesNotMatch(error.message, /unit-test-token/);
      return true;
    },
  );
});

test("GraphQLエラーはレスポンス本文を露出せずに失敗する", async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response(JSON.stringify({ errors: [{ message: "secret repository name" }] }), { status: 200 });

  await assert.rejects(
    fetchGithubStats("renkonmaster", "unit-test-token", new Date("2026-08-19T00:00:00.000Z"), fetchImpl),
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
    fetchGithubStats("missing-user", "unit-test-token", new Date("2026-08-19T00:00:00.000Z"), fetchImpl),
    /GitHub user not found/,
  );
});

test("GitHubプロフィール詳細をContributionカレンダーから集計する", async () => {
  const requests: Array<{ query: string; variables: Record<string, string | null> }> = [];
  const fetchImpl: typeof fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as {
      query: string;
      variables: Record<string, string | null>;
    };
    requests.push(body);
    const payload = body.query.includes("ProfileDetailsYears")
      ? {
          data: {
            user: {
              login: "renkonmaster",
              name: "Renkon",
              createdAt: "2016-02-27T12:34:56Z",
              email: "",
              websiteUrl: "https://example.com",
              repositories: { totalCount: 32 },
              contributionsCollection: {
                contributionYears: [2026, 2025],
                contributionCalendar: {
                  totalContributions: 9,
                  weeks: [
                    {
                      contributionDays: [
                        { date: "2026-01-02", contributionCount: 5 },
                        { date: "2025-02-03", contributionCount: 4 },
                      ],
                    },
                  ],
                },
              },
            },
          },
        }
      : { data: { user: null } };
    return new Response(JSON.stringify(payload), { status: 200 });
  };

  const details = await fetchGithubProfileDetails(
    "renkonmaster",
    "unit-test-token",
    new Date("2026-08-19T00:00:00.000Z"),
    fetchImpl,
  );

  assert.match(requests[0]?.query ?? "", /contributionYears/);
  assert.match(requests[0]?.query ?? "", /repositories\(first: 1, ownerAffiliations: OWNER, privacy: PUBLIC, isFork: false\)/);
  assert.deepEqual(details, {
    username: "renkonmaster",
    title: "Renkon",
    totalContributions: 9,
    publicRepositories: 32,
    joinedAt: "2016-02-27T12:34:56Z",
    contact: "https://example.com",
    contributionDays: [
      { date: "2025-02-03", contributionCount: 4 },
      { date: "2026-01-02", contributionCount: 5 },
    ],
  });
});

test("GitHubリポジトリのprimary languageをページングして件数集計する", async () => {
  const payloads = [
    {
      data: {
        user: {
          repositories: {
            pageInfo: { hasNextPage: true, endCursor: "repo-cursor" },
            nodes: [
              {
                primaryLanguage: { name: "TypeScript", color: "#3178c6" },
              },
            ],
          },
        },
      },
    },
    {
      data: {
        user: {
          repositories: {
            pageInfo: { hasNextPage: false, endCursor: null },
            nodes: [
              {
                primaryLanguage: { name: "Shell", color: null },
              },
            ],
          },
        },
      },
    },
  ];
  let call = 0;
  const fetchImpl: typeof fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as {
      query: string;
      variables: { after: string | null };
    };
    assert.match(body.query, /primaryLanguage \{/);
    assert.equal(body.variables.after, call === 0 ? null : "repo-cursor");
    return new Response(JSON.stringify(payloads[call++]), { status: 200 });
  };

  assert.deepEqual(await fetchGithubRepoLanguages("renkonmaster", "unit-test-token", fetchImpl), {
    total: 2,
    languages: [
      { name: "TypeScript", color: "#3178c6", value: 1 },
      { name: "Shell", color: null, value: 1 },
    ],
  });
});

test("GitHub commit contributionsを年別repositoryのprimary languageへ集計する", async () => {
  const requests: Array<{ query: string; variables: Record<string, string | null> }> = [];
  const fetchImpl: typeof fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as {
      query: string;
      variables: Record<string, string | null>;
    };
    requests.push(body);
    const payload = body.query.includes("ContributionYears")
      ? { data: { user: { contributionsCollection: { contributionYears: [2026, 2025] } } } }
      : {
          data: {
            user: {
              contributionsCollection: {
                commitContributionsByRepository: String(body.variables.from).startsWith("2026")
                  ? [
                      {
                        repository: {
                          nameWithOwner: "owner/ts-one",
                          primaryLanguage: { name: "TypeScript", color: "#3178c6" },
                        },
                        contributions: { totalCount: 8 },
                      },
                      {
                        repository: {
                          nameWithOwner: "owner/no-language",
                          primaryLanguage: null,
                        },
                        contributions: { totalCount: 2 },
                      },
                    ]
                  : [
                      {
                        repository: {
                          nameWithOwner: "owner/ts-two",
                          primaryLanguage: { name: "TypeScript", color: "#3178c6" },
                        },
                        contributions: { totalCount: 5 },
                      },
                    ],
              },
            },
          },
        };
    return new Response(JSON.stringify(payload), { status: 200 });
  };

  const breakdown = await fetchGithubCommitLanguages(
    "renkonmaster",
    "unit-test-token",
    new Date("2026-08-19T00:00:00.000Z"),
    fetchImpl,
  );

  assert.match(requests[1]?.query ?? "", /commitContributionsByRepository\(maxRepositories: 100\)/);
  assert.match(requests[1]?.query ?? "", /primaryLanguage \{\s*name\s*color\s*\}/);
  assert.match(requests[1]?.query ?? "", /nameWithOwner/);
  assert.match(requests[1]?.query ?? "", /contributions \{\s*totalCount\s*\}/);
  assert.deepEqual(breakdown, {
    total: 13,
    languages: [
      { name: "TypeScript", color: "#3178c6", value: 13 },
    ],
  });
});

test("GitHub commit履歴をUTCの24時間bucketへ集計する", async () => {
  const fetchImpl: typeof fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as {
      query: string;
      variables: Record<string, string>;
    };
    const payload = body.query.includes("ProductiveTimeUser")
      ? { data: { user: { id: "user-id" } } }
      : body.query.includes("ProductiveTimeRepository")
        ? {
            data: {
              repository: {
                defaultBranchRef: {
                  target: {
                    history: {
                      nodes: [{ committedDate: "2026-03-04T01:00:00Z" }],
                      pageInfo: { hasNextPage: false, endCursor: null },
                    },
                  },
                },
              },
            },
          }
      : {
          data: {
            user: {
              contributionsCollection: {
                commitContributionsByRepository: [
                  {
                    repository: {
                      nameWithOwner: "owner/repo",
                      defaultBranchRef: {
                        target: {
                          history: {
                            nodes: [
                              { committedDate: "2026-01-02T09:12:00Z" },
                              { committedDate: "2026-02-03T09:45:00Z" },
                              { committedDate: "2026-02-04T22:00:00Z" },
                            ],
                            pageInfo: { hasNextPage: true, endCursor: "history-cursor" },
                          },
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        };
    return new Response(JSON.stringify(payload), { status: 200 });
  };

  const productiveTime = await fetchGithubProductiveTime(
    "renkonmaster",
    "unit-test-token",
    new Date("2026-08-19T00:00:00.000Z"),
    fetchImpl,
    0,
  );

  assert.equal(productiveTime.hours.length, 24);
  assert.deepEqual(productiveTime.hours[9], { hour: 9, contributions: 2 });
  assert.deepEqual(productiveTime.hours[22], { hour: 22, contributions: 1 });
  assert.deepEqual(productiveTime.hours[1], { hour: 1, contributions: 1 });
  assert.equal(productiveTime.total, 4);
});
