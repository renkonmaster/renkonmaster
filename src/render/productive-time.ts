import type { ProductiveTimeCardModel } from "../cards/additional.ts";
import { coordinate, cardTitle, chartScale, verticalAxis } from "./chart.ts";
import { BLUEBERRY_THEME as theme, UPSTREAM_VISUAL_CONTRACT as layout, svgCardStart, svgCardEnd } from "./theme.ts";

export function renderProductiveTimeSvg(model: ProductiveTimeCardModel): string {
  const { width, height } = layout.cards.productiveTime;
  const { chartOrigin, chartWidth, chartHeight, hourTicks, caption } = layout.productiveTime;
  const hours = Array.from({ length: 24 }, (_, hour) => model.hours.find(bucket => bucket.hour === hour)?.contributions ?? 0);
  const scale = chartScale(Math.max(...hours), chartHeight, 5);
  // d3.scaleBand().padding(0.1): both outer margins and inner gaps are 0.1 steps.
  const step = chartWidth / 24.1;
  const barWidth = step * 0.9;
  const start = step * 0.1;
  const axisX = barWidth - step;
  const lines = [
    svgCardStart(width, height),
    cardTitle(`Commits (UTC +${(9).toFixed(layout.numberFormatting.utcOffsetFractionDigits)})`),
    `<g transform="translate(${chartOrigin.x},${chartOrigin.y})" color="${theme.chart}">`,
    `<g transform="translate(0,${chartHeight})" color="${theme.text}" fill="none" font-size="10" text-anchor="middle">`,
    `<path class="domain" stroke="currentColor" d="M${coordinate(axisX)},0.5H${chartWidth}.5" />`,
    ...hourTicks.map(hour => `<g class="tick" transform="translate(${coordinate(start + hour * step + barWidth / 2)},0)"><line stroke="currentColor" y2="6" /><text fill="currentColor" y="9" dy="0.71em">${hour}</text></g>`),
    `</g>`,
    `<g transform="translate(${coordinate(axisX)},0)" color="${theme.text}" fill="none" font-size="10" text-anchor="end">`,
    verticalAxis(scale, chartHeight, "left"),
    `</g>`,
  ];
  hours.forEach((value, hour) => {
    const y = scale.y(value);
    lines.push(`<rect class="bar" data-hour="${hour}" fill="${theme.chart}" x="${coordinate(start + hour * step)}" y="${coordinate(y)}" width="${coordinate(barWidth)}" height="${coordinate(chartHeight - y)}" />`);
  });
  return [...lines, `<text x="${caption.x}" y="${caption.y}" fill="${theme.text}" font-size="${caption.fontSize}">${caption.text}</text>`, `</g>`, svgCardEnd()].join("\n");
}
