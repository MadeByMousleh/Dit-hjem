import { advance, danishDate, expectedIntervals, midnight } from './consumption-data.mjs';

const indexes = new WeakMap();
const clock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Copenhagen', hour: '2-digit', hourCycle: 'h23' });
const key = (meter, resolution, at) => `${meter}:${resolution}:${at}`;
const round = value => Math.round(value * 1000) / 1000;

// Non-security checksum: detects stale derived summaries written by older clients.
// Encryption/signatures, not this checksum, provide integrity and access control.
function fingerprint(data) {
  let hash = 2166136261;
  const add = value => { for (const char of String(value)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619); hash = Math.imul(hash ^ 255, 16777619); };
  for (const meter of data.meters) add(meter.id);
  for (const row of data.readings) for (const value of [row.meter_id, row.resolution, row.starts_at, row.ends_at, row.kwh]) add(value);
  return `${data.readings.length}:${hash >>> 0}`;
}

function buildSummaries(data) {
  const summaries = [];
  for (const meter of data.meters) {
    const source = data.readings.filter(row => row.meter_id === meter.id);
    let finer = source.filter(row => row.resolution === 'hour');
    for (const resolution of ['day', 'month', 'year']) {
      const legacy = source.filter(row => row.resolution === resolution);
      const dates = new Set([...finer, ...legacy].map(row => {
        const date = danishDate(new Date(row.starts_at));
        return resolution === 'year' ? `${date.slice(0, 4)}-01-01` : resolution === 'month' ? `${date.slice(0, 7)}-01` : date;
      }));
      const groups = new Map();
      for (const row of finer) {
        const date = danishDate(new Date(row.starts_at));
        const bucket = resolution === 'year' ? `${date.slice(0, 4)}-01-01` : resolution === 'month' ? `${date.slice(0, 7)}-01` : date;
        if (!groups.has(bucket)) groups.set(bucket, []);
        groups.get(bucket).push(row);
      }
      const coarser = new Map(legacy.map(row => {
        const date = danishDate(new Date(row.starts_at));
        const bucket = resolution === 'year' ? `${date.slice(0, 4)}-01-01` : resolution === 'month' ? `${date.slice(0, 7)}-01` : date;
        return [midnight(bucket), row];
      }));
      const next = [];
      for (const date of [...dates].sort()) {
        const start = midnight(date), endDate = advance(date, resolution), end = midnight(endDate);
        const parts = (groups.get(date) ?? []).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
        let covered = start, sum = 0, present = false, incomplete = false;
        for (const row of parts) {
          if (row.starts_at !== covered || row.kwh == null || row.incomplete) incomplete = true;
          if (row.starts_at < covered) { incomplete = true; continue; }
          if (row.kwh != null) { sum += row.kwh; present = true; }
          covered = row.ends_at;
        }
        incomplete ||= covered !== end;
        const old = coarser.get(start);
        // Keep useful imported coarse history until hourly backfill is complete.
        const useLegacy = incomplete && old?.kwh != null && (old.ends_at === end || !present);
        const row = { meter_id: meter.id, resolution, starts_at: start, ends_at: end,
          kwh: useLegacy ? old.kwh : present ? sum : null, incomplete: useLegacy ? old.starts_at !== start || old.ends_at !== end : incomplete };
        summaries.push(row); next.push(row);
      }
      finer = next;
    }
  }
  return summaries;
}

export function electricityIndex(data) {
  if (indexes.has(data)) return indexes.get(data);
  const signature = fingerprint(data);
  const saved = data.electricity_cache;
  const cache = saved?.version === 1 && saved.fingerprint === signature && Array.isArray(saved.summaries)
    ? saved : { version: 1, fingerprint: signature, summaries: buildSummaries(data) };
  const rows = new Map();
  for (const row of data.readings) if (row.resolution === 'hour' || row.resolution === 'quarter') rows.set(key(row.meter_id, row.resolution, row.starts_at), row);
  for (const row of cache.summaries) rows.set(key(row.meter_id, row.resolution, row.starts_at), row);
  const firstYear = data.readings.reduce((year, row) => Math.min(year, Number(row.starts_at.slice(0, 4))), Number(danishDate().slice(0, 4)) - 5);
  const result = { cache, rows, firstYear };
  indexes.set(data, result);
  return result;
}

export function materializeElectricityCache(data) {
  // Writers may have changed an existing object since its last indexed read.
  indexes.delete(data);
  data.electricity_cache = electricityIndex(data).cache;
  return data;
}

export function cachedElectricityPoints(data, from, to, resolution, today) {
  const { rows } = electricityIndex(data);
  const todayStart = midnight(today);
  return expectedIntervals(from, to, resolution).map(interval => {
    let sum = 0, present = false, incomplete = data.meters.length === 0 || interval.ends_at > todayStart;
    for (const meter of data.meters) {
      const row = rows.get(key(meter.id, resolution, interval.starts_at));
      if (!row || row.ends_at !== interval.ends_at || row.kwh == null || row.incomplete) incomplete = true;
      if (row?.kwh != null) { present = true; sum += row.kwh; }
    }
    return { at: interval.starts_at, kwh: present ? round(sum) : null, incomplete };
  });
}

export function completeHourlyDay(data, meterId, day) {
  const { rows } = electricityIndex(data);
  return expectedIntervals(day, advance(day, 'day'), 'hour').every(interval => {
    const row = rows.get(key(meterId, 'hour', interval.starts_at));
    return row?.kwh != null && row.ends_at === interval.ends_at;
  });
}

export function missingElectricityDays(data, selections, now = Date.now()) {
  const today = danishDate(new Date(now));
  const yesterday = new Date(Date.parse(`${today}T12:00:00Z`) - 86400000).toISOString().slice(0, 10);
  const recentStart = new Date(Date.parse(`${today}T12:00:00Z`) - 3 * 86400000).toISOString().slice(0, 10);
  const localHour = Number(clock.format(new Date(now)));
  const days = new Set();
  for (const selection of selections) for (let day = selection.from; day < selection.to && day < today; day = advance(day, 'day')) {
    // A scheduling policy, not an Eloverblik publication-time guarantee.
    if (day === yesterday && localHour < 17) continue;
    days.add(day);
  }
  const missing = [];
  for (const meter of data.meters) for (const day of [...days].sort()) {
    if (completeHourlyDay(data, meter.id, day)) continue;
    const next = advance(day, 'day');
    const checked = data.synced_ranges?.some(range => range.meter_id === meter.id && range.resolution === 'hour'
      && range.from <= day && range.to >= next && now - Date.parse(range.fetched_at) < (day >= recentStart ? 6 : 168) * 3600000);
    if (!checked) missing.push({ meter, from: day, to: next });
  }
  return missing;
}

export function nextElectricitySyncAt(now = Date.now()) {
  let day = danishDate(new Date(now));
  const boundary = date => Date.parse(midnight(advance(date, 'day'))) - 7 * 3600000;
  if (boundary(day) <= now) day = advance(day, 'day');
  return boundary(day);
}

// Adjacent missing days share a request; never include an already-cached day.
export function batchMissingDays(days) {
  const batches = [];
  for (const day of days) {
    const previous = batches.at(-1);
    if (previous && previous.meter.id === day.meter.id && previous.to === day.from && previous.days.length < 31) {
      previous.to = day.to; previous.days.push(day.from);
    } else batches.push({ ...day, days: [day.from] });
  }
  return batches;
}
