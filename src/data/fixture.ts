import type {
  LanguageBreakdown,
  ProductiveTime,
  ProfileDetails,
  ProfileStats,
} from "../types.ts";

export function getFixtureStats(username: string): ProfileStats {
  return {
    username,
    periodLabel: "All time",
    totalStars: 24,
    commits: 1284,
    pullRequests: 76,
    issues: 42,
    repositoriesContributed: 18,
  };
}

export function getFixtureProfileDetails(username: string): ProfileDetails {
  return {
    username,
    title: `@${username}`,
    totalContributions: 14,
    publicRepositories: 32,
    joinedAt: "2016-02-27T00:00:00.000Z",
    contact: `https://github.com/${username}`,
    contributionDays: [
      { date: "2026-08-17", contributionCount: 3 },
      { date: "2026-08-18", contributionCount: 7 },
      { date: "2026-08-19", contributionCount: 4 },
    ],
  };
}

export function getFixtureRepoLanguages(_username: string): LanguageBreakdown {
  return {
    total: 32,
    languages: [
      { name: "TypeScript", color: "#3178c6", value: 18 },
      { name: "Go", color: "#00ADD8", value: 9 },
      { name: "Shell", color: "#89e051", value: 5 },
    ],
  };
}

export function getFixtureCommitLanguages(_username: string): LanguageBreakdown {
  return {
    total: 1164,
    languages: [
      { name: "TypeScript", color: "#3178c6", value: 720 },
      { name: "Go", color: "#00ADD8", value: 444 },
    ],
  };
}

export function getFixtureProductiveTime(_username: string): ProductiveTime {
  const contributions = [4, 2, 1, 0, 0, 1, 12, 30, 84, 128, 96, 72, 64, 58, 49, 43, 34, 31, 28, 19, 15, 12, 8, 5];
  const hours = contributions.map((count, hour) => ({ hour, contributions: count }));
  return {
    total: contributions.reduce((sum, count) => sum + count, 0),
    hours,
  };
}
