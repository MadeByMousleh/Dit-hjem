import { advance, danishDate, expectedIntervals, midnight } from './consumption-data.mjs';

export function daysBetween(from, to) {
  const days = [];
  for (let day = from; day < to; day = advance(day, 'day')) days.push(day);
  return days;
}
export function periodKeys(selection) {
  const keys = new Set();
  for (const day of daysBetween(selection.from, selection.to)) {
    keys.add(selection.aggregation === 'Hour' ? `hour/${day}` : selection.aggregation === 'Day' ? `day/${day.slice(0, 7)}` : selection.aggregation === 'Month' ? `month/${day.slice(0, 4)}` : `year/${day.slice(0, 4)}`);
  }
  return [...keys];
}
export function updateKeys(days) {
  return [...new Set(['state/import', ...days.flatMap(day => [`hour/${day}`, `day/${day.slice(0, 7)}`, `month/${day.slice(0, 4)}`, `year/${day.slice(0, 4)}`])])];
}
const applicable = (meter, day) => meter.from <= day && (!meter.to || day < meter.to);
export function hourComplete(payload, meterId, day) {
  const values = payload?.meters?.[meterId]?.values;
  return Array.isArray(values) && values.length === expectedIntervals(day, advance(day, 'day'), 'hour').length && values.every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0);
}
function totalPoint(at, points, expected) {
  const indexed = new Map(points.map(point => [point.at, point]));
  let sum = 0, present = false, incomplete = false;
  for (const interval of expected) {
    const point = indexed.get(interval.starts_at);
    if (!point || point.kwh == null || point.incomplete) incomplete = true;
    if (point?.kwh != null) { sum += point.kwh; present = true; }
  }
  return { at, kwh: present ? sum : null, incomplete };
}
function replacePoint(record, point) {
  return { v: 1, points: [...(record?.points ?? []).filter(item => item.at !== point.at), point].sort((a, b) => a.at.localeCompare(b.at)) };
}

// Compact vectors use the real Danish day's expected UTC intervals (23/24/25).
export function mergeDayRecords(latest, day, imported, descriptors, checkedIds, now) {
  const key = `hour/${day}`, intervals = expectedIntervals(day, advance(day, 'day'), 'hour');
  const old = latest[key];
  const hour = { v: 1, day, meters: structuredCloneSafe(old?.meters ?? {}), points: [] };
  const expectedMeters = descriptors.filter(meter => applicable(meter, day));
  for (const id of checkedIds) {
    const rows = new Map(imported.filter(row => row.meter_id === id).map(row => [row.starts_at, row]));
    const previous = hour.meters[id]?.values ?? [];
    hour.meters[id] = { checkedAt: now, values: intervals.map((interval, index) => {
      const row = rows.get(interval.starts_at);
      return row?.ends_at === interval.ends_at && row.kwh != null ? row.kwh : previous[index] ?? null;
    }) };
  }
  hour.points = intervals.map((_, index) => {
    let sum = 0, present = false, incomplete = expectedMeters.length === 0;
    for (const meter of expectedMeters) {
      const value = hour.meters[meter.id]?.values?.[index];
      if (value == null) incomplete = true;
      else { sum += value; present = true; }
    }
    return [present ? sum : null, incomplete];
  });
  const daily = totalPoint(midnight(day), hour.points.map(([kwh, incomplete], index) => ({ at: intervals[index].starts_at, kwh, incomplete })), intervals);
  const dayKey = `day/${day.slice(0, 7)}`, monthKey = `month/${day.slice(0, 4)}`, yearKey = `year/${day.slice(0, 4)}`;
  const dailyRecord = replacePoint(latest[dayKey], daily);
  const month = `${day.slice(0, 7)}-01`, nextMonth = advance(month, 'month');
  const monthly = totalPoint(midnight(month), dailyRecord.points, expectedIntervals(month, nextMonth, 'day'));
  const monthlyRecord = replacePoint(latest[monthKey], monthly);
  const year = `${day.slice(0, 4)}-01-01`, nextYear = advance(year, 'year');
  const yearly = totalPoint(midnight(year), monthlyRecord.points, expectedIntervals(year, nextYear, 'month'));
  const state = structuredCloneSafe(latest['state/import'] ?? { v: 1, meters: [], gaps: {} });
  state.gaps ??= {};
  if (daily.incomplete) state.gaps[day] = now + (day >= advance(danishDate(new Date(now - 3 * 86400000)), 'day') ? 6 : 168) * 3600000;
  else delete state.gaps[day];
  return { [key]: hour, [dayKey]: dailyRecord, [monthKey]: monthlyRecord, [yearKey]: replacePoint(latest[yearKey], yearly), 'state/import': state };
}
const structuredCloneSafe = value => JSON.parse(JSON.stringify(value));

export function selectionPoints(selection, records, today) {
  const resolution = selection.aggregation.toLowerCase();
  const points = new Map();
  for (const key of periodKeys(selection)) {
    const payload = records[key];
    if (!payload) continue;
    if (key.startsWith('hour/')) {
      const day = key.slice(5), intervals = expectedIntervals(day, advance(day, 'day'), 'hour');
      for (const [index, point] of (payload.points ?? []).entries()) if (intervals[index]) points.set(intervals[index].starts_at, { at: intervals[index].starts_at, kwh: point[0], incomplete: point[1] });
    } else for (const point of payload.points ?? []) points.set(point.at, point);
  }
  const todayStart = midnight(today);
  return expectedIntervals(selection.from, selection.to, resolution).map(interval => {
    const point = points.get(interval.starts_at);
    return { at: interval.starts_at, kwh: point?.kwh == null ? null : Math.round(point.kwh * 1000) / 1000, incomplete: !point || !!point.incomplete || interval.ends_at > todayStart };
  });
}

export function eligibleThrough(now = Date.now()) {
  const today = danishDate(new Date(now));
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Copenhagen', hourCycle: 'h23', hour: '2-digit' }).format(new Date(now)));
  return hour >= 17 ? today : danishDate(new Date(Date.parse(`${today}T12:00:00Z`) - 86400000));
}

export function nextImportBatch(state, now = Date.now()) {
  const through = eligibleThrough(now);
  // Recent new days take precedence over an interrupted historical backfill.
  for (const meter of state.meters ?? []) {
    const end = meter.to && meter.to < through ? meter.to : through;
    if (meter.importedTo < end) {
      const from = meter.importedTo > meter.from ? meter.importedTo : meter.from;
      const days = daysBetween(from, end).slice(0, 31);
      if (days.length) return { meter, from: days[0], to: advance(days.at(-1), 'day'), direction: 'new' };
    }
  }
  for (const meter of [...(state.meters ?? [])].sort((a, b) => b.cursor.localeCompare(a.cursor))) if (meter.cursor > meter.from) {
    const days = daysBetween(meter.from, meter.cursor).slice(-31);
    return { meter, from: days[0], to: meter.cursor, direction: 'history' };
  }
  for (const [day, retryAt] of Object.entries(state.gaps ?? {}).sort()) if (Number(retryAt) <= now && day < through) {
    const meter = (state.meters ?? []).find(meter => applicable(meter, day));
    if (meter) return { meter, from: day, to: advance(day, 'day'), direction: 'gap' };
  }
  return null;
}
