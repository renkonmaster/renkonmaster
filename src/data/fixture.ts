import type { ProfileStats } from "../types.ts";

export function getFixtureStats(username: string): ProfileStats {
  return {
    username,
    periodLabel: "Last 12 months",
    commits: 1284,
    pullRequests: 76,
    issues: 42,
    repositoriesContributed: 18,
  };
}
