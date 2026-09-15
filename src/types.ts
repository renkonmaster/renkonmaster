export type DataSource = "fixture" | "github";

export type ProfileStats = {
  username: string;
  periodLabel: string;
  totalStars: number;
  commits: number;
  pullRequests: number;
  issues: number;
  repositoriesContributed: number;
};

export type ContributionDay = {
  date: string;
  contributionCount: number;
};

export type ProfileDetails = {
  username: string;
  title: string;
  totalContributions: number;
  publicRepositories: number;
  joinedAt: string;
  contact?: string;
  contributionDays: ContributionDay[];
};

export type LanguageTotal = {
  name: string;
  color: string | null;
  value: number;
};

export type LanguageBreakdown = {
  total: number;
  languages: LanguageTotal[];
};

export type HourBucket = {
  hour: number;
  contributions: number;
};

export type ProductiveTime = {
  total: number;
  hours: HourBucket[];
};

export type GeneratorConfig = {
  dataSource: DataSource;
  username: string;
  token: string | undefined;
  outputDir: string;
};
