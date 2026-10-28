import type { EnergyVault } from './energy-vault';
import type { UsageSelection } from './eloverblik';
import * as Crypto from 'expo-crypto';
import { advance, danishDate, expectedIntervals, meterReadings,sourceHours } from './consumption-data.mjs';
import { electricityIndex } from './electricity-cache.mjs';
import { daysBetween, eligibleThrough, hourComplete, mergeDayRecords, nextImportBatch, periodKeys, selectionPoints, updateKeys,sourceFetched,importProgress } from './electricity-periods.mjs';

type Provider = (body: Record<string, unknown>) => Promise<any>;
export type ElectricityImportStatus = { running: boolean; error: string; initialComplete: boolean };
const workers = new WeakMap<EnergyVault, Promise<void>>();
const listeners = new WeakMap<EnergyVault, Set<() => void>>();
const statuses = new WeakMap<EnergyVault, ElectricityImportStatus>();
const retryAt = new WeakMap<EnergyVault, number>();
const retries = new WeakMap<EnergyVault, number>();
const retryTimers = new WeakMap<EnergyVault, ReturnType<typeof setTimeout>>();
const watched = new WeakMap<EnergyVault, Set<string>>();
const status = (vault: EnergyVault) => statuses.get(vault) ?? { running: false, error: '', initialComplete: false };
const emit = (vault: EnergyVault) => listeners.get(vault)?.forEach(listener => listener());
export const electricityImportStatus = (vault:EnergyVault)=>({...status(vault),...importProgress(vault.cachedElectricityRecord('state/import'))});
export function subscribeElectricityHistory(vault: EnergyVault, listener: () => void) {
  const set = listeners.get(vault) ?? new Set(); set.add(listener); listeners.set(vault, set);
  return () => { set.delete(listener); };
}
async function readKeys(vault: EnergyVault, keys: string[], fresh = false) {
  for (let index = 0; index < keys.length; index += 40) await vault.loadElectricityRecords(keys.slice(index, index + 40), fresh);
}
export async function readElectricityPeriods(vault: EnergyVault, selections: UsageSelection[]) {
  const keys = [...new Set(['state/import', ...selections.flatMap(periodKeys)])];
  const set = watched.get(vault) ?? new Set<string>();
  for (const key of keys) set.add(key);
  watched.set(vault, set);
  await readKeys(vault, keys);
}
export function storedElectricityPoints(vault: EnergyVault, selection: UsageSelection, today: string) {
  const state = vault.cachedElectricityRecord('state/import');
  if (!state?.legacyComplete && vault.data.readings.length) return null;
  const keys = periodKeys(selection), records = Object.fromEntries(keys.map(key => [key, vault.cachedElectricityRecord(key)]));
  if (!keys.some(key => records[key])) return null;
  return selectionPoints(selection, records, today);
}

async function migrateLegacy(vault: EnergyVault) {
  let state = vault.cachedElectricityRecord('state/import');
  if (state?.legacyComplete) return;
  const source = vault.data;
  const days = [...new Set(source.readings.filter(row => row.resolution === 'hour').map(row => danishDate(new Date(row.starts_at))))].sort();
  const descriptors = source.meters.map(meter => ({ id: meter.id, from: '2000-01-01', to: null }));
  for (let index = 0; index < days.length; index += 31) {
    const batch = days.slice(index, index + 31).filter(day => !state?.legacyThrough || day > state.legacyThrough);
    if (!batch.length) continue;
    const wanted = updateKeys(batch);
    await vault.mutateElectricityRecords(wanted, latest => {
      if (latest['state/import']?.legacyComplete) return {};
      const updates: Record<string, any> = {};
      for (const day of batch) {
        const intervals = expectedIntervals(day, advance(day, 'day'), 'hour');
        const positions = new Map(intervals.map((interval, position) => [interval.starts_at, position]));
        const imported = source.readings.filter(row => row.resolution === 'hour' && positions.has(row.starts_at)
          && latest[`hour/${day}`]?.meters?.[row.meter_id]?.values?.[positions.get(row.starts_at)!] == null);
        const meters = latest['state/import']?.meters?.length ? latest['state/import'].meters : descriptors;
        const merged = mergeDayRecords({ ...latest, ...updates }, day, imported, meters, [...new Set(imported.map(row => row.meter_id))], 0);
        Object.assign(updates, merged);
      }
      const next = { ...(updates['state/import'] ?? latest['state/import']), legacyThrough: batch.at(-1) };
      if (latest['state/import']?.legacyThrough > next.legacyThrough) next.legacyThrough = latest['state/import'].legacyThrough;
      updates['state/import'] = next;
      return updates;
    });
    state = vault.cachedElectricityRecord('state/import');
    if (state?.legacyComplete) return;
  }
  // Preserve older coarse-only history until canonical hours are imported.
  const summaries = electricityIndex(source).cache.summaries;
  const grouped = new Map<string, Map<string, { at: string; kwh: number | null; incomplete: boolean }>>();
  for (const row of summaries) {
    const date = danishDate(new Date(row.starts_at)), kind = row.resolution;
    const key = `${kind}/${date.slice(0, kind === 'day' ? 7 : 4)}`;
    if (!grouped.has(key)) grouped.set(key, new Map());
    const map = grouped.get(key)!, previous = map.get(row.starts_at);
    map.set(row.starts_at, { at: row.starts_at, kwh: row.kwh == null ? previous?.kwh ?? null : (previous?.kwh ?? 0) + row.kwh, incomplete: !!previous?.incomplete || row.incomplete });
  }
  const entries = [...grouped];
  for (let index = 0; index < entries.length; index += 39) {
    const batch = entries.slice(index, index + 39);
    await vault.mutateElectricityRecords(['state/import', ...batch.map(([key]) => key)], latest => {
      if (latest['state/import']?.legacyComplete) return {};
      const updates: Record<string, any> = {};
      for (const [key, points] of batch) {
        const existing = new Map<string, any>((latest[key]?.points ?? []).map((point: any) => [point.at, point]));
        for (const point of points.values()) if (!existing.has(point.at) || (existing.get(point.at).incomplete && !point.incomplete)) existing.set(point.at, point);
        updates[key] = { v: 1, points: [...existing.values()].sort((a, b) => a.at.localeCompare(b.at)) };
      }
      return updates;
    });
    if (vault.cachedElectricityRecord('state/import')?.legacyComplete) return;
  }
  await vault.mutateElectricityRecords(['state/import'], latest => latest['state/import']?.legacyComplete ? {} : ({ 'state/import': { v: 1, meters: [], gaps: {}, ...latest['state/import'], legacyComplete: true } }));
}

async function claimLease(vault: EnergyVault, owner: string) {
  await vault.mutateElectricityRecords(['state/import'], latest => {
    const current = latest['state/import'];
    if (current.lease && current.lease.owner !== owner && current.lease.until > Date.now()) return {};
    return { 'state/import': { ...current, lease: { owner, until: Date.now() + 120000 } } };
  });
  return vault.cachedElectricityRecord('state/import').lease?.owner === owner;
}
async function checkLease(vault: EnergyVault, owner: string) {
  const lease = vault.cachedElectricityRecord('state/import')?.lease;
  if (lease?.owner === owner && lease.until > Date.now() + 60000) return;
  await vault.mutateElectricityRecords(['state/import'], latest => {
    if (latest['state/import'].lease?.owner !== owner) throw new Error('Historikken opdateres på en anden enhed.');
    return { 'state/import': { ...latest['state/import'], lease: { owner, until: Date.now() + 120000 } } };
  });
}
async function initialize(vault: EnergyVault, provider: Provider, owner: string) {
  await vault.loadElectricityRecords(['state/import']);
  await migrateLegacy(vault);
  let state = vault.cachedElectricityRecord('state/import');
  const rootMeters = vault.data.meters.map(meter => meter.metering_point_id).sort().join(',');
  const changedMeters = state.rootMeters !== rootMeters;
  if (!state.initialized || state.sourceVersion!==1 || changedMeters || nextImportBatch(state, Date.now())) {
    await vault.loadElectricityRecords(['state/import'], true);
    state = vault.cachedElectricityRecord('state/import');
    if (!state.initialized || state.sourceVersion!==1 || state.rootMeters !== rootMeters || nextImportBatch(state, Date.now())) {
      if (!await claimLease(vault, owner)) return false;
      state = vault.cachedElectricityRecord('state/import');
    }
    await readKeys(vault, [...(watched.get(vault) ?? [])].filter(key => key !== 'state/import'), true);
  }
  if (!state.initialized || state.sourceVersion!==1 || state.rootMeters !== rootMeters) {
    await checkLease(vault, owner);
    const bounds = await provider({ action: 'history' });
    if (!Array.isArray(bounds.meters) || !bounds.meters.length) throw new Error('Ingen tilgængelige forbrugsmålere blev fundet.');
    const through = eligibleThrough(Date.now());
    await vault.mutateElectricityRecords(['state/import'], latest => {
      const current = latest['state/import'];
      const meters = bounds.meters.map((bound: any) => {
        if (!/^\d{18}$/.test(bound.metering_point_id) || !/^\d{4}-\d{2}-\d{2}$/.test(bound.from)) throw new Error('Ukendt historikperiode fra Eloverblik.');
        const old = (current.meters ?? []).find((meter: any) => meter.metering_point_id === bound.metering_point_id);
        const root = vault.data.meters.find(meter => meter.metering_point_id === bound.metering_point_id);
        const end = bound.to && bound.to < through ? bound.to : through;
        return old ? { ...old, from: bound.from, to: bound.to, cursor:current.sourceVersion===1?(old.cursor < end ? old.cursor : end):end } : { ...bound, id: root?.id ?? bound.metering_point_id, cursor: end, importedTo: end };
      });
      return { 'state/import': { ...current, initialized: true, sourceVersion:1, rootMeters, meters } };
    });
  }
  // Another device may already have imported the new day: consult the DB before
  // any provider call. Pure chart navigation itself never fetches provider data.
  return true;
}

async function importBatch(vault: EnergyVault, provider: Provider, batch: NonNullable<ReturnType<typeof nextImportBatch>>, owner: string) {
  const days = daysBetween(batch.from, batch.to), keys = updateKeys(days);
  await readKeys(vault, keys, true);
  let state = vault.cachedElectricityRecord('state/import');
  const requestedMeters = batch.direction === 'gap' ? state.meters.filter((meter: any) => meter.from <= batch.from && (!meter.to || meter.to > batch.from)) : [batch.meter];
  const imported: any[] = [];
  const original: any[] = [];
  const checked = new Map<string, string[]>();
  let finished = false;
  try {
  for (const meter of requestedMeters) {
    const missing = days.filter(day => !hourComplete(vault.cachedElectricityRecord(`hour/${day}`), meter.id, day)||!sourceFetched(vault.cachedElectricityRecord(`hour/${day}`),meter.id));
    // Split around complete cached days; never include them in provider ranges.
    for (let index = 0; index < missing.length;) {
      let end = index + 1;
      while (end < missing.length && missing[end] === advance(missing[end - 1]!, 'day')) end++;
      const from = missing[index]!, to = advance(missing[end - 1]!, 'day');
      await checkLease(vault, owner);
      const result = await provider({ action: 'timeseries', meteringPointId: meter.metering_point_id, from, to, aggregation: 'Actual' });
      const source=meterReadings(result,meter.metering_point_id,'actual');
      original.push(...source.map(row=>({...row,meter_id:meter.id})));
      imported.push(...sourceHours(source).map(row => ({ ...row, meter_id: meter.id, resolution: 'hour' })));
      for (const day of missing.slice(index, end)) checked.set(day, [...(checked.get(day) ?? []), meter.id]);
      index = end;
    }
  }
  finished = true;
  } finally {
  const savedDays = finished ? days : [...checked.keys()];
  if (savedDays.length) await vault.mutateElectricityRecords(updateKeys(savedDays), latest => {
    if (latest['state/import'].lease?.owner !== owner) throw new Error('Historikken opdateres på en anden enhed.');
    const updates: Record<string, any> = {};
    for (const day of savedDays) {
      const merged = mergeDayRecords({ ...latest, ...updates }, day, imported, latest['state/import'].meters, checked.get(day) ?? [], Date.now(),original);
      Object.assign(updates, merged);
    }
    state = updates['state/import'];
    state.lease = { owner, until: Date.now() + 120000 };
    const meter = state.meters.find((item: any) => item.id === batch.meter.id);
    if (finished && batch.direction === 'history' && meter.cursor > batch.from) meter.cursor = batch.from;
    if (finished && batch.direction === 'new' && meter.importedTo < batch.to) meter.importedTo = batch.to;
    if(finished){state.lastImportedFrom=batch.from;state.lastImportedTo=batch.to;}
    return updates;
  });
  emit(vault);
  }
}

export function startElectricityHistory(vault: EnergyVault, provider: Provider) {
  if (workers.has(vault) || (retryAt.get(vault) ?? 0) > Date.now()) return;
  const previousTimer = retryTimers.get(vault); if (previousTimer) clearTimeout(previousTimer);
  statuses.set(vault, { ...status(vault), running: true, error: '' }); emit(vault);
  const guardedProvider: Provider = async body => {
    try { return await provider(body); }
    catch (error) {
      const failure = error instanceof Error ? error : new Error('Eloverblik kunne ikke kontaktes.');
      Object.assign(failure, { retryableProvider: ![400, 401, 403, 404, 409, 410].includes(Number((error as any)?.status)) });
      throw failure;
    }
  };
  const work = (async () => {
    const owner = Array.from(await Crypto.getRandomBytesAsync(16), value => value.toString(16).padStart(2, '0')).join('');
    try {
    if (!await initialize(vault, guardedProvider, owner)) {
      statuses.set(vault, { running: false, error: '', initialComplete: false });
      const timer = setTimeout(() => { try { void vault.data; startElectricityHistory(vault, provider); } catch { /* Logged out. */ } }, 10000);
      (timer as any).unref?.(); retryTimers.set(vault, timer);
      return;
    }
    emit(vault);
    let batch;
    while ((batch = nextImportBatch(vault.cachedElectricityRecord('state/import'), Date.now()))) {
      // Yield between bounded batches so cached charts can paint during backfill.
      await new Promise<void>(resolve => setTimeout(resolve, 1000));
      void vault.data; // Cancellation/lock check before provider requests.
      await importBatch(vault, guardedProvider, batch, owner);
      retries.delete(vault);
    }
    statuses.set(vault, { running: false, error: '', initialComplete: true });
    } finally {
      try {
        if (vault.cachedElectricityRecord('state/import')?.lease?.owner === owner) await vault.mutateElectricityRecords(['state/import'], latest => {
          const current = latest['state/import'];
          if (current.lease?.owner !== owner) return {};
          const next = { ...current }; delete next.lease;
          return { 'state/import': next };
        });
      } catch { /* A locked/offline owner lets the bounded lease expire. */ }
    }
  })();
  workers.set(vault, work);
  void work.catch(error => {
    const failures = (retries.get(vault) ?? 0) + 1;
    retries.set(vault, failures);
    const delay = Math.min(3600000, 60000 * 2 ** Math.min(6, failures - 1));
    retryAt.set(vault, Date.now() + delay);
    statuses.set(vault, { running: false, initialComplete: false, error: error instanceof Error ? error.message : 'Elhistorikken kunne ikke hentes.' });
    if (error?.retryableProvider) {
      const timer = setTimeout(() => { try { void vault.data; startElectricityHistory(vault, provider); } catch { /* Logged out/locked. */ } }, delay);
      (timer as any).unref?.();
      retryTimers.set(vault, timer);
    }
  }).finally(() => { workers.delete(vault); emit(vault); });
}
export async function waitForElectricityHistory(vault: EnergyVault) { await workers.get(vault); }
