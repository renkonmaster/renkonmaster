import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { writeGeneratedCard, writeGeneratedCards } from "../src/generate.ts";
import {
  getFixtureCommitLanguages,
  getFixtureProductiveTime,
  getFixtureProfileDetails,
  getFixtureRepoLanguages,
  getFixtureStats,
} from "../src/data/fixture.ts";

test("writeGeneratedCardはfixtureのSVGを指定ディレクトリへ書き込む", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "profile-card-test-"));

  try {
    const outputPath = await writeGeneratedCard(
      {
        dataSource: "fixture",
        username: "renkonmaster",
        token: undefined,
        outputDir,
      },
      {
        username: "renkonmaster",
        periodLabel: "All time",
        totalStars: 24,
        commits: 1284,
        pullRequests: 76,
        issues: 42,
        repositoriesContributed: 18,
      },
    );

    assert.equal(outputPath, join(outputDir, "profile-stats.svg"));
    const svg = await readFile(outputPath, "utf8");
    assert.match(svg, /^<svg/);
    assert.match(svg, /1,284/);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("writeGeneratedCardsは5種類のfixture SVGを同じ出力先へ書き込む", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "profile-cards-test-"));

  try {
    const paths = await writeGeneratedCards(
      {
        dataSource: "fixture",
        username: "renkonmaster",
        token: undefined,
        outputDir,
      },
      {
        stats: getFixtureStats("renkonmaster"),
        profileDetails: getFixtureProfileDetails("renkonmaster"),
        repoLanguages: getFixtureRepoLanguages("renkonmaster"),
        commitLanguages: getFixtureCommitLanguages("renkonmaster"),
        productiveTime: getFixtureProductiveTime("renkonmaster"),
      },
    );

    assert.deepEqual(paths.map((path) => path.split("/").pop()), [
      "profile-stats.svg",
      "profile-details.svg",
      "most-commit-language.svg",
      "repos-per-language.svg",
      "productive-time.svg",
    ]);
    for (const path of paths) {
      assert.match(await readFile(path, "utf8"), /^<svg/);
    }
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});
