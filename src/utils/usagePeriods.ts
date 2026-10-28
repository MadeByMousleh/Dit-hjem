import { UsageAggregation, UsageSelection } from "../services/eloverblik";

const dateFormatter = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Copenhagen", year: "numeric", month: "2-digit", day: "2-digit" });
export const usageToday = (now = Date.now()) => dateFormatter.format(new Date(now));
export function usagePeriod(aggregation: UsageAggregation, anchor: string, availableYears: number[] = []): UsageSelection {
  if (aggregation === 'Year') {
    const currentYear = Number(usageToday().slice(0, 4));
    const years = availableYears.filter(year => Number.isInteger(year) && year <= currentYear);
    const firstYear = years.length ? Math.min(...years) : currentYear - 5;
    return { from: `${firstYear}-01-01`, to: `${currentYear + 1}-01-01`, aggregation };
  }
  const date = new Date(anchor + "T12:00:00Z");
  if (aggregation === "Month") date.setUTCMonth(0, 1);
  if (aggregation === "Day") date.setUTCDate(1);
  const from = date.toISOString().slice(0, 10);
  if (aggregation === "Month") date.setUTCFullYear(date.getUTCFullYear() + 1);
  else if (aggregation === "Day") date.setUTCMonth(date.getUTCMonth() + 1);
  else date.setUTCDate(date.getUTCDate() + 1);
  return { from, to: date.toISOString().slice(0, 10), aggregation };
}
export function moveUsagePeriod(aggregation: UsageAggregation, anchor: string, step: number) {
  const date = new Date(usagePeriod(aggregation, anchor).from + "T12:00:00Z");
  if (aggregation === "Year" || aggregation === "Month") date.setUTCFullYear(date.getUTCFullYear() + step);
  else if (aggregation === "Day") date.setUTCMonth(date.getUTCMonth() + step);
  else date.setUTCDate(date.getUTCDate() + step);
  return date.toISOString().slice(0, 10);
}
