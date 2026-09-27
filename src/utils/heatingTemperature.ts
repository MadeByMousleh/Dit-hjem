import type { HeatReading } from '../services/private-heating';

export type TemperaturePeriod = 'month' | 'day';
export type TemperaturePoint = { date: string; flowC: number | null; returnC: number | null };
const DAY = 86400000;

export function dailyTemperaturePoints(readings: HeatReading[]): TemperaturePoint[] {
  const days = new Map<string, TemperaturePoint>();
  for (const row of readings) {
    const duration = Date.parse(row.to) - Date.parse(row.from);
    if (!Number.isFinite(duration) || duration < 0 || duration > DAY) continue;
    const valid = (value: number | null | undefined) => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 150 ? value : null;
    const point = { date: row.from, flowC: valid(row.flowC), returnC: valid(row.returnC) };
    // Conflicting duplicate days must not create a misleading temperature.
    days.set(row.from, days.has(row.from) ? { date: row.from, flowC: null, returnC: null } : point);
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function temperatureChartPoints(readings: HeatReading[], period: TemperaturePeriod, anchor: string): TemperaturePoint[] {
  const days = dailyTemperaturePoints(readings);
  const year = Number(anchor.slice(0, 4));
  const month = Number(anchor.slice(5, 7));
  if (period === 'day') {
    const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const byDate = new Map(days.map(point => [point.date, point]));
    return Array.from({ length: count }, (_, index) => {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`;
      return byDate.get(date) ?? { date, flowC: null, returnC: null };
    });
  }
  return Array.from({ length: 12 }, (_, index) => {
    const date = `${year}-${String(index + 1).padStart(2, '0')}`;
    const complete = days.filter(point => point.date.startsWith(date + '-') && point.flowC !== null && point.returnC !== null);
    return { date, flowC: complete.length ? complete.reduce((sum, point) => sum + point.flowC!, 0) / complete.length : null,
      returnC: complete.length ? complete.reduce((sum, point) => sum + point.returnC!, 0) / complete.length : null };
  });
}
