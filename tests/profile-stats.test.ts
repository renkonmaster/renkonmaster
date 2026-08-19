import assert from "node:assert/strict";
import { test } from "node:test";

import { buildProfileStatsCard } from "../src/cards/profile-stats.ts";

test("ProfileStatsを4行のカードモデルへ変換する", () => {
  const model = buildProfileStatsCard({
    username: "renkonmaster",
    periodLabel: "Last 12 months",
    commits: 1284,
    pullRequests: 76,
    issues: 42,
    repositoriesContributed: 18,
  });

  assert.deepEqual(model, {
    title: "Profile Stats",
    periodLabel: "Last 12 months",
    rows: [
      { label: "Commits", value: "1,284" },
      { label: "Pull Requests", value: "76" },
      { label: "Issues", value: "42" },
      { label: "Repositories", value: "18" },
    ],
  });
});
