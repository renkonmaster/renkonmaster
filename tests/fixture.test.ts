import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getFixtureCommitLanguages,
  getFixtureProductiveTime,
  getFixtureProfileDetails,
  getFixtureRepoLanguages,
  getFixtureStats,
} from "../src/data/fixture.ts";

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

test("プロフィール詳細fixtureはカレンダーを含む決定的な集計値を返す", () => {
  assert.deepEqual(getFixtureProfileDetails("example-user"), {
    username: "example-user",
    title: "@example-user",
    totalContributions: 14,
    publicRepositories: 32,
    joinedAt: "2016-02-27T00:00:00.000Z",
    contact: "https://github.com/example-user",
    contributionDays: [
      { date: "2026-08-17", contributionCount: 3 },
      { date: "2026-08-18", contributionCount: 7 },
      { date: "2026-08-19", contributionCount: 4 },
    ],
  });
});

test("言語fixtureはリポジトリbyte数とcommit数を別々に返す", () => {
  assert.deepEqual(getFixtureRepoLanguages("example-user"), {
    total: 32,
    languages: [
      { name: "TypeScript", color: "#3178c6", value: 18 },
      { name: "Go", color: "#00ADD8", value: 9 },
      { name: "Shell", color: "#89e051", value: 5 },
    ],
  });
  assert.deepEqual(getFixtureCommitLanguages("example-user"), {
    total: 1164,
    languages: [
      { name: "TypeScript", color: "#3178c6", value: 720 },
      { name: "Go", color: "#00ADD8", value: 444 },
    ],
  });
});

test("productive-time fixtureは24時間を欠損なく返す", () => {
  const productiveTime = getFixtureProductiveTime("example-user");

  assert.equal(productiveTime.hours.length, 24);
  assert.deepEqual(productiveTime.hours.slice(8, 12), [
    { hour: 8, contributions: 84 },
    { hour: 9, contributions: 128 },
    { hour: 10, contributions: 96 },
    { hour: 11, contributions: 72 },
  ]);
  assert.equal(
    productiveTime.total,
    productiveTime.hours.reduce((sum, bucket) => sum + bucket.contributions, 0),
  );
});
