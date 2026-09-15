import type { LanguageBreakdown, ProfileDetails, ProductiveTime } from "../types.ts";

export type ProfileDetailsCardModel = ProfileDetails;
export type LanguageCardModel = LanguageBreakdown & { title: string };
export type ProductiveTimeCardModel = ProductiveTime;

export function buildProfileDetailsCard(data: ProfileDetails): ProfileDetailsCardModel {
  return data;
}

export function buildLanguageCard(data: LanguageBreakdown, title: string): LanguageCardModel {
  return { ...data, title };
}

export function buildProductiveTimeCard(data: ProductiveTime): ProductiveTimeCardModel {
  return data;
}
