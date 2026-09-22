import { createSupabaseContext } from '@supabase/server';
import { accessFor, requestJson } from './eloverblik-server.mjs';
import { advance, aggregateReadings, cacheFresh, danishDate, expectedIntervals, meterReadings, midnight } from './consumption-data.mjs';
import { backgroundWindow, estimateBackground } from './background-usage.mjs';

export class UsageError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const checked = async (query) => {
  const { data, error } = await query;
  if (error) throw new UsageError(503, 'Databasen kunne ikke behandle forespørgslen.');
  return data;
};
export async function authorizeHousehold(request, householdId, contextFactory = createSupabaseContext) {
  if (!request.headers.get('authorization')?.startsWith('Bearer ')) throw new UsageError(401, 'Log ind for at se elforbrug.');
  const { data: ctx, error } = await contextFactory(request, {
    auth: 'user', audience: 'authenticated', issuer: `${process.env.SUPABASE_URL?.replace(/\/$/, '')}/auth/v1`,
  });
  if (error || !ctx?.userClaims?.id) throw new UsageError(401, 'Din session er udløbet. Log ind igen.');
  if (typeof householdId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(householdId)) throw new UsageError(400, 'Vælg en husstand.');
  // Explicit membership check before accessing the privileged client.
  const member = await checked(ctx.supabase.from('household_members').select('household_id').eq('household_id', householdId).eq('user_id', ctx.userClaims.id).maybeSingle());
  if (!member) throw new UsageError(403, 'Du har ikke adgang til denne husstand.');
  return ctx;
}

export function validateSelection(selection, today = danishDate()) {
  const { from, to, aggregation } = selection;
  const valid = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
  if (!valid(from) || !valid(to) || from >= to || !['Year','Month','Day','Hour','Quarter'].includes(aggregation)) throw new UsageError(400, 'Vælg en gyldig periode.');
  const maxDays = { Year: 366 * 100, Month: 366, Day: 31, Hour: 1, Quarter: 7 };
  if ((Date.parse(to)-Date.parse(from))/86400000 > maxDays[aggregation] || from > today || to > `${Number(today.slice(0,4))+1}-01-01`) throw new UsageError(400, 'Perioden er for lang eller ligger i fremtiden.');
  if (['Year','Month'].includes(aggregation) && (!from.endsWith('-01-01') || !to.endsWith('-01-01')) || aggregation === 'Day' && (!from.endsWith('-01') || !to.endsWith('-01'))) throw new UsageError(400, 'Vælg en hel kalenderperiode.');
  return { from, to, aggregation, resolution: aggregation.toLowerCase() };
}

export async function storedUsage(db, householdId, selection, options = {}) {
  const now = options.now ?? Date.now();
  const today = danishDate(new Date(now));
  const { to, aggregation, resolution } = validateSelection(selection, today);
  let { from } = selection;
  const meters = await checked(db.from('electricity_meters').select('id,metering_point_id').eq('household_id', householdId));
  if (!meters.length) throw new UsageError(409, 'Husstanden har endnu ingen tilknyttede målere.');
  const earliest = await checked(db.from('electricity_readings').select('starts_at').eq('household_id', householdId).order('starts_at').limit(1));
  const firstYear = Math.min(Number(today.slice(0,4))-5, earliest.length ? Number(danishDate(new Date(earliest[0].starts_at)).slice(0,4)) : Infinity);
  const availableYears = Array.from({length: Number(today.slice(0,4))-firstYear+1},(_,i)=>firstYear+i);
  if (aggregation === 'Year') from = `${firstYear}-01-01`;
  let access;
  const fetchMeter = options.fetchMeter ?? (async (meter, start, end) => {
    if (householdId !== process.env.EL_OVERBLIK_HOUSEHOLD_ID || !process.env.EL_OVERBLIK_TOKEN) throw new UsageError(409, 'Eloverblik er ikke konfigureret for denne husstand.');
    access ??= await accessFor(process.env.EL_OVERBLIK_TOKEN.trim());
    if (typeof access?.result !== 'string') throw new UsageError(502, 'Eloverblik afviste forbindelsen.');
    return requestJson(`/meterdata/gettimeseries/${start}/${end}/${aggregation}`, access.result, { method: 'POST', body: JSON.stringify({ meteringPoints: { meteringPoint: [meter.metering_point_id] } }) });
  });
  // Canonical chunks make navigation reuse the same persisted ranges.
  const chunkResolution = ['Hour','Quarter'].includes(aggregation) ? 'day' : aggregation === 'Day' ? 'month' : 'year';
  let syncFailed = false;
  for (const meter of meters) {
    const pending = [];
    for (let start = from; start < to && start < today; start = advance(start, chunkResolution)) {
      const end = [advance(start, chunkResolution), to, today].sort()[0];
      if (start < `${Number(today.slice(0,4))-5}-01-01`) continue;
      const ranges = await checked(db.from('electricity_sync_ranges').select('*').eq('household_id', householdId).eq('meter_id', meter.id).eq('resolution', resolution).eq('date_from', start).eq('date_to', end).limit(1));
      if (cacheFresh(ranges[0], now)) continue;
      const previous = pending.at(-1);
      // Batch adjacent missing quarter-hour days into one upstream call.
      if (aggregation === 'Quarter' && previous?.end === start) {
        previous.end = end; previous.days.push({ start, end });
      } else pending.push({ start, end, days: [{ start, end }] });
    }
    for (const job of pending) {
      const fetchedAt = new Date(now).toISOString();
      let rows;
      try { rows = meterReadings(await fetchMeter(meter, job.start, job.end), meter.metering_point_id, resolution); }
      catch (error) { if (error instanceof UsageError) throw error; syncFailed = true; continue; }
      for (const { start, end } of job.days) {
        const startAt = midnight(start), endAt = midnight(end);
        const dayRows = rows.filter(row => row.starts_at >= startAt && row.starts_at < endAt);
        const expected = expectedIntervals(start, end, resolution);
        const byTime = new Map(dayRows.map(row => [row.starts_at, row]));
        const complete = expected.every(interval => byTime.get(interval.starts_at)?.kwh != null && byTime.get(interval.starts_at)?.ends_at === interval.ends_at);
        await checked(db.rpc('import_electricity_range', { p_household: householdId, p_meter: meter.id, p_from: start, p_to: end, p_resolution: resolution, p_fetched: fetchedAt, p_complete: complete, p_readings: dayRows }));
      }
    }
  }
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await checked(db.from('electricity_readings').select('meter_id,starts_at,ends_at,kwh').eq('household_id', householdId).eq('resolution', resolution).gte('starts_at', midnight(from)).lt('starts_at', midnight(to)).order('starts_at').order('meter_id').range(offset, offset+999));
    rows.push(...page); if (page.length < 1000) break;
  }
  const points = aggregateReadings(rows, meters, from, to, resolution, today);
  return { from, to, aggregation, meterCount: meters.length, availableYears, points, totalKwh: Math.round(points.reduce((sum,p)=>sum+(p.kwh??0),0)*1000)/1000, incomplete: syncFailed || points.some(p=>p.incomplete), syncFailed };
}

export async function householdUsage(request, body) {
  const ctx = await authorizeHousehold(request, body?.householdId);
  const vault = await checked(ctx.supabase.from('energy_vaults').select('household_id').eq('household_id',body.householdId).maybeSingle());
  if (vault) throw new UsageError(409, 'Denne husstand henter og behandler eldata krypteret i mobilappen.');
  if (body.refreshToken) throw new UsageError(400, 'Målerforbindelser administreres for husstanden.');
  if (body.view === 'background') {
    return estimateBackground(await storedUsage(ctx.supabaseAdmin, body.householdId, backgroundWindow()));
  }
  return storedUsage(ctx.supabaseAdmin, body.householdId, body);
}
export async function usageResponse(request, body) {
  try { return { status: 200, body: await householdUsage(request, body) }; }
  catch (error) { return { status: error instanceof UsageError ? error.status : 503, body: { error: error instanceof UsageError ? error.message : 'Elforbrug kunne ikke hentes. Prøv igen senere.' } }; }
}
