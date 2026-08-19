import type { ProfileStats } from "../types.ts";

const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";

const profileStatsQuery = `
  query ProfileStats($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        totalCommitContributions
        totalPullRequestContributions
        totalIssueContributions
        totalRepositoryContributions
      }
    }
  }
`;

type ContributionTotals = {
  totalCommitContributions: number;
  totalPullRequestContributions: number;
  totalIssueContributions: number;
  totalRepositoryContributions: number;
};

type GraphQLPayload = {
  data?: {
    user: {
      contributionsCollection: ContributionTotals;
    } | null;
  };
  errors?: unknown[];
};

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function previousYear(value: Date): Date {
  const result = new Date(value);
  result.setUTCFullYear(result.getUTCFullYear() - 1);
  return result;
}

function isContributionTotals(value: unknown): value is ContributionTotals {
  if (typeof value !== "object" || value === null) return false;

  const totals = value as Record<string, unknown>;
  return [
    "totalCommitContributions",
    "totalPullRequestContributions",
    "totalIssueContributions",
    "totalRepositoryContributions",
  ].every((key) => typeof totals[key] === "number" && Number.isInteger(totals[key]) && totals[key] >= 0);
}

export async function fetchGithubStats(
  username: string,
  token: string,
  now: Date = new Date(),
  fetchImpl: typeof fetch = fetch,
): Promise<ProfileStats> {
  const from = previousYear(now);
  const to = now;
  const variables = {
    login: username,
    from: from.toISOString(),
    to: to.toISOString(),
  };

  const response = await fetchImpl(GITHUB_GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query: profileStatsQuery, variables }),
  });

  if (!response.ok) {
    throw new Error(`GitHub API request failed with status ${response.status}`);
  }

  let payload: GraphQLPayload;
  try {
    payload = (await response.json()) as GraphQLPayload;
  } catch {
    throw new Error("GitHub API returned invalid JSON");
  }

  if (payload.errors && payload.errors.length > 0) {
    throw new Error("GitHub GraphQL request failed");
  }

  const user = payload.data?.user;
  if (!user) {
    throw new Error("GitHub user not found");
  }

  if (!isContributionTotals(user.contributionsCollection)) {
    throw new Error("GitHub GraphQL response missing contribution totals");
  }

  const totals = user.contributionsCollection;
  return {
    username,
    periodLabel: `${dateOnly(from)} – ${dateOnly(to)}`,
    commits: totals.totalCommitContributions,
    pullRequests: totals.totalPullRequestContributions,
    issues: totals.totalIssueContributions,
    repositoriesContributed: totals.totalRepositoryContributions,
  };
}
