export type DataSource = "fixture" | "github";

export type ProfileStats = {
  username: string;
  periodLabel: string;
  commits: number;
  pullRequests: number;
  issues: number;
  repositoriesContributed: number;
};

export type GeneratorConfig = {
  dataSource: DataSource;
  username: string;
  token: string | undefined;
  outputDir: string;
};
