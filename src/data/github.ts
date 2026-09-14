import type { ProfileStats } from "../types.ts";

const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";
const YEAR_BATCH_SIZE = 5;

const profileStatsQuery = `
  query ProfileStats($login: String!, $after: String) {
    user(login: $login) {
      contributionsCollection {
        contributionYears
      }
      repositoriesContributedTo(
        first: 1
        includeUserRepositories: true
        privacy: PUBLIC
        contributionTypes: [COMMIT, ISSUE, PULL_REQUEST, REPOSITORY]
      ) {
        totalCount
      }
      pullRequests(first: 1) {
        totalCount
      }
      issues(first: 1) {
        totalCount
      }
      repositories(
        first: 100
        after: $after
        ownerAffiliations: OWNER
        privacy: PUBLIC
        isFork: false
        orderBy: { direction: DESC, field: STARGAZERS }
      ) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          stargazers {
            totalCount
          }
        }
      }
    }
  }
`;

const commitContributionsQuery = `
  query ContributionsByYear($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        totalCommitContributions
      }
    }
  }
`;

type ContributionYears = {
  contributionYears: number[];
};

type CountSummary = {
  totalCount: number;
};

type RepositoryStars = {
  stargazers: CountSummary;
};

type RepositorySummary = {
  pageInfo: {
    hasNextPage: boolean;
    endCursor: string | null;
  };
  nodes: RepositoryStars[];
};

type ProfileUser = {
  contributionsCollection: ContributionYears;
  repositoriesContributedTo: CountSummary;
  pullRequests: CountSummary;
  issues: CountSummary;
  repositories: RepositorySummary;
};

type ProfilePayload = {
  data?: {
    user?: ProfileUser | null;
  };
  errors?: unknown[];
};

type CommitPayload = {
  data?: {
    user?: {
      contributionsCollection?: {
        totalCommitContributions?: unknown;
      } | null;
    } | null;
  };
  errors?: unknown[];
};

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isCountSummary(value: unknown): value is CountSummary {
  if (typeof value !== "object" || value === null) return false;
  return isNonNegativeInteger((value as Record<string, unknown>).totalCount);
}

function isContributionYears(value: unknown): value is ContributionYears {
  if (typeof value !== "object" || value === null) return false;
  const years = (value as Record<string, unknown>).contributionYears;
  return Array.isArray(years) && years.every((year) => Number.isInteger(year) && year >= 2008);
}

function isRepositorySummary(value: unknown): value is RepositorySummary {
  if (typeof value !== "object" || value === null) return false;

  const summary = value as Record<string, unknown>;
  if (!Array.isArray(summary.nodes)) return false;
  if (typeof summary.pageInfo !== "object" || summary.pageInfo === null) return false;

  const pageInfo = summary.pageInfo as Record<string, unknown>;
  if (typeof pageInfo.hasNextPage !== "boolean") return false;
  if (pageInfo.endCursor !== null && typeof pageInfo.endCursor !== "string") return false;

  return summary.nodes.every((node) => {
    if (typeof node !== "object" || node === null) return false;
    const repository = node as Record<string, unknown>;
    if (typeof repository.stargazers !== "object" || repository.stargazers === null) return false;
    return isNonNegativeInteger((repository.stargazers as Record<string, unknown>).totalCount);
  });
}

function isProfileUser(value: unknown): value is ProfileUser {
  if (typeof value !== "object" || value === null) return false;

  const user = value as Record<string, unknown>;
  return (
    isContributionYears(user.contributionsCollection) &&
    isCountSummary(user.repositoriesContributedTo) &&
    isCountSummary(user.pullRequests) &&
    isCountSummary(user.issues) &&
    isRepositorySummary(user.repositories)
  );
}

function isGraphQLErrorPayload(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const errors = (value as Record<string, unknown>).errors;
  return Array.isArray(errors) && errors.length > 0;
}

async function requestGraphql(
  fetchImpl: typeof fetch,
  token: string,
  query: string,
  variables: Record<string, string | null>,
): Promise<unknown> {
  const response = await fetchImpl(GITHUB_GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`GitHub API request failed with status ${response.status}`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("GitHub API returned invalid JSON");
  }

  if (isGraphQLErrorPayload(payload)) {
    throw new Error("GitHub GraphQL request failed");
  }

  return payload;
}

function yearVariables(year: number, now: Date): { from: string; to: string } {
  const currentYear = now.getUTCFullYear();
  return {
    from: `${year}-01-01T00:00:00Z`,
    to: year === currentYear ? now.toISOString() : `${year}-12-31T23:59:59Z`,
  };
}

async function fetchCommitContributionsForYear(
  username: string,
  token: string,
  year: number,
  now: Date,
  fetchImpl: typeof fetch,
): Promise<number> {
  const payload = (await requestGraphql(
    fetchImpl,
    token,
    commitContributionsQuery,
    { login: username, ...yearVariables(year, now) },
  )) as CommitPayload;
  const user = payload.data?.user;
  const total = user?.contributionsCollection?.totalCommitContributions;

  if (!user) {
    throw new Error("GitHub user not found");
  }
  if (!isNonNegativeInteger(total)) {
    throw new Error("GitHub GraphQL response missing commit totals");
  }
  return total;
}

async function fetchAllCommitContributions(
  username: string,
  token: string,
  years: number[],
  now: Date,
  fetchImpl: typeof fetch,
): Promise<number> {
  let total = 0;
  const sortedYears = [...new Set(years)].sort((a, b) => b - a);

  for (let index = 0; index < sortedYears.length; index += YEAR_BATCH_SIZE) {
    const batch = sortedYears.slice(index, index + YEAR_BATCH_SIZE);
    const counts = await Promise.all(
      batch.map((year) => fetchCommitContributionsForYear(username, token, year, now, fetchImpl)),
    );
    total += counts.reduce((sum, count) => sum + count, 0);
  }

  return total;
}

export async function fetchGithubStats(
  username: string,
  token: string,
  now: Date = new Date(),
  fetchImpl: typeof fetch = fetch,
): Promise<ProfileStats> {
  let after: string | null = null;
  const seenCursors = new Set<string>();
  let contributionYears: number[] | undefined;
  let repositoriesContributed: number | undefined;
  let pullRequests: number | undefined;
  let issues: number | undefined;
  let totalStars = 0;

  while (true) {
    const payload = (await requestGraphql(fetchImpl, token, profileStatsQuery, {
      login: username,
      after,
    })) as ProfilePayload;
    const user = payload.data?.user;

    if (!user) {
      throw new Error("GitHub user not found");
    }
    if (!isProfileUser(user)) {
      throw new Error("GitHub GraphQL response missing profile totals");
    }

    contributionYears ??= user.contributionsCollection.contributionYears;
    repositoriesContributed ??= user.repositoriesContributedTo.totalCount;
    pullRequests ??= user.pullRequests.totalCount;
    issues ??= user.issues.totalCount;
    totalStars += user.repositories.nodes.reduce(
      (sum, repository) => sum + repository.stargazers.totalCount,
      0,
    );

    if (!user.repositories.pageInfo.hasNextPage) break;
    const nextCursor = user.repositories.pageInfo.endCursor;
    if (!nextCursor || seenCursors.has(nextCursor)) {
      throw new Error("GitHub GraphQL response missing repository page cursor");
    }
    seenCursors.add(nextCursor);
    after = nextCursor;
  }

  if (
    contributionYears === undefined ||
    repositoriesContributed === undefined ||
    pullRequests === undefined ||
    issues === undefined
  ) {
    throw new Error("GitHub GraphQL response missing profile totals");
  }

  const commits = await fetchAllCommitContributions(
    username,
    token,
    contributionYears,
    now,
    fetchImpl,
  );

  return {
    username,
    periodLabel: "All time",
    totalStars,
    commits,
    pullRequests,
    issues,
    repositoriesContributed,
  };
}
