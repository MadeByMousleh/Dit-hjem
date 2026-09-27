import type { HeatReading } from '../services/private-heating';

export type HeatPoint = { date: string; actual: number | null; expected: number | null };
export type HeatPeriod = 'year' | 'month' | 'day';
const DAY = 86400000;
// Never split a multi-day interval into invented daily measurements.
export function dailyHeatPoints(readings: HeatReading[]): HeatPoint[] {
  const rows = new Map<string, HeatPoint>();
  for (const row of readings) {
    const duration = Date.parse(row.to) - Date.parse(row.from);
    if (duration < 0 || duration > DAY || !Number.isFinite(duration)) continue;
    const point = { date: row.from, actual: row.kwh === null ? null : row.kwh * 0.0036, expected: row.expectedKwh == null ? null : row.expectedKwh * 0.0036 };
    // Ambiguous duplicate daily periods must not be double-counted.
    rows.set(row.from, rows.has(row.from) ? { date: row.from, actual: null, expected: null } : point);
  }
  return [...rows.values()].sort((a, b) => a.date.localeCompare(b.date));
}
export function heatChartPoints(readings: HeatReading[], period: HeatPeriod, anchor: string): HeatPoint[] {
  const daily = new Map(dailyHeatPoints(readings).map(point => [point.date, point]));
  const year = Number(anchor.slice(0, 4)), month = Number(anchor.slice(5, 7));
  const summarize = (date: string, rows: HeatPoint[]): HeatPoint => {
    const measured = rows.filter(point => point.actual !== null);
    // Compare expectations for exactly the same measured days, including partial years.
    return { date, actual: measured.length ? measured.reduce((sum, point) => sum + point.actual!, 0) : null,
      expected: measured.length && measured.every(point => point.expected !== null) ? measured.reduce((sum, point) => sum + point.expected!, 0) : null };
  };
  if (period === 'year') {
    const rows = [...daily.values()];
    const years = rows.map(point => Number(point.date.slice(0, 4)));
    const firstYear = years.length ? Math.min(...years) : year;
    const lastYear = years.length ? Math.max(...years) : year;
    return Array.from({ length: lastYear - firstYear + 1 }, (_, index) => {
      const date = String(firstYear + index);
      return summarize(date, rows.filter(point => point.date.startsWith(date + '-')));
    });
  }
  const first = period === 'month' ? `${year}-01-01` : `${year}-${String(month).padStart(2, '0')}-01`;
  const count = period === 'month' ? (Date.UTC(year + 1, 0, 1) - Date.UTC(year, 0, 1)) / DAY : new Date(Date.UTC(year, month, 0)).getUTCDate();
  const points = Array.from({ length: count }, (_, i) => {
    const date = new Date(Date.parse(first) + i * DAY).toISOString().slice(0, 10);
    return daily.get(date) ?? { date, actual: null, expected: null };
  });
  if (period === 'day') return points;
  return Array.from({ length: 12 }, (_, index) => {
    const date = `${year}-${String(index + 1).padStart(2, '0')}`;
    const rows = points.filter(point => point.date.startsWith(date));
    return summarize(date, rows);
  });
}
