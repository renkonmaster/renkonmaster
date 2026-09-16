import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { generateCards, writeGeneratedCard, writeGeneratedCards } from "../src/generate.ts";
import {
  getFixtureCommitLanguages,
  getFixtureProductiveTime,
  getFixtureProfileDetails,
  getFixtureRepoLanguages,
  getFixtureStats,
} from "../src/data/fixture.ts";

for (const scenario of [
  { name: "broader scope", token: "ghp_controlled-token", scopes: "repo" },
  { name: "unverifiable scopes", token: "ghp_controlled-token", scopes: undefined },
  { name: "fine-grained token", token: "github_pat_controlled-token", scopes: "" },
]) {
  test(`generateCards blocks ${scenario.name} before aggregate GraphQL calls`, async (t) => {
    const outputDir = await mkdtemp(join(tmpdir(), "profile-cards-preflight-test-"));
    const graphqlRequests: string[] = [];
    t.mock.method(globalThis, "fetch", async (url: string | URL | Request) => {
      if (String(url) === "https://api.github.com/graphql") graphqlRequests.push(String(url));
      return new Response(JSON.stringify({ data: { viewer: { id: "user-id" } } }), {
        headers: scenario.scopes === undefined ? {} : { "X-OAuth-Scopes": scenario.scopes },
      });
    });
    try {
      await assert.rejects(generateCards({ dataSource: "github", username: "example", token: scenario.token, outputDir }),
        /classic PAT with no OAuth scopes/);
      assert.deepEqual(graphqlRequests, []);
      assert.deepEqual(await readdir(outputDir), []);
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });
}

test("generateCards verifies an empty-scope classic PAT before public aggregation", async (t) => {
  const outputDir = await mkdtemp(join(tmpdir(), "profile-cards-public-test-"));
  let verified = false;
  const operations: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url) === "https://api.github.com/user") {
      verified = true;
      return new Response("", { headers: { "X-OAuth-Scopes": "" } });
    }
    assert(verified, "REST scope verification must finish before any GraphQL operation");
    const { query } = JSON.parse(String(init?.body));
    operations.push(query.match(/query (\w+)/)[1]);
    return new Response(JSON.stringify({ data: { user: {
      id: "user-id", login: "example", name: "Example", createdAt: "2020-01-01T00:00:00Z",
      email: "", websiteUrl: "",
      contributionsCollection: {
        contributionYears: [],
        contributionCalendar: { totalContributions: 0, weeks: [] },
        commitContributionsByRepository: [],
      },
      repositoriesContributedTo: { totalCount: 0 }, pullRequests: { totalCount: 0 }, issues: { totalCount: 0 },
      repositories: { totalCount: 0, nodes: [], pageInfo: { hasNextPage: false, endCursor: null } },
    } } }));
  });
  try {
    const paths = await generateCards({ dataSource: "github", username: "example", token: "ghp_controlled-token", outputDir });
    assert.equal(paths.length, 5);
    assert.deepEqual(operations.sort(), ["ContributionYears", "ProductiveTime", "ProductiveTimeUser", "ProfileDetailsYears", "ProfileStats", "RepositoryLanguages"]);
    for (const path of paths) assert.match(await readFile(path, "utf8"), /^<svg/);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

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
