import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { buildProfileStatsCard } from "../src/cards/profile-stats.ts";
import { getFixtureStats } from "../src/data/fixture.ts";
import { renderProfileStatsSvg } from "../src/render/svg.ts";
import { buildProfileDetailsCard } from "../src/cards/additional.ts";
import { getFixtureProfileDetails } from "../src/data/fixture.ts";
import { renderProfileDetailsSvg } from "../src/render/profile-details.ts";
import { renderProductiveTimeSvg } from "../src/render/productive-time.ts";
import {
  BLUEBERRY_THEME,
  CARD_FONT,
  UPSTREAM_VISUAL_CONTRACT,
  svgCardEnd,
  svgCardStart,
} from "../src/render/theme.ts";

test("blueberryテーマは上流の全7色属性を保つ", () => {
  assert.deepEqual(BLUEBERRY_THEME, {
    title: "#82aaff",
    text: "#27e8a7",
    background: "#242938",
    stroke: "#000000",
    strokeOpacity: 0,
    icon: "#89ddff",
    chart: "#82aaff",
  });
  assert.equal(CARD_FONT, `'Segoe UI', Ubuntu, "Helvetica Neue", Sans-Serif`);
});

test("5カードの基準寸法と共通タイトル位置を保つ", () => {
  assert.deepEqual(UPSTREAM_VISUAL_CONTRACT.cards, {
    profileDetails: { width: 700, height: 200 },
    reposPerLanguage: { width: 340, height: 200 },
    mostCommitLanguage: { width: 340, height: 200 },
    stats: { width: 340, height: 200 },
    productiveTime: { width: 340, height: 200 },
  });
  assert.deepEqual(UPSTREAM_VISUAL_CONTRACT.card, {
    xPadding: 30,
    yPadding: 40,
    titleFontSize: 22,
    titleLineHeight: 24,
    bodyOffsetY: 40,
    borderInset: 1,
    borderRadius: 5,
    borderWidth: 1,
  });
  assert.deepEqual(UPSTREAM_VISUAL_CONTRACT.variants, {
    statsHiddenLogoWidth: 250,
    profileDetailsAdditionalTitleLineHeight: 24,
    profileDetailsTallTitleLengthThreshold: 30,
    profileDetailsTallTitleCaptionY: 140,
  });
});

test("ドーナツカードは上流の半径と凡例座標を保つ", () => {
  assert.deepEqual(UPSTREAM_VISUAL_CONTRACT.donut, {
    margin: 10,
    radius: 70,
    outerRadius: 60,
    innerRadius: 35,
    chartCenter: { x: 230, y: 120 },
    legendOrigin: { x: 40, y: 40 },
    labelHeight: 14,
    labelStep: 25.2,
    swatchY: 18,
    textX: 16.8,
    textY: 30,
  });
});

test("詳細・Stats・Productive Timeの基準ラベル位置を保つ", () => {
  assert.deepEqual(UPSTREAM_VISUAL_CONTRACT.profileDetails, {
    detailsOrigin: { x: 30, y: 70 },
    labelHeight: 14,
    labelStep: 28,
    textX: 21,
    textY: 14,
    chartOrigin: { x: 295, y: 50 },
    chartWidth: 380,
    chartHeight: 110,
    caption: { x: 230, y: -15 },
  });
  assert.deepEqual(UPSTREAM_VISUAL_CONTRACT.stats, {
    panelOrigin: { x: 30, y: 60 },
    labelHeight: 14,
    labelStep: 25.2,
    labelX: 21,
    valueX: 130,
    textY: 14,
    logoOrigin: { x: 220, y: 60 },
    logoScale: 6,
  });
  assert.deepEqual(UPSTREAM_VISUAL_CONTRACT.productiveTime, {
    chartOrigin: { x: 35, y: 60 },
    chartWidth: 280,
    chartHeight: 100,
    hourTicks: [0, 6, 12, 18, 23],
    caption: { x: 220, y: 130, fontSize: 10, text: "per day hour" },
  });
});

test("上流の数値精度と既存Stats fixtureの桁区切りを記録する", () => {
  assert.deepEqual(UPSTREAM_VISUAL_CONTRACT.numberFormatting, {
    statsAbbreviationPrecision: 1,
    profileDetailsAbbreviationPrecision: 2,
    utcOffsetFractionDigits: 2,
  });

  const model = buildProfileStatsCard({
    username: "octocat",
    periodLabel: "All time",
    totalStars: 24,
    commits: 1284,
    pullRequests: 76,
    issues: 42,
    repositoriesContributed: 18,
  });
  assert.equal(model.rows[1]?.value, "1,284");
});

test("共通カードシェルは自己完結したSVGを作る", () => {
  const svg = `${svgCardStart(340, 200)}\n${svgCardEnd()}`;

  assert.equal(
    svg,
    `<svg xmlns="http://www.w3.org/2000/svg" width="340" height="200" viewBox="0 0 340 200">\n` +
      `  <style>* { font-family: ${CARD_FONT}; }</style>\n` +
      `  <rect x="1" y="1" width="338" height="198" rx="5" ry="5" fill="#242938" stroke="#000000" stroke-width="1" stroke-opacity="0" />\n` +
      `</svg>\n`,
  );
  assert.doesNotMatch(svg, /(?:href|xlink:href|<image|<script)/);
});

test("Stats rendererはfixture SVGをbyte-for-byte維持する", () => {
  const expected = readFileSync(new URL("../generated/profile-stats.svg", import.meta.url), "utf8");
  const actual = renderProfileStatsSvg(buildProfileStatsCard(getFixtureStats("renkonmaster")));

  assert.equal(actual, expected);
});

test("詳細の省略数値は上流の小文字kと2桁のゼロ埋めを保つ", () => {
  const model = buildProfileDetailsCard({
    ...getFixtureProfileDetails("numbers"), totalContributions: 1200, publicRepositories: 1000000000,
  }, new Date("2026-09-15T00:00:00Z"));
  const svg = renderProfileDetailsSvg(model);
  assert.match(svg, />1\.20k Contributions on GitHub<\/text>/);
  assert.match(svg, />1\.00G Public Repos<\/text>/);
});

test("少ないコミットの小数軸は上流の目盛り精度でゼロも表示する", () => {
  const svg = renderProductiveTimeSvg({total: 1, hours: [{hour: 0, contributions: 1}]});
  assert.match(svg, />0\.0<\/text>/);
  assert.match(svg, />0\.2<\/text>/);
  assert.match(svg, />1\.0<\/text>/);
});
