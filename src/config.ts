import "dotenv/config";

import type { DataSource, GeneratorConfig } from "./types.ts";

const DEFAULT_USERNAME = "renkonmaster";
const DEFAULT_OUTPUT_DIR = "generated";

export function loadConfig(env: NodeJS.ProcessEnv = process.env): GeneratorConfig {
  const username = env.GITHUB_USERNAME?.trim() || DEFAULT_USERNAME;
  const token = env.GITHUB_TOKEN?.trim() || undefined;
  const outputDir = env.OUTPUT_DIR?.trim() || DEFAULT_OUTPUT_DIR;
  const requestedSource = env.DATA_SOURCE?.trim();

  if (requestedSource && requestedSource !== "fixture" && requestedSource !== "github") {
    throw new Error(`DATA_SOURCE must be "fixture" or "github", got "${requestedSource}"`);
  }

  const dataSource: DataSource =
    requestedSource === "fixture" || requestedSource === "github"
      ? requestedSource
      : token
        ? "github"
        : "fixture";

  if (dataSource === "github" && !token) {
    throw new Error("GITHUB_TOKEN is required when DATA_SOURCE=github");
  }

  return {
    dataSource,
    username,
    token: dataSource === "github" ? token : undefined,
    outputDir,
  };
}
