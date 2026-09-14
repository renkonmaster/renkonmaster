import type { ProfileStats } from "../types.ts";

export type ProfileStatsCardModel = {
  title: string;
  periodLabel: string;
  rows: Array<{ label: string; value: string }>;
};

const numberFormatter = new Intl.NumberFormat("en-US");

export function buildProfileStatsCard(stats: ProfileStats): ProfileStatsCardModel {
  return {
    title: "Stats",
    periodLabel: stats.periodLabel,
    rows: [
      { label: "Total Stars:", value: numberFormatter.format(stats.totalStars) },
      { label: "Total Commits:", value: numberFormatter.format(stats.commits) },
      { label: "Total PRs:", value: numberFormatter.format(stats.pullRequests) },
      { label: "Total Issues:", value: numberFormatter.format(stats.issues) },
      { label: "Contributed to:", value: numberFormatter.format(stats.repositoriesContributed) },
    ],
  };
}
