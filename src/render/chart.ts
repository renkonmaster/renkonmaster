import { escapeXml } from "./svg.ts";
import { BLUEBERRY_THEME, UPSTREAM_VISUAL_CONTRACT } from "./theme.ts";

// SVG geometry is rounded like modern d3-path, avoiding platform-dependent
// floating point tails while keeping subpixel differences below 0.001px.
export function coordinate(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

export function cardTitle(title: string): string {
  const { xPadding, yPadding, titleFontSize, titleLineHeight } = UPSTREAM_VISUAL_CONTRACT.card;
  return title.split("\n").map((line, index) =>
    `<text x="${xPadding}" y="${yPadding + index * titleLineHeight}" fill="${BLUEBERRY_THEME.title}" font-size="${titleFontSize}">${escapeXml(line)}</text>`,
  ).join("\n");
}

// The same 1/2/5/10 tick spacing and default ten-tick domain expansion used by
// d3.scaleLinear().nice(). The axis can request a different number of ticks.
function tickStep(max: number, count: number): number {
  const raw = max / count;
  const power = 10 ** Math.floor(Math.log10(raw));
  const error = raw / power;
  return power * (error >= Math.sqrt(50) ? 10 : error >= Math.sqrt(10) ? 5 : error >= Math.sqrt(2) ? 2 : 1);
}

export function chartScale(max: number, height: number, tickCount: number) {
  // d3 returns the range midpoint for a collapsed [0, 0] domain.
  if (max === 0) return { y: (_value: number) => height / 2, ticks: [0] };
  let top = max;
  for (let index = 0; index < 10; index++) {
    const step = tickStep(top, 10);
    const next = Math.ceil(top / step) * step;
    if (next === top) break;
    top = next;
  }
  const step = tickStep(top, tickCount);
  const ticks = Array.from({ length: Math.floor(top / step + 1e-9) + 1 }, (_, index) => Number((index * step).toPrecision(12)));
  return { y: (value: number) => height * (1 - value / top), ticks };
}

export function verticalAxis(scale: ReturnType<typeof chartScale>, height: number, side: "left" | "right"): string {
  const direction = side === "left" ? -1 : 1;
  const step = scale.ticks.length > 1 ? scale.ticks[1]! - scale.ticks[0]! : 1;
  const precision = Math.max(0, -Math.floor(Math.log10(step)));
  return [
    `<path class="domain" stroke="currentColor" d="M${direction * 6},${height + 0.5}H0.5V0.5H${direction * 6}" />`,
    ...scale.ticks.map(value => `<g class="tick" transform="translate(0,${coordinate(scale.y(value) + 0.5)})"><line stroke="currentColor" x2="${direction * 6}" /><text fill="currentColor" x="${direction * 9}" dy="0.32em">${value.toLocaleString("en-US", { minimumFractionDigits: precision, maximumFractionDigits: precision })}</text></g>`),
  ].join("\n");
}
