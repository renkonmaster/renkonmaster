import type { ProfileStats } from "../types.ts";

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
