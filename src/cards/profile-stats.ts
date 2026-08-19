import type { ProfileStats } from "../types.ts";

export type ProfileStatsCardModel = {
  title: string;
  periodLabel: string;
  rows: Array<{ label: string; value: string }>;
};

const numberFormatter = new Intl.NumberFormat("en-US");

export function buildProfileStatsCard(stats: ProfileStats): ProfileStatsCardModel {
  return {
    title: "Profile Stats",
    periodLabel: stats.periodLabel,
    rows: [
      { label: "Commits", value: numberFormatter.format(stats.commits) },
      { label: "Pull Requests", value: numberFormatter.format(stats.pullRequests) },
      { label: "Issues", value: numberFormatter.format(stats.issues) },
      { label: "Repositories", value: numberFormatter.format(stats.repositoriesContributed) },
    ],
  };
}
