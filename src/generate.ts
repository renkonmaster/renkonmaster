import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, join } from "node:path";

import { buildProfileStatsCard } from "./cards/profile-stats.ts";
import { loadConfig } from "./config.ts";
import { getFixtureStats } from "./data/fixture.ts";
import { fetchGithubStats } from "./data/github.ts";
import { renderProfileStatsSvg } from "./render/svg.ts";
import type { GeneratorConfig, ProfileStats } from "./types.ts";

export async function writeGeneratedCard(config: GeneratorConfig, stats: ProfileStats): Promise<string> {
  await mkdir(config.outputDir, { recursive: true });
  const outputPath = join(config.outputDir, "profile-stats.svg");
  const model = buildProfileStatsCard(stats);
  const svg = renderProfileStatsSvg(model);

  await writeFile(outputPath, svg, "utf8");
  return outputPath;
}

export async function generateCards(config: GeneratorConfig): Promise<string> {
  let stats: ProfileStats;
  if (config.dataSource === "fixture") {
    stats = getFixtureStats(config.username);
  } else {
    if (!config.token) {
      throw new Error("GITHUB_TOKEN is required for GitHub data generation");
    }
    stats = await fetchGithubStats(config.username, config.token);
  }

  return writeGeneratedCard(config, stats);
}

async function main(): Promise<void> {
  const outputPath = await generateCards(loadConfig());
  console.log(`Generated ${outputPath}`);
}

const entrypoint = process.argv[1] ? resolve(process.argv[1]) : undefined;
if (entrypoint === fileURLToPath(import.meta.url)) {
  await main();
}
