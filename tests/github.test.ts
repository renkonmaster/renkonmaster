import assert from "node:assert/strict";
import { test } from "node:test";

import {
  fetchGithubCommitLanguages,
  fetchGithubProductiveTime,
  fetchGithubProfileDetails,
  fetchGithubRepoLanguages,
  fetchGithubStats,
  validateGithubToken,
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

test("token preflightはsecret欠落をAPI呼び出し前に識別する", async () => {
  await assert.rejects(validateGithubToken("", async () => {
    assert.fail("must not request without a token");
  }), /PROFILE_GITHUB_TOKEN is missing/);
});

test("token preflightは認証済みRESTの空scope headerでclassic PATを検証する", async () => {
  await validateGithubToken("ghp_controlled-token", async (url, init) => {
    assert.equal(String(url), "https://api.github.com/user");
    assert.equal(init?.method, "GET");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer ghp_controlled-token");
    return new Response("sensitive response is never parsed", {
      status: 200,
      headers: { "X-OAuth-Scopes": "" },
    });
  });
});

for (const scenario of [
  { name: "repo scope", token: "ghp_controlled-token", scopes: "repo, read:org", status: 200 },
  { name: "public_repo scope", token: "ghp_controlled-token", scopes: "public_repo", status: 200 },
  { name: "unsafe scope header", token: "ghp_controlled-token", scopes: "sensitive-repository", status: 200 },
  { name: "missing scope header", token: "ghp_controlled-token", scopes: undefined, status: 200 },
  { name: "fine-grained PAT", token: "github_pat_controlled-token", scopes: "", status: 200 },
  { name: "app token", token: "ghs_controlled-token", scopes: "", status: 200 },
  { name: "unverifiable token type", token: "controlled-token", scopes: "", status: 200 },
  { name: "invalid authentication", token: "ghp_controlled-token", scopes: "", status: 401 },
  { name: "REST unavailable", token: "ghp_controlled-token", scopes: "", status: 500 },
  { name: "network failure", token: "ghp_controlled-token", scopes: "", status: 0 },
]) {
  test(`token preflight rejects ${scenario.name} with a fixed sanitized error`, async () => {
    await assert.rejects(validateGithubToken(scenario.token, async () => {
      if (!scenario.status) throw new Error("controlled-token sensitive-repository");
      return new Response("controlled-token sensitive-repository", {
        status: scenario.status,
        headers: scenario.scopes === undefined ? {} : { "X-OAuth-Scopes": scenario.scopes },
      });
    }), (error: unknown) => {
      assert(error instanceof Error);
      assert.equal(error.message, "GitHub token preflight failed: authentication or public-only scope verification failed; use a classic PAT with no OAuth scopes");
      assert.doesNotMatch(String(error.stack), /controlled-token|sensitive-repository/);
      assert.equal(error.cause, undefined);
      return true;
    });
  });
}

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
      assert.match(error.message, /ProfileStats/);
      assert.doesNotMatch(error.message, /unit-test-token/);
      return true;
    },
  );
});

test("GraphQLエラーはoperationと安全な分類だけを含める", async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response(JSON.stringify({ errors: [
      { type: "FORBIDDEN", extensions: { code: "UNAUTHENTICATED" }, message: "secret repository name unit-test-token" },
      { type: "SECRET_REPOSITORY", extensions: { code: "UNIT_TEST_TOKEN" } },
    ] }), { status: 200 });

  await assert.rejects(
    fetchGithubStats("renkonmaster", "unit-test-token", new Date("2026-08-19T00:00:00.000Z"), fetchImpl),
    (error: unknown) => {
      assert(error instanceof Error);
      assert.match(error.message, /GitHub GraphQL request failed/);
      assert.match(error.message, /ProfileStats/);
      assert.match(error.message, /status 200/);
      assert.match(error.message, /FORBIDDEN/);
      assert.match(error.message, /UNAUTHENTICATED/);
      assert.doesNotMatch(error.message, /secret repository name|unit-test-token|SECRET_REPOSITORY|UNIT_TEST_TOKEN|renkonmaster/);
      return true;
    },
  );
});

test("無効なtokenはHTTP statusと認証失敗を安全に識別する", async () => {
  await assert.rejects(
    fetchGithubStats("private-variable", "unit-test-token", new Date(), async () =>
      new Response("Bad credentials unit-test-token private-variable", { status: 401 })),
    (error: unknown) => {
      assert(error instanceof Error);
      assert.match(error.message, /ProfileStats/);
      assert.match(error.message, /status 401/);
      assert.match(error.message, /authentication/i);
      assert.doesNotMatch(String(error.stack), /unit-test-token|private-variable|Bad credentials/);
      assert.equal(error.cause, undefined);
      return true;
    },
  );
});

test("年別commit取得の失敗はProfileStatsではなくContributionsByYearを識別する", async () => {
  const fetchImpl: typeof fetch = async (_input, init) => {
    const { query } = JSON.parse(String(init?.body));
    return new Response(JSON.stringify(query.includes("query ProfileStats")
      ? successPayload
      : { errors: [{ type: "RATE_LIMITED", message: "sensitive response" }] }), { status: 200 });
  };
  await assert.rejects(fetchGithubStats("renkonmaster", "unit-test-token", new Date(), fetchImpl),
    (error: unknown) => {
      assert(error instanceof Error);
      assert.match(error.message, /ContributionsByYear/);
      assert.match(error.message, /RATE_LIMITED/);
      assert.doesNotMatch(error.message, /ProfileStats|sensitive response/);
      return true;
    });
});

for (const [operation, run] of [
  ["ProfileDetailsYears", (fetchImpl: typeof fetch) => fetchGithubProfileDetails("sensitive-variable", "unit-test-token", new Date(), fetchImpl)],
  ["RepositoryLanguages", (fetchImpl: typeof fetch) => fetchGithubRepoLanguages("sensitive-variable", "unit-test-token", fetchImpl)],
  ["ContributionYears", (fetchImpl: typeof fetch) => fetchGithubCommitLanguages("sensitive-variable", "unit-test-token", new Date(), fetchImpl)],
  ["ProductiveTimeUser", (fetchImpl: typeof fetch) => fetchGithubProductiveTime("sensitive-variable", "unit-test-token", new Date(), fetchImpl)],
] as const) {
  for (const failure of ["graphql", "network", "json"] as const) {
    test(`${operation}の${failure}失敗はoperationを含めて本文・変数・tokenを伏せる`, async () => {
      await assert.rejects(run(async () => {
        if (failure === "network") throw new Error("sensitive-variable unit-test-token");
        return new Response(failure === "json" ? "sensitive-variable unit-test-token" : JSON.stringify({
          errors: [{ message: "sensitive-variable unit-test-token" }],
        }), { status: 200 });
      }), (error: unknown) => {
        assert(error instanceof Error);
        assert.match(error.message, new RegExp(operation));
        assert.doesNotMatch(String(error.stack), /sensitive-variable|unit-test-token/);
        assert.equal(error.cause, undefined);
        return true;
      });
    });
  }
}

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
  assert.doesNotMatch(requests[0]?.query ?? "", /\bemail\b/, "public-only token must not request the scope-gated email field");
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
                isPrivate: false,
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
                isPrivate: true,
                primaryLanguage: { name: "TypeScript", color: "#3178c6" },
              },
              {
                isPrivate: false,
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
    assert.match(body.query, /privacy: PUBLIC/);
    assert.match(body.query, /nodes\s*\{\s*isPrivate\b/);
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
                          isPrivate: false,
                          nameWithOwner: "owner/ts-one",
                          primaryLanguage: { name: "TypeScript", color: "#3178c6" },
                        },
                        contributions: { totalCount: 8 },
                      },
                      {
                        repository: {
                          isPrivate: true,
                          nameWithOwner: "owner/private",
                          primaryLanguage: { name: "Go", color: "#00ADD8" },
                        },
                        contributions: { totalCount: 99 },
                      },
                      {
                        repository: {
                          isPrivate: false,
                          nameWithOwner: "owner/no-language",
                          primaryLanguage: null,
                        },
                        contributions: { totalCount: 2 },
                      },
                    ]
                  : [
                      {
                        repository: {
                          isPrivate: false,
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
  assert.match(requests[1]?.query ?? "", /isPrivate/);
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
                isPrivate: false,
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
                      isPrivate: false,
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

test("private repositoryのcommit履歴はProductive Timeへ含めない", async () => {
  const fetchImpl: typeof fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as { query: string };
    const payload = body.query.includes("ProductiveTimeUser")
      ? { data: { user: { id: "user-id" } } }
      : {
          data: {
            user: {
              contributionsCollection: {
                commitContributionsByRepository: [
                  {
                    repository: {
                      isPrivate: true,
                      nameWithOwner: "owner/private",
                      defaultBranchRef: {
                        target: {
                          history: {
                            nodes: [{ committedDate: "2026-01-02T09:12:00Z" }],
                            pageInfo: { hasNextPage: false, endCursor: null },
                          },
                        },
                      },
                    },
                  },
                  {
                    repository: {
                      isPrivate: false,
                      nameWithOwner: "owner/public",
                      defaultBranchRef: {
                        target: {
                          history: {
                            nodes: [{ committedDate: "2026-01-02T10:12:00Z" }],
                            pageInfo: { hasNextPage: false, endCursor: null },
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

  assert.equal(productiveTime.total, 1);
  assert.deepEqual(productiveTime.hours[10], { hour: 10, contributions: 1 });
});
