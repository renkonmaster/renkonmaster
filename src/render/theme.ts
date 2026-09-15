export const BLUEBERRY_THEME = {
  title: "#82aaff",
  text: "#27e8a7",
  background: "#242938",
  stroke: "#000000",
  strokeOpacity: 0,
  icon: "#89ddff",
  chart: "#82aaff",
} as const;

export const CARD_FONT = `'Segoe UI', Ubuntu, "Helvetica Neue", Sans-Serif`;

// Captured from github-profile-summary-cards at
// e722eded97059b31d7e8ad3ae0267b74ff24172d. Coordinates include the common
// 40px body offset when the object name says "Origin"; child coordinates stay
// relative to that origin, matching the upstream templates.
export const UPSTREAM_VISUAL_CONTRACT = {
  cards: {
    profileDetails: { width: 700, height: 200 },
    reposPerLanguage: { width: 340, height: 200 },
    mostCommitLanguage: { width: 340, height: 200 },
    stats: { width: 340, height: 200 },
    productiveTime: { width: 340, height: 200 },
  },
  card: {
    xPadding: 30,
    yPadding: 40,
    titleFontSize: 22,
    titleLineHeight: 24,
    bodyOffsetY: 40,
    borderInset: 1,
    borderRadius: 5,
    borderWidth: 1,
  },
  donut: {
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
  },
  profileDetails: {
    detailsOrigin: { x: 30, y: 70 },
    labelHeight: 14,
    labelStep: 28,
    textX: 21,
    textY: 14,
    chartOrigin: { x: 295, y: 50 },
    chartWidth: 380,
    chartHeight: 110,
    caption: { x: 230, y: -15 },
  },
  stats: {
    panelOrigin: { x: 30, y: 60 },
    labelHeight: 14,
    labelStep: 25.2,
    labelX: 21,
    valueX: 130,
    textY: 14,
    logoOrigin: { x: 220, y: 60 },
    logoScale: 6,
  },
  productiveTime: {
    chartOrigin: { x: 35, y: 60 },
    chartWidth: 280,
    chartHeight: 100,
    hourTicks: [0, 6, 12, 18, 23],
    caption: { x: 220, y: 130, fontSize: 10, text: "per day hour" },
  },
  numberFormatting: {
    statsAbbreviationPrecision: 1,
    profileDetailsAbbreviationPrecision: 2,
    utcOffsetFractionDigits: 2,
  },
} as const;

export function svgCardStart(width: number, height: number): string {
  const borderInset = UPSTREAM_VISUAL_CONTRACT.card.borderInset;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `  <style>* { font-family: ${CARD_FONT}; }</style>`,
    `  <rect x="${borderInset}" y="${borderInset}" width="${width - borderInset * 2}" height="${height - borderInset * 2}" rx="${UPSTREAM_VISUAL_CONTRACT.card.borderRadius}" ry="${UPSTREAM_VISUAL_CONTRACT.card.borderRadius}" fill="${BLUEBERRY_THEME.background}" stroke="${BLUEBERRY_THEME.stroke}" stroke-width="${UPSTREAM_VISUAL_CONTRACT.card.borderWidth}" stroke-opacity="${BLUEBERRY_THEME.strokeOpacity}" />`,
  ].join("\n");
}

export function svgCardEnd(): string {
  return "</svg>\n";
}
