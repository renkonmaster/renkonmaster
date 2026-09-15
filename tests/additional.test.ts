import assert from "node:assert/strict";
import { test } from "node:test";

import { buildLanguageCard, buildProductiveTimeCard, buildProfileDetailsCard } from "../src/cards/additional.ts";
import {
  renderLanguageSvg,
  renderProductiveTimeSvg,
  renderProfileDetailsSvg,
} from "../src/render/additional.ts";
import {
  getFixtureCommitLanguages,
  getFixtureProductiveTime,
  getFixtureProfileDetails,
  getFixtureRepoLanguages,
} from "../src/data/fixture.ts";

test("Profile Detailsカードは情報とContributionグリッドをSVG化する", () => {
  const svg = renderProfileDetailsSvg(buildProfileDetailsCard(getFixtureProfileDetails("renkonmaster")));

  assert.match(svg, /width="600"/);
  assert.match(svg, /Contributions on GitHub/);
  assert.match(svg, /Public Repos/);
  assert.match(svg, /<rect/);
  assert.doesNotMatch(svg, /(?:href|xlink:href)=/);
});

test("言語カードは上位言語をドーナツと凡例でSVG化する", () => {
  const repoSvg = renderLanguageSvg(buildLanguageCard(getFixtureRepoLanguages("renkonmaster"), "Top Languages by Repo"));
  const commitSvg = renderLanguageSvg(buildLanguageCard(getFixtureCommitLanguages("renkonmaster"), "Top Languages by Commit"));

  assert.match(repoSvg, /Top Languages by Repo/);
  assert.match(commitSvg, /Top Languages by Commit/);
  assert.match(repoSvg, /stroke-dasharray=/);
  assert.match(repoSvg, /TypeScript/);
  assert.doesNotMatch(repoSvg, /<image/);
});

test("Productive Timeカードは24時間の集計をSVG化する", () => {
  const svg = renderProductiveTimeSvg(buildProductiveTimeCard(getFixtureProductiveTime("renkonmaster")));

  assert.match(svg, /Productive Time/);
  assert.match(svg, /24/);
  assert.match(svg, /<rect/);
  assert.match(svg, /23/);
});
