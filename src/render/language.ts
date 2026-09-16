import type { LanguageCardModel } from "../cards/additional.ts";
import { coordinate, cardTitle } from "./chart.ts";
import { escapeXml } from "./svg.ts";
import { BLUEBERRY_THEME as theme, UPSTREAM_VISUAL_CONTRACT as layout, svgCardStart, svgCardEnd } from "./theme.ts";

function donutArc(start: number, end: number): string {
  const { outerRadius: outer, innerRadius: inner } = layout.donut;
  const point = (radius: number, angle: number) => `${coordinate(radius * Math.sin(angle))},${coordinate(-radius * Math.cos(angle))}`;
  if (end - start >= Math.PI * 2 - 1e-10) {
    return `M0,-${outer}A${outer},${outer},0,1,1,0,${outer}A${outer},${outer},0,1,1,0,-${outer}M0,-${inner}A${inner},${inner},0,1,0,0,${inner}A${inner},${inner},0,1,0,0,-${inner}Z`;
  }
  if (end === start) return `M${point(outer, start)}L${point(inner, start)}Z`;
  const large = end - start >= Math.PI ? 1 : 0;
  return `M${point(outer, start)}A${outer},${outer},0,${large},1,${point(outer, end)}L${point(inner, end)}A${inner},${inner},0,${large},0,${point(inner, start)}Z`;
}

export function renderLanguageSvg(model: LanguageCardModel): string {
  const languages = [...model.languages].sort((a, b) => b.value - a.value).slice(0, 5).map(language => ({
    ...language,
    // GitHub language colors are RGB hex. Reject SVG paint URLs to keep the
    // rendered image self-contained even when a caller supplies another value.
    color: /^#[0-9a-f]{6}$/i.test(language.color ?? "") ? language.color! : "#586e75",
  }));
  if (languages.length === 0) languages.push(
    { name: "There are no", value: 1, color: "#586e75" },
    { name: model.title === "Top Languages by Repo" ? "repos to show" : "commits to show", value: 1, color: "#586e75" },
  );
  const { width, height } = layout.cards.reposPerLanguage;
  const { legendOrigin, chartCenter, labelHeight, labelStep, swatchY, textX, textY } = layout.donut;
  const lines = [svgCardStart(width, height), cardTitle(model.title), `<g transform="translate(${legendOrigin.x},${legendOrigin.y})">`];
  languages.forEach((language, index) => {
    const color = escapeXml(language.color || "#586e75");
    lines.push(
      `<rect y="${coordinate(swatchY + index * labelStep)}" width="${labelHeight}" height="${labelHeight}" fill="${color}" stroke="${theme.background}" stroke-width="1" />`,
      `<text x="${textX}" y="${coordinate(textY + index * labelStep)}" fill="${theme.text}" font-size="${labelHeight}">${escapeXml(language.name)}</text>`,
    );
  });
  lines.push(`</g>`, `<g transform="translate(${chartCenter.x},${chartCenter.y})">`);
  const total = languages.reduce((sum, language) => sum + Math.max(0, language.value), 0);
  let start = 0;
  languages.forEach(language => {
    const end = start + (total > 0 ? Math.max(0, language.value) / total * Math.PI * 2 : 0);
    lines.push(`<g class="arc"><path d="${donutArc(start, end)}" fill="${escapeXml(language.color || "#586e75")}" stroke="${theme.background}" stroke-width="2" /></g>`);
    start = end;
  });
  return [...lines, `</g>`, svgCardEnd()].join("\n");
}
