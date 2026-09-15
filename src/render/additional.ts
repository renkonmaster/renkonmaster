import type {
  LanguageCardModel,
  ProductiveTimeCardModel,
  ProfileDetailsCardModel,
} from "../cards/additional.ts";
import { escapeXml } from "./svg.ts";

const theme = {
  background: "#242938",
  title: "#82AAFF",
  text: "#27E8A7",
  icon: "#89DDFF",
  muted: "#D9E0EE",
};

const FONT = "Segoe UI, Ubuntu, Helvetica Neue, sans-serif";
const LANGUAGE_COLORS = ["#82AAFF", "#27E8A7", "#89DDFF", "#C792EA", "#F78C6C"];

function svgStart(width: number, height: number): string[] {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `  <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="5" fill="${theme.background}" />`,
  ];
}

function svgEnd(): string {
  return "</svg>\n";
}

export function renderProfileDetailsSvg(model: ProfileDetailsCardModel): string {
  const width = 600;
  const height = 220;
  const lines = svgStart(width, height);
  lines.push(
    `  <text x="25" y="35" fill="${theme.title}" font-family="${FONT}" font-size="20" font-weight="700">${escapeXml(model.title)}</text>`,
    `  <text x="25" y="58" fill="${theme.muted}" font-family="${FONT}" font-size="12">${escapeXml(model.username)}</text>`,
    `  <text x="25" y="92" fill="${theme.text}" font-family="${FONT}" font-size="13">${escapeXml(String(model.totalContributions))} Contributions on GitHub</text>`,
    `  <text x="25" y="117" fill="${theme.text}" font-family="${FONT}" font-size="13">${escapeXml(String(model.publicRepositories))} Public Repos</text>`,
    `  <text x="25" y="142" fill="${theme.text}" font-family="${FONT}" font-size="13">Joined GitHub ${escapeXml(model.joinedAt)}</text>`,
  );
  if (model.contact) {
    lines.push(`  <text x="25" y="167" fill="${theme.text}" font-family="${FONT}" font-size="13">${escapeXml(model.contact)}</text>`);
  }

  const startX = 315;
  const startY = 75;
  const cell = 9;
  const gap = 2;
  const days = [...model.contributionDays].slice(-196);
  const max = Math.max(1, ...days.map((day) => day.contributionCount));
  days.forEach((day, index) => {
    const x = startX + (index % 14) * (cell + gap);
    const y = startY + Math.floor(index / 14) * (cell + gap);
    const intensity = day.contributionCount / max;
    const fill = intensity === 0 ? "#31384D" : `rgba(39,232,167,${0.25 + intensity * 0.75})`;
    lines.push(`  <rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${fill}"><title>${escapeXml(day.date)}: ${day.contributionCount}</title></rect>`);
  });
  lines.push(svgEnd());
  return lines.join("\n");
}

export function renderLanguageSvg(model: LanguageCardModel): string {
  const width = 420;
  const height = 200;
  const lines = svgStart(width, height);
  lines.push(`  <text x="25" y="35" fill="${theme.title}" font-family="${FONT}" font-size="20" font-weight="700">${escapeXml(model.title)}</text>`);

  const total = Math.max(1, model.total);
  const cx = 105;
  const cy = 112;
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  lines.push(`  <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="#31384D" stroke-width="22" />`);
  model.languages.slice(0, 5).forEach((language, index) => {
    const length = (language.value / total) * circumference;
    const color = language.color ?? LANGUAGE_COLORS[index % LANGUAGE_COLORS.length] ?? theme.icon;
    lines.push(`  <circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${escapeXml(color)}" stroke-width="22" stroke-dasharray="${length} ${circumference - length}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})" />`);
    offset += length;
  });
  lines.push(`  <text x="${cx}" y="${cy + 5}" fill="${theme.muted}" font-family="${FONT}" font-size="16" text-anchor="middle">${model.languages.length}</text>`);

  model.languages.slice(0, 5).forEach((language, index) => {
    const y = 72 + index * 23;
    const color = language.color ?? LANGUAGE_COLORS[index % LANGUAGE_COLORS.length] ?? theme.icon;
    lines.push(`  <circle cx="220" cy="${y - 4}" r="5" fill="${escapeXml(color)}" />`);
    lines.push(`  <text x="234" y="${y}" fill="${theme.text}" font-family="${FONT}" font-size="13">${escapeXml(language.name)}</text>`);
    lines.push(`  <text x="390" y="${y}" fill="${theme.muted}" font-family="${FONT}" font-size="12" text-anchor="end">${language.value}</text>`);
  });
  lines.push(svgEnd());
  return lines.join("\n");
}

export function renderProductiveTimeSvg(model: ProductiveTimeCardModel): string {
  const width = 520;
  const height = 200;
  const lines = svgStart(width, height);
  lines.push(`  <text x="25" y="35" fill="${theme.title}" font-family="${FONT}" font-size="20" font-weight="700">Productive Time</text>`);
  lines.push(`  <text x="25" y="58" fill="${theme.muted}" font-family="${FONT}" font-size="12">${model.total} contributions by hour</text>`);
  const max = Math.max(1, ...model.hours.map((bucket) => bucket.contributions));
  model.hours.slice(0, 24).forEach((bucket, index) => {
    const x = 25 + index * 20;
    const barHeight = Math.max(2, (bucket.contributions / max) * 100);
    const y = 160 - barHeight;
    const fill = bucket.contributions === 0 ? "#31384D" : `rgba(39,232,167,${0.25 + (bucket.contributions / max) * 0.75})`;
    lines.push(`  <rect x="${x}" y="${y.toFixed(2)}" width="14" height="${barHeight.toFixed(2)}" rx="2" fill="${fill}"><title>${bucket.hour}:00 — ${bucket.contributions}</title></rect>`);
    lines.push(`  <text x="${x + 7}" y="177" fill="${theme.muted}" font-family="${FONT}" font-size="8" text-anchor="middle">${bucket.hour}</text>`);
  });
  lines.push(svgEnd());
  return lines.join("\n");
}
