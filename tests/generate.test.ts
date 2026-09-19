import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { generateCards, writeGeneratedCard } from "../src/generate.ts";

const cardContracts = [
  { filename: "profile-stats.svg", width: 340, title: "Stats" },
  { filename: "profile-details.svg", width: 700, title: "@renkonmaster" },
  { filename: "most-commit-language.svg", width: 340, title: "Top Languages by Commit" },
  { filename: "repos-per-language.svg", width: 340, title: "Top Languages by Repo" },
  { filename: "productive-time.svg", width: 340, title: "Commits (UTC +9.00)" },
] as const;

type CardContract = { filename: string; width: number; title?: string };

function assertCardContract(svg: string, { width, title }: CardContract): void {
  assert.match(svg, new RegExp(`^<svg\\b[^>]*width="${width}"[^>]*height="200"[^>]*viewBox="0 0 ${width} 200"[^>]*>`));
  if (title !== undefined) {
    assert(svg.includes(`>${title}</text>`), `missing card title: ${title}`);
  } else {
    assert.match(svg, /<text x="30" y="40"[^>]*>[^<]+<\/text>/, "missing non-empty profile title");
  }
  assert.match(svg, /<\/svg>\s*$/);
  assert.doesNotMatch(svg, /\b(?:NaN|Infinity)\b/);
  // Plain URL text and the SVG namespace are fine; fetched resources are not.
  assert.doesNotMatch(svg, /<(?:image|script|foreignObject)\b|\b(?:href|src)\s*=|@import|url\(\s*["']?(?!#)[^\s"')]/i);
}

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

test("generateCards writes exactly five self-contained fixture cards at upstream dimensions", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "profile-cards-test-"));

  try {
    const paths = await generateCards(
      {
        dataSource: "fixture",
        username: "renkonmaster",
        token: undefined,
        outputDir,
      },
    );

    assert.deepEqual(paths, cardContracts.map(({ filename }) => join(outputDir, filename)));
    assert.deepEqual((await readdir(outputDir)).sort(), cardContracts.map(({ filename }) => filename).sort());
    for (const contract of cardContracts) {
      assertCardContract(await readFile(join(outputDir, contract.filename), "utf8"), contract);
    }
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

const committedCardContracts: readonly CardContract[] = cardContracts.map((contract) =>
  contract.filename === "profile-details.svg" ? { filename: contract.filename, width: contract.width } : contract,
);

for (const contract of committedCardContracts) {
  test(`committed ${contract.filename} preserves the generated card contract`, async () => {
    assertCardContract(await readFile(new URL(`../generated/${contract.filename}`, import.meta.url), "utf8"), contract);
  });
}
