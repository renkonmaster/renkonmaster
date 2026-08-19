import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { writeGeneratedCard } from "../src/generate.ts";

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
        periodLabel: "Last 12 months",
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
