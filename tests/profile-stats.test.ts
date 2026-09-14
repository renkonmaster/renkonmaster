import assert from "node:assert/strict";
import { test } from "node:test";

import { buildProfileStatsCard } from "../src/cards/profile-stats.ts";

test("ProfileStatsを5行のカードモデルへ変換する", () => {
  const model = buildProfileStatsCard({
    username: "renkonmaster",
    periodLabel: "All time",
    totalStars: 24,
    commits: 1284,
    pullRequests: 76,
    issues: 42,
    repositoriesContributed: 18,
  });

  assert.deepEqual(model, {
    title: "Stats",
    periodLabel: "All time",
    rows: [
      { label: "Total Stars:", value: "24" },
      { label: "Total Commits:", value: "1,284" },
      { label: "Total PRs:", value: "76" },
      { label: "Total Issues:", value: "42" },
      { label: "Contributed to:", value: "18" },
    ],
  });
});
