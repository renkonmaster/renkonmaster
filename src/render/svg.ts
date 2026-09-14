import type { ProfileStatsCardModel } from "../cards/profile-stats.ts";

const theme = {
  background: "#242938",
  title: "#82AAFF",
  text: "#27E8A7",
  icon: "#89DDFF",
  border: "#000000",
};

const CARD_WIDTH = 340;
const CARD_HEIGHT = 200;
const FONT_FAMILY = "Segoe UI, Ubuntu, Helvetica Neue, sans-serif";
const ICON_PATHS = [
  '<path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.209.612a.75.75 0 0 1 .416 1.279l-3.046 2.969.719 4.192a.75.75 0 0 1-1.088.791L8 12.346l-3.765 1.98a.75.75 0 0 1-1.088-.791l.719-4.192L.82 6.374a.75.75 0 0 1 .416-1.279l4.209-.612L7.327.668A.75.75 0 0 1 8 .25Z" />',
  '<path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm0 1.5a5 5 0 1 1 0 10A5 5 0 0 1 8 3Zm-.75 1.5h1.5v3.19l2.28 1.316-.75 1.299L7.25 8.56V4.5Z" />',
  '<path d="M3.25 1.5h3v1.5h-3v3h-1.5V3a1.5 1.5 0 0 1 1.5-1.5Zm9.5 0h-3v1.5h3v3h1.5V3a1.5 1.5 0 0 0-1.5-1.5Zm-9.5 13h3V13h-3v-3h-1.5v3a1.5 1.5 0 0 0 1.5 1.5Zm9.5 0h-3V13h3v-3h1.5v3a1.5 1.5 0 0 1-1.5 1.5Z" />',
  '<path d="M8 1.25a6.75 6.75 0 1 0 0 13.5A6.75 6.75 0 0 0 8 1.25Zm0 1.5a5.25 5.25 0 1 1 0 10.5A5.25 5.25 0 0 1 8 2.75ZM7.25 5h1.5v3h3v1.5h-4.5V5Z" />',
  '<path d="M1.5 2.25h13v11.5h-13V2.25Zm1.5 1.5v8.5h10v-8.5H3Zm1.5 1.5h7v1.5h-7v-1.5Zm0 3h7v1.5h-7v-1.5Z" />',
];
const GITHUB_LOGO_PATH = '<path fill-rule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.65 7.65 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />';

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
      const y = 74 + index * 25;
      const icon = ICON_PATHS[index] ?? '<circle cx="8" cy="8" r="5" />';
      return [
        `  <g transform="translate(30,${y - 14})" fill="${theme.icon}">${icon}</g>`,
        `  <text x="51" y="${y}" fill="${theme.text}" font-family="${FONT_FAMILY}" font-size="14">${escapeXml(row.label)}</text>`,
        `  <text x="160" y="${y}" fill="${theme.text}" font-family="${FONT_FAMILY}" font-size="14">${escapeXml(row.value)}</text>`,
      ].join("\n");
    })
    .join("\n");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">`,
    `  <rect x="1" y="1" width="${CARD_WIDTH - 2}" height="${CARD_HEIGHT - 2}" rx="5" fill="${theme.background}" stroke="${theme.border}" stroke-width="1" stroke-opacity="0" />`,
    `  <text x="30" y="40" fill="${theme.title}" font-family="${FONT_FAMILY}" font-size="22">${escapeXml(model.title)}</text>`,
    rows,
    `  <g transform="translate(220,60) scale(6)" fill="${theme.icon}">${GITHUB_LOGO_PATH}</g>`,
    "</svg>",
    "",
  ].join("\n");
}
