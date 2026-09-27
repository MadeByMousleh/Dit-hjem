import type { ElectricityAgreement } from '../hooks/useElectricityAgreements';
import type { PricePoint } from '../prices';
import type { UsageAggregation } from '../services/eloverblik';
import { advance, midnight } from '../services/consumption-data.mjs';

type UsagePoint = { at: string; kwh: number | null };
const dateFormatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Copenhagen', year: 'numeric', month: '2-digit', day: '2-digit' });
const danishDate = (at: string) => dateFormatter.format(new Date(at));

// Daily totals do not reveal the household's hourly distribution. Use the
// day's average tariff and label the result as an estimate, never a bill.
export function estimateUsageTotals(points: UsagePoint[], aggregation: UsageAggregation, agreements: ElectricityAgreement[], prices: PricePoint[]): Map<string, number> {
  const totals = new Map<string, number>();
  if (aggregation === 'Month') {
    const today = dateFormatter.format(new Date());
    const expanded = new Map<string, UsagePoint[]>();
    for (const point of points) {
      if (point.kwh === null) continue;
      const start = danishDate(point.at).slice(0, 7) + '-01';
      const end = advance(start, 'month');
      const dates: string[] = [];
      for (let date = start; date < end && date < today; date = advance(date, 'day')) dates.push(date);
      if (dates.length) expanded.set(point.at, dates.map(date => ({ at: midnight(date), kwh: point.kwh! / dates.length })));
    }
    // Monthly readings have no daily distribution; apply each day's agreement
    // and tariff to an even share, retaining subscription changes within a month.
    const daily = estimateUsageTotals([...expanded.values()].flat(), 'Day', agreements, prices);
    for (const [at, days] of expanded) {
      if (days.every(day => daily.has(day.at))) totals.set(at, days.reduce((sum, day) => sum + daily.get(day.at)!, 0));
    }
    return totals;
  }
  if (aggregation !== 'Day' && aggregation !== 'Hour') return totals;
  const ordered = [...agreements].sort((a, b) => b.date_from.localeCompare(a.date_from));
  const fallback = ordered.find(item => !item.date_to) ?? ordered[0];
  const groups = new Map<string, PricePoint[]>();
  for (const price of prices) {
    const key = aggregation === 'Day' ? dateFormatter.format(price.startsAt) : String(Math.floor(price.startsAt.getTime() / 3600000));
    const group = groups.get(key) ?? [];
    group.push(price); groups.set(key, group);
  }
  for (const point of points) {
    if (point.kwh === null) continue;
    const date = danishDate(point.at);
    const agreement = ordered.find(item => item.date_from <= date && (!item.date_to || date < item.date_to)) ?? fallback;
    if (!agreement) continue;
    const key = aggregation === 'Day' ? date : String(Math.floor(Date.parse(point.at) / 3600000));
    const group = groups.get(key);
    const quarterHourly = group?.some(price => price.startsAt.getUTCMinutes() !== 0) ?? false;
    const hours = (Date.parse(midnight(advance(date, 'day'))) - Date.parse(midnight(date))) / 3600000;
    const interval = quarterHourly ? 900000 : 3600000;
    const expectedCount = (aggregation === 'Day' ? hours : 1) * (quarterHourly ? 4 : 1);
    if (!group?.length || new Set(group.map(price => Math.floor(price.startsAt.getTime() / interval))).size < expectedCount) continue;
    const rate = group.reduce((sum, price) => sum + (agreement.price_type === 'fixed'
      ? price.gridAndTaxOrePerKwh + Number(agreement.fixed_ore)
      : price.totalOrePerKwh), 0) / group.length + Number(agreement.markup_ore);
    const daysInMonth = new Date(Date.UTC(Number(date.slice(0,4)), Number(date.slice(5,7)), 0)).getUTCDate();
    const subscription = Number(agreement.subscription_dkk) * 100 / daysInMonth / (aggregation === 'Hour' ? hours : 1);
    const ore = point.kwh * rate + subscription;
    if (Number.isFinite(ore)) totals.set(point.at, ore);
  }
  return totals;
}
