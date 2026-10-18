import type { ElectricityUsage } from '../services/eloverblik';
import type { PricePoint } from '../prices';
import { usageToday } from './usagePeriods';

export const electricityWidgetIds = ['latest', 'month', 'price', 'cheapest', 'budget', 'priceChart', 'usageChart', 'heatChart'] as const;
export type ElectricityWidgetId = typeof electricityWidgetIds[number];
export type WidgetPins = { dashboard: ElectricityWidgetId[]; electricity: ElectricityWidgetId[] };
export const emptyWidgetPins = (): WidgetPins => ({ dashboard: [], electricity: [] });
export function parseWidgetPins(raw: string | null): WidgetPins {
  const value = raw ? JSON.parse(raw) : {};
  const valid = (items: unknown): ElectricityWidgetId[] => Array.isArray(items)
    ? [...new Set(items.filter((id): id is ElectricityWidgetId => electricityWidgetIds.includes(id)))] : [];
  return { dashboard: valid(value?.dashboard), electricity: valid(value?.electricity) };
}
export function widgetUsageSummary(current: ElectricityUsage | null, previous: ElectricityUsage | null, now: number) {
  const today = usageToday(now), month = today.slice(0, 7);
  const complete = (usage: ElectricityUsage | null) => usage?.meterCount && usage.aggregation === 'Day'
    ? usage.points.filter(p => p.kwh !== null && Number.isFinite(p.kwh) && !p.incomplete && usageToday(Date.parse(p.at)) < today) : [];
  const days = complete(current).filter(p => usageToday(Date.parse(p.at)).startsWith(month));
  const latest = [...complete(previous), ...days].sort((a, b) => b.at.localeCompare(a.at))[0] ?? null;
  const byDate = new Map(days.map(p => [usageToday(Date.parse(p.at)), p]));
  const through = days.length ? [...byDate.keys()].sort().at(-1)! : null;
  const count = through ? Number(through.slice(-2)) : 0;
  const contiguous = count > 0 && Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`).every(date => byDate.has(date));
  const total = days.reduce((sum, p) => sum + p.kwh!, 0);
  const monthDays = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).getUTCDate();
  return { latest, days, through, total, contiguous, forecastKwh: contiguous ? total / count * monthDays : null };
}

const shiftDay = (day: string, offset: number) => {
  const value = new Date(`${day}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
};
export function widgetWeekSummary(current: ElectricityUsage | null, previous: ElectricityUsage | null, now: number) {
  const today = usageToday(now);
  const readings = new Map<string, number>();
  for (const source of [previous, current]) {
    if (source?.aggregation !== 'Day' || !source.meterCount) continue;
    for (const point of source.points) {
      if (!Number.isFinite(Date.parse(point.at))) continue;
      const day = usageToday(Date.parse(point.at));
      if (day < today && point.kwh !== null && Number.isFinite(point.kwh) && !point.incomplete) readings.set(day, point.kwh);
    }
  }
  const end = [...readings.keys()].sort().at(-1);
  if (!end) return { days: [], previousDays: [], total: null, previousTotal: null, change: null };
  const window = (offset: number) => Array.from({ length: 7 }, (_, index) => {
    const day = shiftDay(end, offset + index - 6);
    return { day, kwh: readings.get(day) ?? null };
  });
  const days = window(0), previousDays = window(-7);
  const sum = (items: typeof days) => items.every(item => item.kwh !== null) ? items.reduce((total, item) => total + item.kwh!, 0) : null;
  const total = sum(days);
  const sameMeters = !current?.meterCount || !previous?.meterCount || current.meterCount === previous.meterCount;
  const previousTotal = sameMeters ? sum(previousDays) : null;
  const change = total !== null && previousTotal !== null && previousTotal > 0 ? (total - previousTotal) / previousTotal * 100 : null;
  return { days, previousDays, total, previousTotal, change };
}

// Relative to the complete local price day, never an absolute cheap-price promise.
export function widgetPriceStatus(prices: PricePoint[], now: number) {
  const today = usageToday(now), tomorrow = shiftDay(today, 1);
  const points = prices.filter(point => Number.isFinite(point.totalOrePerKwh) && usageToday(+point.startsAt) === today).sort((a, b) => +a.startsAt - +b.startsAt);
  if (!points.length) return null;
  const interval = points.some(point => point.startsAt.getUTCMinutes() !== 0) ? 900000 : 3600000;
  const first = +points[0]!.startsAt, end = +points.at(-1)!.startsAt + interval;
  if (usageToday(first - 1) === today || usageToday(end) !== tomorrow || usageToday(end - 1) !== today || points.some((point, i) => i > 0 && +point.startsAt !== +points[i - 1]!.startsAt + interval)) return null;
  const current = points.find(point => +point.startsAt <= now && now < +point.startsAt + interval);
  if (!current) return null;
  const min = Math.min(...points.map(point => point.totalOrePerKwh)), max = Math.max(...points.map(point => point.totalOrePerKwh));
  const fraction = max === min ? .5 : (current.totalOrePerKwh - min) / (max - min);
  return { level: fraction < 1 / 3 ? 'low' : fraction > 2 / 3 ? 'high' : 'medium', current, interval, flat: max === min } as const;
}

export function widgetShortcut(id: ElectricityWidgetId, anchor?: string) {
  return id === 'budget' ? { tab: 'profile' as const, section: 'budget' as const, anchor }
    : ['price', 'cheapest', 'priceChart'].includes(id) ? { tab: 'electricity' as const, section: 'prices' as const, anchor }
    : { tab: 'electricity' as const, section: 'usage' as const, anchor, aggregation: id === 'latest' ? 'Hour' as const : 'Day' as const };
}

// Only complete, contiguous future hours are candidates. Missing prices are
// never bridged; a single cheap quarter-hour is not presented as a cheap hour.
export function cheapestWidgetHour(prices: PricePoint[], now: number) {
  const horizon = now + 24 * 3600000;
  const sorted = prices.filter(p => Number.isFinite(p.totalOrePerKwh)).sort((a, b) => +a.startsAt - +b.startsAt);
  const interval = sorted.some(p => p.startsAt.getUTCMinutes() % 60 !== 0) ? 900000 : 3600000;
  const byTime = new Map(sorted.map(p => [+p.startsAt, p]));
  let best: { start: number; end: number; ore: number } | null = null;
  for (const p of sorted) {
    const start = +p.startsAt;
    if (start < now || start + 3600000 > horizon) continue;
    const window = Array.from({ length: 3600000 / interval }, (_, i) => byTime.get(start + i * interval));
    if (window.some(point => !point)) continue;
    const ore = window.reduce((sum, point) => sum + point!.totalOrePerKwh, 0) / window.length;
    if (!best || ore < best.ore) best = { start, end: start + 3600000, ore };
  }
  return best;
}
