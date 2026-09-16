import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, join } from "node:path";

import { buildProfileStatsCard } from "./cards/profile-stats.ts";
import {
  buildLanguageCard,
  buildProductiveTimeCard,
  buildProfileDetailsCard,
} from "./cards/additional.ts";
import { loadConfig } from "./config.ts";
import {
  getFixtureCommitLanguages,
  getFixtureProductiveTime,
  getFixtureProfileDetails,
  getFixtureRepoLanguages,
  getFixtureStats,
} from "./data/fixture.ts";
import {
  fetchGithubCommitLanguages,
  fetchGithubProductiveTime,
  fetchGithubProfileDetails,
  fetchGithubRepoLanguages,
  fetchGithubStats,
} from "./data/github.ts";
import { renderProfileStatsSvg } from "./render/svg.ts";
import { renderLanguageSvg } from "./render/language.ts";
import { renderProductiveTimeSvg } from "./render/productive-time.ts";
import { renderProfileDetailsSvg } from "./render/profile-details.ts";
import type {
  GeneratorConfig,
  LanguageBreakdown,
  ProductiveTime,
  ProfileDetails,
  ProfileStats,
} from "./types.ts";

export type ProfileCardsData = {
  stats: ProfileStats;
  profileDetails: ProfileDetails;
  repoLanguages: LanguageBreakdown;
  commitLanguages: LanguageBreakdown;
  productiveTime: ProductiveTime;
};

export async function writeGeneratedCard(config: GeneratorConfig, stats: ProfileStats): Promise<string> {
  await mkdir(config.outputDir, { recursive: true });
  const outputPath = join(config.outputDir, "profile-stats.svg");
  const model = buildProfileStatsCard(stats);
  const svg = renderProfileStatsSvg(model);

  await writeFile(outputPath, svg, "utf8");
  return outputPath;
}

export async function writeGeneratedCards(config: GeneratorConfig, data: ProfileCardsData): Promise<string[]> {
  await mkdir(config.outputDir, { recursive: true });
  const generated = [
    ["profile-stats.svg", renderProfileStatsSvg(buildProfileStatsCard(data.stats))],
    ["profile-details.svg", renderProfileDetailsSvg(buildProfileDetailsCard(data.profileDetails))],
    ["most-commit-language.svg", renderLanguageSvg(buildLanguageCard(data.commitLanguages, "Top Languages by Commit"))],
    ["repos-per-language.svg", renderLanguageSvg(buildLanguageCard(data.repoLanguages, "Top Languages by Repo"))],
    ["productive-time.svg", renderProductiveTimeSvg(buildProductiveTimeCard(data.productiveTime))],
  ] as const;

  const outputPaths: string[] = [];
  for (const [filename, svg] of generated) {
    const outputPath = join(config.outputDir, filename);
    await writeFile(outputPath, svg, "utf8");
    outputPaths.push(outputPath);
  }
  return outputPaths;
}

export async function generateCards(config: GeneratorConfig): Promise<string[]> {
  let data: ProfileCardsData;
  if (config.dataSource === "fixture") {
    data = {
      stats: getFixtureStats(config.username),
      profileDetails: getFixtureProfileDetails(config.username),
      repoLanguages: getFixtureRepoLanguages(config.username),
      commitLanguages: getFixtureCommitLanguages(config.username),
      productiveTime: getFixtureProductiveTime(config.username),
    };
  } else {
    if (!config.token) {
      throw new Error("GITHUB_TOKEN is required for GitHub data generation");
    }
    const [stats, profileDetails, repoLanguages, commitLanguages, productiveTime] = await Promise.all([
      fetchGithubStats(config.username, config.token),
      fetchGithubProfileDetails(config.username, config.token),
      fetchGithubRepoLanguages(config.username, config.token),
      fetchGithubCommitLanguages(config.username, config.token),
      fetchGithubProductiveTime(config.username, config.token),
    ]);
    data = { stats, profileDetails, repoLanguages, commitLanguages, productiveTime };
  }

  return writeGeneratedCards(config, data);
}

async function main(): Promise<void> {
  const outputPaths = await generateCards(loadConfig());
  for (const outputPath of outputPaths) {
    console.log(`Generated ${outputPath}`);
  }
}

const entrypoint = process.argv[1] ? resolve(process.argv[1]) : undefined;
if (entrypoint === fileURLToPath(import.meta.url)) {
  await main();
}
