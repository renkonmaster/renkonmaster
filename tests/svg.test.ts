import assert from "node:assert/strict";
import { test } from "node:test";

import { renderProfileStatsSvg } from "../src/render/svg.ts";

test("Profile Stats SVGは固定サイズとメトリクスを含む", () => {
  const svg = renderProfileStatsSvg({
    title: "Profile Stats",
    periodLabel: "Last 12 months",
    rows: [
      { label: "Commits", value: "1,284" },
      { label: "Pull Requests", value: "76" },
      { label: "Issues", value: "42" },
      { label: "Repositories", value: "18" },
    ],
  });

  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /width="520"/);
  assert.match(svg, /height="180"/);
  assert.match(svg, /viewBox="0 0 520 180"/);
  assert.match(svg, /<rect/);
  assert.match(svg, /<text/);
  assert.match(svg, /1,284/);
  assert.match(svg, /Pull Requests/);
});

test("SVGテキストのXML特殊文字をエスケープする", () => {
  const svg = renderProfileStatsSvg({
    title: `A & <card> " '`,
    periodLabel: "Last 12 months",
    rows: [{ label: "A & <metric>", value: `1 " 2` }],
  });

  assert.match(svg, /A &amp; &lt;card&gt; &quot; &apos;/);
  assert.match(svg, /A &amp; &lt;metric&gt;/);
  assert.match(svg, /1 &quot; 2/);
  assert.doesNotMatch(svg, /A & <card>/);
});
