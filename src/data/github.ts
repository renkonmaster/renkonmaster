import type {
  ContributionDay,
  LanguageBreakdown,
  LanguageTotal,
  ProductiveTime,
  ProfileDetails,
  ProfileStats,
} from "../types.ts";

const GITHUB_GRAPHQL_URL = "https://api.github.com/graphql";
const YEAR_BATCH_SIZE = 5;

export async function validateGithubToken(token: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  if (!token.trim()) throw new Error("PROFILE_GITHUB_TOKEN is missing");
  const failure = "GitHub token preflight failed: authentication or public-only scope verification failed; use a classic PAT with no OAuth scopes";
  // Fine-grained and app tokens do not offer verifiable OAuth scope semantics.
  if (!token.startsWith("ghp_")) throw new Error(failure);
  try {
    const response = await fetchImpl("https://api.github.com/user", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      redirect: "error",
    });
    // An absent header is unverifiable, not equivalent to an empty scope list.
    // No response body or header value may appear in diagnostics.
    if (response.status !== 200 || response.headers.get("X-OAuth-Scopes") !== "") {
      throw new Error(failure);
    }
  } catch {
    throw new Error(failure);
  }
}

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

const profileDetailsYearsQuery = `
  query ProfileDetailsYears($login: String!) {
    user(login: $login) {
      login
      name
      createdAt
      websiteUrl
      repositories(first: 1, ownerAffiliations: OWNER, privacy: PUBLIC, isFork: false) {
        totalCount
      }
      contributionsCollection {
        contributionYears
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              contributionCount
            }
          }
        }
      }
    }
  }
`;

const repositoryLanguagesQuery = `
  query RepositoryLanguages($login: String!, $after: String) {
    user(login: $login) {
      repositories(
        first: 100
        after: $after
        ownerAffiliations: OWNER
        privacy: PUBLIC
        isFork: false
      ) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          isPrivate
          primaryLanguage {
            name
            color
          }
        }
      }
    }
  }
`;

const contributionYearsQuery = `
  query ContributionYears($login: String!) {
    user(login: $login) {
      contributionsCollection {
        contributionYears
      }
    }
  }
`;

const commitLanguagesQuery = `
  query CommitLanguagesByYear($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        commitContributionsByRepository(maxRepositories: 100) {
          repository {
            isPrivate
            primaryLanguage {
              name
              color
            }
            nameWithOwner
          }
          contributions {
            totalCount
          }
        }
      }
    }
  }
`;

const productiveTimeUserQuery = `
  query ProductiveTimeUser($login: String!) {
    user(login: $login) {
      id
    }
  }
`;

const productiveTimeQuery = `
  query ProductiveTime($login: String!, $userId: ID!, $since: GitTimestamp!, $until: GitTimestamp!) {
    user(login: $login) {
      contributionsCollection {
        commitContributionsByRepository(maxRepositories: 100) {
          repository {
            isPrivate
            nameWithOwner
            defaultBranchRef {
              target {
                ... on Commit {
                  history(first: 100, since: $since, until: $until, author: { id: $userId }) {
                    nodes {
                      committedDate
                    }
                    pageInfo {
                      hasNextPage
                      endCursor
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

const productiveTimeRepositoryQuery = `
  query ProductiveTimeRepository($owner: String!, $name: String!, $userId: ID!, $since: GitTimestamp!, $until: GitTimestamp!, $after: String) {
    repository(owner: $owner, name: $name) {
      isPrivate
      defaultBranchRef {
        target {
          ... on Commit {
            history(first: 100, after: $after, since: $since, until: $until, author: { id: $userId }) {
              nodes {
                committedDate
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        }
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

function isContributionYearList(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((year) => Number.isInteger(year) && year >= 2008);
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

type GraphqlOperation =
  | "ProfileStats"
  | "ContributionsByYear"
  | "ProfileDetailsYears"
  | "RepositoryLanguages"
  | "ContributionYears"
  | "CommitLanguagesByYear"
  | "ProductiveTimeUser"
  | "ProductiveTime"
  | "ProductiveTimeRepository";

// Allow only known classifications. Arbitrary type/code strings can contain
// upstream data just like message text, so character filtering is insufficient.
const SAFE_GRAPHQL_CODES = new Set([
  "FORBIDDEN", "UNAUTHORIZED", "UNAUTHENTICATED", "NOT_FOUND", "RATE_LIMITED",
  "BAD_USER_INPUT", "GRAPHQL_PARSE_FAILED", "GRAPHQL_VALIDATION_FAILED",
  "INTERNAL", "INTERNAL_SERVER_ERROR", "SERVICE_UNAVAILABLE",
  "MAX_NODE_LIMIT_EXCEEDED", "RESOURCE_LIMITS_EXCEEDED",
]);

function safeGraphqlCodes(errors: unknown[]): string[] {
  const codes = new Set<string>();
  for (const error of errors) {
    if (typeof error !== "object" || error === null) continue;
    const { type, extensions } = error as Record<string, unknown>;
    const code = typeof extensions === "object" && extensions !== null
      ? (extensions as Record<string, unknown>).code : undefined;
    for (const value of [type, code]) {
      if (typeof value === "string" && SAFE_GRAPHQL_CODES.has(value)) codes.add(value);
    }
  }
  return [...codes].sort();
}

async function requestGraphql(
  fetchImpl: typeof fetch,
  token: string,
  operation: GraphqlOperation,
  query: string,
  variables: Record<string, string | null>,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(GITHUB_GRAPHQL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    throw new Error(`GitHub API network request failed (operation ${operation})`);
  }

  if (!response.ok) {
    const classification = response.status === 401 ? "; authentication failed" : "";
    throw new Error(`GitHub API request failed with status ${response.status} (operation ${operation}${classification})`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`GitHub API returned invalid JSON (operation ${operation}; status ${response.status})`);
  }

  const errors = typeof payload === "object" && payload !== null
    ? (payload as Record<string, unknown>).errors : undefined;
  if (Array.isArray(errors) && errors.length > 0) {
    const codes = safeGraphqlCodes(errors);
    const classification = codes.length ? `; ${codes.join(", ")}` : "";
    throw new Error(`GitHub GraphQL request failed (operation ${operation}; status ${response.status}${classification})`);
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
    "ContributionsByYear",
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
    const payload = (await requestGraphql(fetchImpl, token, "ProfileStats", profileStatsQuery, {
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

type ProfileDetailsPayload = {
  data?: {
    user?: {
      login?: unknown;
      name?: unknown;
      createdAt?: unknown;
      websiteUrl?: unknown;
      repositories?: { totalCount?: unknown };
      contributionsCollection?: ContributionYears & { contributionCalendar?: ContributionCalendar };
    } | null;
  };
};

type ContributionCalendar = {
  totalContributions: number;
  weeks: Array<{ contributionDays: ContributionDay[] }>;
};

type RepositoryLanguagePayload = {
  data?: {
    user?: {
      repositories?: {
        pageInfo?: { hasNextPage?: unknown; endCursor?: unknown };
        nodes?: Array<{
          isPrivate?: unknown;
          primaryLanguage?: { name?: unknown; color?: unknown } | null;
        }>;
      };
    } | null;
  };
};

type ContributionLanguagePayload = {
  data?: {
    user?: {
      contributionsCollection?: {
        commitContributionsByRepository?: Array<{
          repository?: {
            isPrivate?: unknown;
            primaryLanguage?: { name?: unknown; color?: unknown } | null;
          } | null;
          contributions?: { totalCount?: unknown };
        }>;
      };
    } | null;
  };
};

type ProductiveTimePayload = {
  data?: {
    user?: {
      contributionsCollection?: { commitContributionsByRepository?: Array<{
        repository?: {
          isPrivate?: unknown;
          nameWithOwner?: unknown;
          defaultBranchRef?: {
            target?: { history?: ProductiveCommitHistory } | null;
          } | null;
        } | null;
      }> };
    } | null;
  };
};

type ProductiveTimeUserPayload = {
  data?: { user?: { id?: unknown } | null };
};

type ProductiveCommitHistory = {
  nodes?: Array<{ committedDate?: unknown }>;
  pageInfo?: { hasNextPage?: unknown; endCursor?: unknown };
};

type ProductiveTimeRepositoryPayload = {
  data?: {
    repository?: {
      isPrivate?: unknown;
      defaultBranchRef?: {
        target?: { history?: ProductiveCommitHistory } | null;
      } | null;
    } | null;
  };
};

function isContributionDay(value: unknown): value is ContributionDay {
  if (typeof value !== "object" || value === null) return false;
  const day = value as Record<string, unknown>;
  return typeof day.date === "string" && isNonNegativeInteger(day.contributionCount);
}

function isContributionCalendar(value: unknown): value is ContributionCalendar {
  if (typeof value !== "object" || value === null) return false;
  const calendar = value as Record<string, unknown>;
  if (!isNonNegativeInteger(calendar.totalContributions) || !Array.isArray(calendar.weeks)) return false;
  return calendar.weeks.every((week) => {
    if (typeof week !== "object" || week === null) return false;
    const days = (week as Record<string, unknown>).contributionDays;
    return Array.isArray(days) && days.every(isContributionDay);
  });
}

function requireUser<T extends { data?: { user?: unknown | null } }>(payload: T): NonNullable<NonNullable<T["data"]>["user"]> {
  const user = payload.data?.user;
  if (!user) throw new Error("GitHub user not found");
  return user as NonNullable<NonNullable<T["data"]>["user"]>;
}

async function fetchContributionYears(
  username: string,
  token: string,
  fetchImpl: typeof fetch,
): Promise<number[]> {
  const payload = (await requestGraphql(fetchImpl, token, "ContributionYears", contributionYearsQuery, { login: username })) as {
    data?: { user?: { contributionsCollection?: ContributionYears } | null };
  };
  const user = requireUser(payload);
  const years = user.contributionsCollection?.contributionYears;
  if (!isContributionYearList(years)) {
    throw new Error("GitHub GraphQL response missing contribution years");
  }
  return [...new Set(years)].sort((a, b) => b - a);
}

export async function fetchGithubProfileDetails(
  username: string,
  token: string,
  now: Date = new Date(),
  fetchImpl: typeof fetch = fetch,
): Promise<ProfileDetails> {
  const payload = (await requestGraphql(fetchImpl, token, "ProfileDetailsYears", profileDetailsYearsQuery, {
    login: username,
  })) as ProfileDetailsPayload;
  const user = requireUser(payload);
  const years = user.contributionsCollection?.contributionYears;
  const calendar = user.contributionsCollection?.contributionCalendar;
  if (!isContributionYearList(years) || !isContributionCalendar(calendar)) {
    throw new Error("GitHub GraphQL response missing contribution calendar");
  }
  if (
    typeof user.login !== "string" ||
    typeof user.createdAt !== "string" ||
    !user.repositories ||
    !isNonNegativeInteger(user.repositories.totalCount)
  ) {
    throw new Error("GitHub GraphQL response missing profile details");
  }

  const contributionDays: ContributionDay[] = calendar.weeks.flatMap((week) => week.contributionDays);
  contributionDays.sort((left, right) => left.date.localeCompare(right.date));
  const contact = typeof user.websiteUrl === "string" && user.websiteUrl
    ? user.websiteUrl
    : undefined;

  return {
    username: user.login,
    title: typeof user.name === "string" && user.name ? user.name : `@${user.login}`,
    totalContributions: calendar.totalContributions,
    publicRepositories: user.repositories.totalCount,
    joinedAt: user.createdAt,
    ...(contact ? { contact } : {}),
    contributionDays,
  };
}

function addLanguage(total: Map<string, LanguageTotal>, name: string, color: string | null, value: number): void {
  const existing = total.get(name);
  if (existing) {
    existing.value += value;
  } else {
    total.set(name, { name, color, value });
  }
}

function toLanguageBreakdown(total: Map<string, LanguageTotal>): LanguageBreakdown {
  const languages = [...total.values()].sort((left, right) => right.value - left.value);
  return {
    total: languages.reduce((sum, language) => sum + language.value, 0),
    languages,
  };
}

export async function fetchGithubRepoLanguages(
  username: string,
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<LanguageBreakdown> {
  const totals = new Map<string, LanguageTotal>();
  let after: string | null = null;
  const seenCursors = new Set<string>();

  while (true) {
    const payload = (await requestGraphql(fetchImpl, token, "RepositoryLanguages", repositoryLanguagesQuery, {
      login: username,
      after,
    })) as RepositoryLanguagePayload;
    const user = requireUser(payload);
    const repositories = user.repositories;
    if (!repositories || !Array.isArray(repositories.nodes) || typeof repositories.pageInfo !== "object" || repositories.pageInfo === null) {
      throw new Error("GitHub GraphQL response missing repository languages");
    }
    for (const repository of repositories.nodes) {
      if (repository.isPrivate !== false) continue;
      const language = repository.primaryLanguage;
      if (typeof language?.name === "string") {
        addLanguage(totals, language.name, typeof language.color === "string" ? language.color : null, 1);
      }
    }

    const pageInfo = repositories.pageInfo as { hasNextPage?: unknown; endCursor?: unknown };
    if (pageInfo.hasNextPage !== true) break;
    if (typeof pageInfo.endCursor !== "string" || !pageInfo.endCursor || seenCursors.has(pageInfo.endCursor)) {
      throw new Error("GitHub GraphQL response missing repository language cursor");
    }
    seenCursors.add(pageInfo.endCursor);
    after = pageInfo.endCursor;
  }

  return toLanguageBreakdown(totals);
}

async function fetchCommitLanguageYears(
  username: string,
  token: string,
  years: number[],
  now: Date,
  fetchImpl: typeof fetch,
): Promise<LanguageBreakdown> {
  const totals = new Map<string, LanguageTotal>();
  for (const year of years) {
    const payload = (await requestGraphql(fetchImpl, token, "CommitLanguagesByYear", commitLanguagesQuery, {
      login: username,
      ...yearVariables(year, now),
    })) as ContributionLanguagePayload;
    const user = requireUser(payload);
    const repositories = user.contributionsCollection?.commitContributionsByRepository;
    if (!Array.isArray(repositories)) throw new Error("GitHub GraphQL response missing commit languages");
    for (const repository of repositories) {
      if (repository.repository?.isPrivate !== false) continue;
      const count = repository.contributions?.totalCount;
      if (!isNonNegativeInteger(count)) continue;
      const language = repository.repository?.primaryLanguage;
      if (typeof language?.name !== "string") continue;
      addLanguage(
        totals,
        language.name,
        typeof language?.color === "string" ? language.color : null,
        count,
      );
    }
  }
  return toLanguageBreakdown(totals);
}

export async function fetchGithubCommitLanguages(
  username: string,
  token: string,
  now: Date = new Date(),
  fetchImpl: typeof fetch = fetch,
): Promise<LanguageBreakdown> {
  const years = await fetchContributionYears(username, token, fetchImpl);
  return fetchCommitLanguageYears(username, token, years, now, fetchImpl);
}

export async function fetchGithubProductiveTime(
  username: string,
  token: string,
  now: Date = new Date(),
  fetchImpl: typeof fetch = fetch,
  utcOffsetHours = 9,
): Promise<ProductiveTime> {
  const counts = Array.from({ length: 24 }, (_, hour) => ({ hour, contributions: 0 }));
  const userPayload = (await requestGraphql(fetchImpl, token, "ProductiveTimeUser", productiveTimeUserQuery, {
    login: username,
  })) as ProductiveTimeUserPayload;
  const user = requireUser(userPayload);
  if (typeof user.id !== "string" && typeof user.id !== "number") {
    throw new Error("GitHub GraphQL response missing productive time user");
  }

  const since = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();
  const payload = (await requestGraphql(fetchImpl, token, "ProductiveTime", productiveTimeQuery, {
    login: username,
    userId: String(user.id),
    since,
    until: now.toISOString(),
  })) as ProductiveTimePayload;
  const productiveUser = requireUser(payload);
  const repositories = productiveUser.contributionsCollection?.commitContributionsByRepository;
  if (!Array.isArray(repositories)) throw new Error("GitHub GraphQL response missing productive time");
  const addCommits = (history: ProductiveCommitHistory | undefined): void => {
    for (const node of history?.nodes ?? []) {
      if (typeof node.committedDate !== "string") continue;
      const committedAt = new Date(node.committedDate);
      if (Number.isNaN(committedAt.getTime())) continue;
      const hour = (committedAt.getUTCHours() + Math.trunc(utcOffsetHours) + 24) % 24;
      const bucket = counts[hour];
      if (bucket) bucket.contributions += 1;
    }
  };
  for (const repository of repositories) {
    const repositoryData = repository.repository;
    if (repositoryData?.isPrivate !== false) continue;
    const history = repositoryData?.defaultBranchRef?.target?.history;
    addCommits(history);

    let pageInfo = history?.pageInfo;
    const seenCursors = new Set<string>();
    while (pageInfo?.hasNextPage === true) {
      const fullName = repositoryData?.nameWithOwner;
      if (typeof fullName !== "string") {
        throw new Error("GitHub GraphQL response missing productive time repository");
      }
      const separator = fullName.indexOf("/");
      if (separator <= 0 || separator === fullName.length - 1) {
        throw new Error("GitHub GraphQL response missing productive time repository name");
      }
      const cursor = pageInfo.endCursor;
      if (typeof cursor !== "string" || !cursor || seenCursors.has(cursor)) {
        throw new Error("GitHub GraphQL response missing productive time cursor");
      }
      seenCursors.add(cursor);
      const pagePayload = (await requestGraphql(fetchImpl, token, "ProductiveTimeRepository", productiveTimeRepositoryQuery, {
        owner: fullName.slice(0, separator),
        name: fullName.slice(separator + 1),
        userId: String(user.id),
        since,
        until: now.toISOString(),
        after: cursor,
      })) as ProductiveTimeRepositoryPayload;
      const pageRepository = pagePayload.data?.repository;
      if (pageRepository?.isPrivate !== false) break;
      const pageHistory = pageRepository.defaultBranchRef?.target?.history;
      addCommits(pageHistory);
      pageInfo = pageHistory?.pageInfo;
    }
  }
  return {
    total: counts.reduce((sum, bucket) => sum + bucket.contributions, 0),
    hours: counts,
  };
}
