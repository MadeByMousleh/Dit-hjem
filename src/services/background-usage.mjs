import { danishDate, expectedIntervals } from './consumption-data.mjs';

export function backgroundWindow(now = Date.now()) {
  const to = danishDate(new Date(now));
  const from = new Date(to + 'T12:00:00Z');
  from.setUTCDate(from.getUTCDate() - 7);
  return { from: from.toISOString().slice(0, 10), to, aggregation: 'Quarter' };
}

const localHour = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Copenhagen', hour: '2-digit', hourCycle: 'h23' });
const overnight = at => { const hour = Number(localHour.format(new Date(at))); return hour >= 2 && hour < 4; };

// A descriptive lower-load estimate, not appliance detection or measured standby.
export function estimateBackground(usage) {
  const expected = expectedIntervals(usage.from, usage.to, 'quarter').filter(interval => overnight(interval.starts_at));
  const expectedByNight = new Map();
  const samplesByNight = new Map();
  const byTime = new Map(usage.points.map(point => [new Date(point.at).toISOString(), point]));
  for (const interval of expected) {
    const night = danishDate(new Date(interval.starts_at));
    expectedByNight.set(night, (expectedByNight.get(night) ?? 0) + 1);
    const point = byTime.get(interval.starts_at);
    if (point?.incomplete || point?.kwh == null || !Number.isFinite(point.kwh) || point.kwh < 0) continue;
    if (!samplesByNight.has(night)) samplesByNight.set(night, []);
    samplesByNight.get(night).push(point.kwh);
  }
  const samples = [...samplesByNight.values()].flat();
  const nights = [...expectedByNight].filter(([date, count]) => (samplesByNight.get(date)?.length ?? 0) >= Math.ceil(count * 0.75)).length;
  const coverage = expected.length ? samples.length / expected.length : 0;
  const enough = nights >= 5 && coverage >= 0.8;
  let watts = null, dailyKwh = null;
  if (enough) {
    samples.sort((a, b) => a - b);
    const position = (samples.length - 1) * 0.05;
    const low = Math.floor(position), high = Math.ceil(position);
    const quarterKwh = samples[low] + (samples[high] - samples[low]) * (position - low);
    watts = Math.round(quarterKwh * 4 * 1000);
    dailyKwh = Math.round(quarterKwh * 96 * 1000) / 1000;
  }
  return {
    algorithm: 'overnight-p05-v1', status: enough ? 'ready' : 'insufficient_data',
    from: usage.from, to: usage.to, watts, dailyKwh,
    monthlyKwh: dailyKwh === null ? null : Math.round(dailyKwh * 30 * 1000) / 1000,
    validIntervals: samples.length, expectedIntervals: expected.length, nights,
    coverage: Math.round(coverage * 1000) / 1000, syncFailed: usage.syncFailed,
  };
}
