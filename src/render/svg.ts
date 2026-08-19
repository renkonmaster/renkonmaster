import type { ProfileStatsCardModel } from "../cards/profile-stats.ts";

const theme = {
  background: "#1e1e2e",
  foreground: "#cdd6f4",
  muted: "#a6adc8",
  accent: "#89b4fa",
  panel: "#313244",
};

export function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function renderProfileStatsSvg(model: ProfileStatsCardModel): string {
  const rows = model.rows
    .map((row, index) => {
      const y = 82 + index * 22;
      return [
        `  <rect x="20" y="${y}" width="480" height="18" rx="7" fill="${theme.panel}" />`,
        `  <text x="34" y="${y + 13}" fill="${theme.muted}" font-size="11">${escapeXml(row.label)}</text>`,
        `  <text x="486" y="${y + 13}" fill="${theme.accent}" font-size="12" font-weight="700" text-anchor="end">${escapeXml(row.value)}</text>`,
      ].join("\n");
    })
    .join("\n");

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="520" height="180" viewBox="0 0 520 180">',
    `  <rect width="520" height="180" rx="16" fill="${theme.background}" />`,
    `  <rect x="1" y="1" width="518" height="178" rx="15" fill="none" stroke="${theme.accent}" stroke-opacity="0.45" />`,
    `  <text x="24" y="32" fill="${theme.foreground}" font-size="20" font-weight="700">${escapeXml(model.title)}</text>`,
    `  <text x="496" y="29" fill="${theme.muted}" font-size="10" text-anchor="end">${escapeXml(model.periodLabel)}</text>`,
    rows,
    "</svg>",
    "",
  ].join("\n");
}
