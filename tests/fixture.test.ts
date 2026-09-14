import assert from "node:assert/strict";
import { test } from "node:test";

import { getFixtureStats } from "../src/data/fixture.ts";

test("fixtureは決定的な集計値を返す", () => {
  const stats = getFixtureStats("renkonmaster");

  assert.deepEqual(stats, {
    username: "renkonmaster",
    periodLabel: "All time",
    totalStars: 24,
    commits: 1284,
    pullRequests: 76,
    issues: 42,
    repositoriesContributed: 18,
  });
});

test("fixtureはユーザー名だけを差し替える", () => {
  const stats = getFixtureStats("example-user");

  assert.equal(stats.username, "example-user");
  assert.equal(stats.totalStars, 24);
  assert.equal(stats.commits, 1284);
  assert.equal(stats.pullRequests, 76);
  assert.equal(stats.issues, 42);
  assert.equal(stats.repositoriesContributed, 18);
});
