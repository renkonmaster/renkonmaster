import type { LanguageBreakdown, ProfileDetails, ProductiveTime } from "../types.ts";

export type ProfileDetailsCardModel = ProfileDetails & { joinedLabel: string };
export type LanguageCardModel = LanguageBreakdown & { title: string };
export type ProductiveTimeCardModel = ProductiveTime;

export function buildProfileDetailsCard(data: ProfileDetails, now = new Date()): ProfileDetailsCardModel {
  const elapsed = new Date(Math.max(0, now.getTime() - new Date(data.joinedAt).getTime()));
  const years = elapsed.getUTCFullYear() - 1970;
  const months = elapsed.getUTCMonth();
  const days = elapsed.getUTCDate() - 1;
  const [count, unit] = years ? [years, "year"] : months ? [months, "month"] : [days, "day"];
  return { ...data, joinedLabel: `${count} ${unit}${count === 1 ? "" : "s"} ago` };
}

export function buildLanguageCard(data: LanguageBreakdown, title: string): LanguageCardModel {
  return { ...data, title };
}

export function buildProductiveTimeCard(data: ProductiveTime): ProductiveTimeCardModel {
  return data;
}
