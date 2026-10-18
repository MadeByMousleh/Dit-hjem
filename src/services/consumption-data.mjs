const dateFormatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Copenhagen', year: 'numeric', month: '2-digit', day: '2-digit' });
const hourFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Copenhagen', hour: '2-digit', hourCycle: 'h23' });
const timestampFormatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Copenhagen', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
const midnights = new Map();
export const danishDate = (date = new Date()) => dateFormatter.format(date);
export function midnight(date) {
  if (midnights.has(date)) return midnights.get(date);
  const noon = new Date(date + 'T12:00:00Z');
  const hour = Number(hourFormatter.format(noon));
  // Determine the offset at midnight, which can differ from noon on DST days.
  let instant = Date.parse(date + 'T00:00:00Z') - (hour - 12) * 3600000;
  const local = timestampFormatter.format(new Date(instant));
  instant += Date.parse(date + 'T00:00:00Z') - Date.parse(local.replace(' ', 'T') + 'Z');
  const result = new Date(instant).toISOString();
  if (midnights.size >= 4096) midnights.clear();
  midnights.set(date, result);
  return result;
}
export function advance(date, resolution) {
  const d = new Date(date + 'T12:00:00Z');
  if (resolution === 'year') d.setUTCFullYear(d.getUTCFullYear() + 1);
  else if (resolution === 'month') d.setUTCMonth(d.getUTCMonth() + 1);
  else d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
export function expectedIntervals(from, to, resolution) {
  const result = [];
  let at = midnight(from);
  const end = midnight(to);
  while (at < end) {
    const next = resolution === 'hour' || resolution === 'quarter'
      ? new Date(Date.parse(at) + (resolution === 'hour' ? 60 : 15) * 60000).toISOString()
      : midnight(advance(danishDate(new Date(at)), resolution));
    result.push({ starts_at: at, ends_at: next });
    at = next;
  }
  return result;
}

// Each response is requested for exactly one registered meter; never combine meters here.
export function meterReadings(payload, meterPointId, resolution) {
  if (!Array.isArray(payload?.result) || !payload.result.length || payload.result.some(r => !r.success && ![30015,30018].includes(r.errorCode))) throw new Error('Eloverblik kunne ikke hente målerdata. Prøv igen senere.');
  const rows = new Map();
  let hasFinerIntervals = false;
  const resolutions = { PT15M: 'quarter', PT1H: 'hour', P1D: 'day', P1M: 'month', P1Y: 'year' };
  for (const result of payload.result) for (const series of result.MyEnergyData_MarketDocument?.TimeSeries ?? []) {
    if (series.businessType !== 'A04' || (series['measurement_Unit.name'] && series['measurement_Unit.name'] !== 'KWH')) continue;
    const identity = series['MarketEvaluationPoint.mRID']?.name ?? series['MarketEvaluationPoint.mRID'];
    if (typeof identity === 'string' && identity !== meterPointId) throw new Error('Uventet målepunkt i svaret.');
    for (const period of series.Period ?? []) {
      const actual = resolutions[period.resolution?.replace(/^PT1([DMY])$/, 'P1$1')];
      const rank = { quarter: 0, hour: 1, day: 2, month: 3, year: 4 };
      if (actual === undefined || rank[actual] > rank[resolution]) throw new Error('Uventet opløsning i målerdata.');
      hasFinerIntervals ||= rank[actual] < rank[resolution];
      const start = new Date(period.timeInterval?.start);
      if (!Number.isFinite(+start)) throw new Error('Ugyldigt tidspunkt i målerdata.');
      for (const point of period.Point ?? []) {
        const position = Number(point.position) - 1;
        if (!Number.isInteger(position) || position < 0) throw new Error('Ugyldig målerposition.');
        let at, end;
        if (actual === 'hour' || actual === 'quarter') {
          const duration = actual === 'hour' ? 3600000 : 900000;
          at = new Date(+start + position * duration).toISOString();
          end = new Date(+start + (position + 1) * duration).toISOString();
        } else {
          let date = danishDate(start);
          const bucket = actual === 'year' ? date.slice(0,4)+'-01-01' : actual === 'month' ? date.slice(0,7)+'-01' : date;
          if (position > 0) {
            date = bucket;
            for (let i = 0; i < position; i++) date = advance(date, actual);
          }
          at = midnight(date);
          end = midnight(advance(position === 0 ? bucket : date, actual));
        }
        if (period.timeInterval?.end) {
          const periodEnd = new Date(period.timeInterval.end).toISOString();
          if (end > periodEnd) end = periodEnd;
          if (end <= at) throw new Error('Målingen ligger uden for perioden.');
        }
        const raw = point['out_Quantity.quantity'];
        const value = raw == null || String(raw).trim() === '' ? NaN : Number(String(raw).replace(',', '.'));
        const quality = point['out_Quantity.quality'] ?? null;
        const row = { starts_at: at, ends_at: end, kwh: quality !== 'A02' && Number.isFinite(value) && value >= 0 ? value : null, quality };
        const previous = rows.get(at);
        if (previous && JSON.stringify(previous) !== JSON.stringify(row)) throw new Error('Modstridende målinger for samme tidspunkt.');
        rows.set(at, row);
      }
    }
  }
  const sorted = [...rows.values()].sort((a,b) => a.starts_at.localeCompare(b.starts_at));
  if (sorted.some((row,index)=>index>0 && sorted[index-1].ends_at>row.starts_at)) throw new Error('Overlappende målinger.');
  const coarser = resolution === 'hour' ? 3600000 : resolution === 'quarter' ? 900000 : null;
  // Preserve the real coverage of a partial calendar year/month/day. Only
  // finer-resolution replies need rebucketing; a partial period is not zero.
  if (!coarser && !hasFinerIntervals) return sorted;
  const bucketFor = row => {
    if (coarser) return new Date(Math.floor(Date.parse(row.starts_at) / coarser) * coarser).toISOString();
    const date = danishDate(new Date(row.starts_at));
    return midnight(resolution === 'year' ? `${date.slice(0, 4)}-01-01` : resolution === 'month' ? `${date.slice(0, 7)}-01` : date);
  };
  if (sorted.every(row => bucketFor(row) === row.starts_at && (coarser ? Date.parse(row.ends_at) - Date.parse(row.starts_at) === coarser : row.ends_at === midnight(advance(danishDate(new Date(row.starts_at)), resolution))))) return sorted;
  const buckets = new Map();
  for (const row of sorted) {
    const start = bucketFor(row);
    if (!buckets.has(start)) buckets.set(start, []);
    buckets.get(start).push(row);
  }
  return [...buckets].map(([start, parts]) => {
    const end = coarser ? new Date(Date.parse(start) + coarser).toISOString() : midnight(advance(danishDate(new Date(start)), resolution));
    let covered = start, sum = 0, complete = true;
    for (const part of parts) {
      if (part.starts_at !== covered || part.kwh === null) complete = false;
      if (part.kwh !== null) sum += part.kwh;
      covered = part.ends_at;
    }
    return { starts_at: start, ends_at: end, kwh: complete && covered === end ? sum : null, quality: null };
  });
}

export function aggregateReadings(rows, meters, from, to, resolution, today) {
  const todayStart = midnight(today);
  const grouped = new Map();
  for (const row of rows) {
    const date = danishDate(new Date(row.starts_at));
    const bucket = resolution === 'year' ? midnight(date.slice(0,4)+'-01-01') : resolution === 'month' ? midnight(date.slice(0,7)+'-01') : resolution === 'day' ? midnight(date) : new Date(row.starts_at).toISOString();
    const key = `${row.meter_id}/${bucket}`;
    if (!grouped.has(key)) grouped.set(key,[]);
    grouped.get(key).push({...row,starts_at:new Date(row.starts_at).toISOString(),ends_at:new Date(row.ends_at).toISOString()});
  }
  return expectedIntervals(from,to,resolution).map(interval=>{
    let sum=0, present=false, incomplete=interval.ends_at>todayStart;
    for (const meter of meters) {
      const values=(grouped.get(`${meter.id}/${interval.starts_at}`)??[]).sort((a,b)=>a.starts_at.localeCompare(b.starts_at));
      let covered=interval.starts_at;
      for(const row of values) {
        if(row.starts_at<covered) { incomplete=true; continue; }
        if(row.starts_at>covered || row.kwh==null) incomplete=true;
        if(row.kwh!=null) { sum+=Number(row.kwh); present=true; }
        covered=row.ends_at;
      }
      if(covered!==interval.ends_at) incomplete=true;
    }
    const precision = resolution === 'quarter' ? 1000000 : 1000;
    return {at:interval.starts_at,kwh:present?Math.round(sum*precision)/precision:null,incomplete};
  });
}

export function cacheFresh(range, now = Date.now()) {
  if (!range) return false;
  const recent = Date.parse(range.date_to) > now - 30 * 86400000;
  const ttl = recent ? 3600000 : !range.complete ? 6 * 3600000 : 7 * 86400000;
  return now - Date.parse(range.fetched_at) < ttl;
}
