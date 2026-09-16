import assert from "node:assert/strict";
import { test } from "node:test";

import { buildLanguageCard, buildProductiveTimeCard, buildProfileDetailsCard } from "../src/cards/additional.ts";
import { renderLanguageSvg } from "../src/render/language.ts";
import { renderProductiveTimeSvg } from "../src/render/productive-time.ts";
import { renderProfileDetailsSvg } from "../src/render/profile-details.ts";
import {
  getFixtureCommitLanguages,
  getFixtureProductiveTime,
  getFixtureProfileDetails,
  getFixtureRepoLanguages,
} from "../src/data/fixture.ts";

test("Profile Detailsは上流の700pxカードと月別面グラフを描く", () => {
  const svg = renderProfileDetailsSvg(buildProfileDetailsCard(getFixtureProfileDetails("renkonmaster")));

  assert.match(svg, /width="700" height="200" viewBox="0 0 700 200"/);
  assert.match(svg, /Contributions on GitHub/);
  assert.match(svg, /Public Repos/);
  assert.match(svg, /transform="translate\(30,70\)"/);
  assert.match(svg, /transform="translate\(295,50\)"/);
  assert.match(svg, /class="contribution-area"[^>]*d="M190,0L190,110Z"/);
  assert.match(svg, />26\/08<\/text>/);
  assert.match(svg, /x="230" y="-15"[^>]*>contributions in the last year/);
  assert.doesNotMatch(svg, /(?:href|xlink:href)=/);
});

test("言語カードは上流の340pxカードで左に凡例、右に半径60と35のドーナツを描く", () => {
  const repoSvg = renderLanguageSvg(buildLanguageCard(getFixtureRepoLanguages("renkonmaster"), "Top Languages by Repo"));
  const commitSvg = renderLanguageSvg(buildLanguageCard(getFixtureCommitLanguages("renkonmaster"), "Top Languages by Commit"));

  assert.match(repoSvg, /Top Languages by Repo/);
  assert.match(commitSvg, /Top Languages by Commit/);
  for (const svg of [repoSvg, commitSvg]) {
    assert.match(svg, /width="340" height="200" viewBox="0 0 340 200"/);
    assert.match(svg, /x="30" y="40"[^>]*font-size="22"/);
    assert.match(svg, /transform="translate\(40,40\)"/);
    assert.match(svg, /transform="translate\(230,120\)"/);
    assert.match(svg, /A60,60,0,1,1/);
    assert.match(svg, /A35,35,0,1,0/);
    assert.match(svg, /x="16.8" y="30"[^>]*>TypeScript<\/text>/);
    assert.doesNotMatch(svg, /(?:href|xlink:href|<image|<script|stroke-dasharray|%)/);
  }
  assert.match(repoSvg, /TypeScript/);
  assert.doesNotMatch(repoSvg, /<image/);
});

test("Productive Timeは上流のUTC +9.00タイトルと24列の軸付き棒グラフを描く", () => {
  const svg = renderProductiveTimeSvg(buildProductiveTimeCard(getFixtureProductiveTime("renkonmaster")));

  assert.match(svg, /width="340" height="200" viewBox="0 0 340 200"/);
  assert.match(svg, />Commits \(UTC \+9.00\)<\/text>/);
  assert.match(svg, /transform="translate\(35,60\)"/);
  assert.equal([...svg.matchAll(/class="bar"/g)].length, 24);
  assert.match(svg, /class="bar" data-hour="9"[^>]*y="1.538"[^>]*height="98.462"/);
  for (const hour of [0, 6, 12, 18, 23]) assert.match(svg, new RegExp(`>${hour}</text>`));
  assert.match(svg, /x="220" y="130"[^>]*>per day hour<\/text>/);
  assert.doesNotMatch(svg, /(?:href|xlink:href|<image|<script|NaN|Infinity)/);
});

test("言語は値の降順の上位5件だけで円全体を埋め、入力を変更しない", () => {
  const model = buildLanguageCard({ total: 1000, languages: [
    { name: "sixth", value: 1, color: null },
    { name: "first", value: 10, color: "#123456" },
    { name: "second", value: 9, color: null },
    { name: "third", value: 8, color: null },
    { name: "fourth", value: 7, color: null },
    { name: "fifth", value: 6, color: null },
  ] }, "Top Languages by Repo");
  const before = structuredClone(model);
  const svg = renderLanguageSvg(model);
  assert.deepEqual(model, before);
  assert.equal([...svg.matchAll(/class="arc"/g)].length, 5);
  assert.doesNotMatch(svg, /sixth/);
  assert.match(svg, /d="M0,-60A60,60,0,0,1,60,0L35,0A35,35,0,0,0,0,-35Z"/);
  assert.match(svg, /x="16.8" y="30"[^>]*>first<\/text>/);
});

test("空の言語は上流のプレースホルダーを描き単一言語は完全なリングになる", () => {
  for (const [title, label] of [["Top Languages by Repo", "repos to show"], ["Top Languages by Commit", "commits to show"]]) {
    const svg = renderLanguageSvg(buildLanguageCard({ total: 0, languages: [] }, title!));
    assert.match(svg, />There are no<\/text>/);
    assert.ok(svg.includes(`>${label}</text>`));
    assert.equal([...svg.matchAll(/class="arc"/g)].length, 2);
  }
  const svg = renderLanguageSvg(buildLanguageCard({ total: 1, languages: [{name: "Only", color: null, value: 1}] }, "Top Languages by Repo"));
  assert.match(svg, /A60,60,0,1,1,0,60A60,60,0,1,1,0,-60/);
  assert.doesNotMatch(svg, /(?:NaN|Infinity)/);
});

test("Profile Detailsは日別データを月別集計して時系列に描く", () => {
  const model = buildProfileDetailsCard({...getFixtureProfileDetails("renkonmaster"), contributionDays: [
    { date: "2026-03-01", contributionCount: 10 },
    { date: "2026-01-02", contributionCount: 3 },
    { date: "2026-02-02", contributionCount: 5 },
    { date: "2026-01-01", contributionCount: 7 },
  ]});
  const before = structuredClone(model);
  const svg = renderProfileDetailsSvg(model);
  assert.deepEqual(model, before);
  assert.match(svg, /class="contribution-area"[^>]*d="M0,0C/);
  assert.match(svg, />26\/01<\/text>/);
  assert.match(svg, />26\/03<\/text>/);
  assert.doesNotMatch(svg, />26\/02<\/text>/);
});

test("月別の貢献が全ゼロなら面の上下端を同じ55pxにして塗り面を作らない", () => {
  const model = buildProfileDetailsCard({
    ...getFixtureProfileDetails("zero"),
    totalContributions: 0,
    contributionDays: [
      { date: "2026-01-01", contributionCount: 0 },
      { date: "2026-02-01", contributionCount: 0 },
    ],
  }, new Date("2026-09-15T00:00:00Z"));
  const svg = renderProfileDetailsSvg(model);
  const area = svg.match(/class="contribution-area"[^>]*d="([^"]+)"/)?.[1];

  assert.equal(area, "M0,55L380,55L380,55L0,55Z");
});

test("空とゼロのデータも有限の自己完結したSVGになる", () => {
  const svgs = [
    renderProfileDetailsSvg(buildProfileDetailsCard({...getFixtureProfileDetails("empty"), contributionDays: []})),
    renderProductiveTimeSvg({total: 0, hours: Array.from({length: 24}, (_, hour) => ({hour, contributions: 0}))}),
    renderLanguageSvg({title: "Top Languages by Repo", total: 0, languages: [{name: "Zero", color: null, value: 0}]}),
  ];
  for (const svg of svgs) assert.doesNotMatch(svg, /(?:NaN|Infinity|undefined|href=|<image|<script)/);
  // Pinned upstream uses d3's midpoint when the entire y-domain is [0, 0].
  assert.match(svgs[1]!, /class="bar" data-hour="0"[^>]*y="50"[^>]*height="50"/);
});

test("ユーザー文字列をエスケープし複数行タイトルの高さと本文を調整する", () => {
  const svg = renderProfileDetailsSvg(buildProfileDetailsCard({...getFixtureProfileDetails("safe"), title: "<one>\n&two", contact: '<image href="https://example.com"/>'}));
  assert.match(svg, /height="224" viewBox="0 0 700 224"/);
  assert.match(svg, /x="30" y="64"[^>]*>&amp;two<\/text>/);
  assert.match(svg, /transform="translate\(30,94\)"/);
  assert.match(svg, /x="230" y="140"/);
  assert.match(svg, /&lt;image href=&quot;/);
  assert.doesNotMatch(svg, /<image/);
  const language = renderLanguageSvg({title: "<&", total: 1, languages: [{name: "<&", color: '#fff" onload="bad', value: 1}]});
  assert.match(language, /&lt;&amp;/);
  assert.doesNotMatch(language, /" onload="/);
  const externalColor = renderLanguageSvg({title: "Color", total: 1, languages: [{name: "Safe", color: "url(https://example.com/fill.svg)", value: 1}]});
  assert.doesNotMatch(externalColor, /url\(|https:\/\/example/);
  assert.match(externalColor, /fill="#586e75"/);
});

test("加入からの経過時間は明示した現在日時から上流の単位と単複形で表示する", () => {
  for (const [joinedAt, expected] of [
    ["2016-02-27T00:00:00Z", "10 years ago"],
    ["2025-09-15T00:00:00Z", "1 year ago"],
    ["2026-08-15T00:00:00Z", "1 month ago"],
    ["2026-09-14T00:00:00Z", "1 day ago"],
    ["2026-09-15T00:00:00Z", "0 days ago"],
  ]) {
    const model = buildProfileDetailsCard({...getFixtureProfileDetails("age"), joinedAt: joinedAt!}, new Date("2026-09-15T00:00:00Z"));
    assert.ok(renderProfileDetailsSvg(model).includes(`Joined GitHub ${expected}</text>`));
  }
});
