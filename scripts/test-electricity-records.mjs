import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHash, createPublicKey, verify } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as crypto from '../src/services/vault-crypto.mjs';
import * as signing from '../src/services/vault-signing.mjs';
import * as cache from '../src/services/electricity-cache.mjs';
import * as periods from '../src/services/electricity-periods.mjs';
import * as localStorageCache from '../src/services/local-storage-cache.mjs';
import * as consumption from '../src/services/consumption-data.mjs';
import { electricityRecordWriteResponse } from '../src/services/electricity-record-server.mjs';

const clone = value => JSON.parse(JSON.stringify(value));
const project = 'https://aaaaaaaaaaaaaaaaaaaa.supabase.co', home = randomUUID(), user = randomUUID();
const key = new Uint8Array(randomBytes(32)), publicKey = signing.vaultWriterPublicKey(key, project, home);
process.env.SUPABASE_URL = project;
const fields = { projectUrl: project, householdId: home, userId: user, records: [{ recordKey: 'hour/2026-10-01', expectedRevision: 0, envelope: crypto.sealVault({ recordKey: 'hour/2026-10-01', payload: { v: 1, points: [] } }, key, randomBytes(24), home, 1) }] };
const signed = signing.signElectricityRecordsWrite(fields, key);
assert.equal(signed.publicKey, publicKey); assert.ok(signing.verifyElectricityRecordsWrite(signed));
const message = [signing.ELECTRICITY_RECORD_PROTOCOL, project, home, user, publicKey,
  fields.records[0].recordKey, '0', fields.records[0].envelope.format, fields.records[0].envelope.nonce,
  createHash('sha256').update(Buffer.from(fields.records[0].envelope.ciphertext, 'hex')).digest('hex')].join('\n');
const nodePublic = createPublicKey({ key: Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(publicKey, 'hex')]), format: 'der', type: 'spki' });
assert.equal(verify(null, Buffer.from(message), nodePublic, Buffer.from(signed.signature, 'hex')), true, 'Independent Node/OpenSSL record signature verification');
for (const mutate of [x => x.records[0].recordKey = 'hour/2026-10-02', x => x.records[0].expectedRevision++, x => x.householdId = randomUUID(), x => x.userId = randomUUID(), x => x.records[0].envelope.ciphertext = '00' + x.records[0].envelope.ciphertext.slice(2)]) {
  const bad = clone(signed); mutate(bad); assert.equal(signing.verifyElectricityRecordsWrite(bad), false);
}
for (const bad of ['hour/2026-02-30', 'hour/2026-99-01', 'day/2026-00', 'month/2026-10', 'year/1999', '../anything', null]) assert.equal(signing.validElectricityRecordKey(bad), false);
assert.throws(() => signing.signElectricityRecordsWrite({ ...fields, records: [fields.records[0], fields.records[0]] }, key));
assert.equal(signing.verifyVaultWrite(signed), false, 'No cross-protocol signature reuse');

const phoneCache = new Map(), cloud = new Map(), root = new Map(), versions = new Map();
const meter = { id: 'fixture-meter', metering_point_id: '123456789012345678' };
const snapshot = { version: 1, agreements: [], meters: [meter], readings: [] };
root.set(home, { household_id: home, revision: 1, envelope: crypto.sealVault(snapshot, key, randomBytes(24), home, 1) });
let member = true, pinned = publicKey, offline = false, beforeSave, writes = [], queries = [];
let now = Date.parse('2026-10-14T15:15:00Z');
const clock = class extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } };
const db = {
  auth: { getSession: async () => ({ data: { session: { user: { id: user }, access_token: 'synthetic-session' } } }) },
  from(table) {
    const filters = [], selected = [];
    const result = () => {
      if (offline) throw new Error('offline');
      queries.push({ table, keys: [...selected] });
      const rows = table === 'household_members' ? member ? [{ household_id: home, user_id: user }] : [] : [...(table === 'energy_vaults' ? root : cloud).values()];
      return rows.filter(row => filters.every(filter => filter(row))).map(clone);
    };
    const q = { select() { return q; }, eq(field, value) { filters.push(row => row[field] === value); return q; },
      in(field, values) { selected.push(...values); filters.push(row => values.includes(row[field])); return q; },
      maybeSingle: async () => ({ data: result()[0] ?? null, error: null }),
      then(resolve, reject) { return Promise.resolve().then(() => ({ data: result(), error: null })).then(resolve, reject); } };
    return q;
  },
  async rpc(name, args) {
    assert.equal(name, 'commit_electricity_period_records');
    if (beforeSave) { const callback = beforeSave; beforeSave = undefined; await callback(); }
    if (!member) return { error: { message: 'No household access' } };
    if (!pinned) return { error: { message: 'legacy_write_locked' } };
    if (args.p_public_key !== pinned) return { error: { message: 'writer_key_mismatch' } };
    if (args.p_records.some(record => (cloud.get(record.recordKey)?.revision ?? 0) !== record.expectedRevision)) return { error: { message: 'electricity_revision_conflict' } };
    const rows = args.p_records.map(record => ({ household_id: home, record_key: record.recordKey, revision: record.expectedRevision + 1, envelope: { ciphertext: record.envelope.ciphertext, nonce: record.envelope.nonce, format: record.envelope.format } }));
    for (const row of rows) { cloud.set(row.record_key, clone(row)); versions.set(`${row.record_key}/${row.revision}`, clone(row)); }
    return { data: rows };
  },
};
const context = async (_, options) => {
  assert.deepEqual(options, { auth: 'user', audience: 'authenticated', issuer: `${project}/auth/v1` });
  return { data: { userClaims: { id: user }, supabase: db, supabaseAdmin: db } };
};
const request = new Request('https://synthetic.invalid/api/energy/vault', { method: 'POST', headers: { authorization: 'Bearer synthetic-session' } });
assert.equal((await electricityRecordWriteResponse(new Request(request.url, { method: 'POST' }), signed, context)).status, 401);
const tampered = clone(signed); tampered.records[0].recordKey = 'hour/2026-10-02';
assert.equal((await electricityRecordWriteResponse(request, tampered, context)).status, 403);
member = false; assert.equal((await electricityRecordWriteResponse(request, signed, context)).status, 403); member = true;
pinned = null; assert.equal((await electricityRecordWriteResponse(request, signed, context)).status, 409); pinned = publicKey;

const fetchRecord = async (url, options) => {
  assert.equal(url, 'https://synthetic.invalid/api/energy/vault');
  const body = JSON.parse(options.body);
  assert.equal(body.operation, 'electricity-records', 'No electricity imports may write the whole root snapshot');
  assert.ok(signing.verifyElectricityRecordsWrite(body.write));
  writes.push(clone(body));
  const result = await electricityRecordWriteResponse(new Request(url, { method: 'POST', headers: options.headers }), body.write, context);
  return { ok: result.status === 200, status: result.status, json: async () => result.body };
};
const storage = { getItem: async name => phoneCache.get(name) ?? null, setItem: async (name, value) => phoneCache.set(name, value), getAllKeys: async () => [...phoneCache.keys()], removeItem: async name => phoneCache.delete(name) };
const load = (file, dependencies, fetcher = fetchRecord, timers = setTimeout) => {
  const output = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports,fetch,Date,setTimeout){${output}\n})`)(name => {
    assert.ok(name in dependencies, `${file}: ${name}`); return dependencies[name];
  }, module, module.exports, fetcher, clock, timers);
  return module.exports;
};
const { EnergyVault } = load('../src/services/energy-vault.ts', {
  '@react-native-async-storage/async-storage': { default: storage }, 'expo-crypto': { getRandomBytesAsync: async length => new Uint8Array(randomBytes(length)) },
  'expo-secure-store': {}, 'react-native': { Platform: { OS: 'android' } },
  './supabase': { getSupabase: async () => db, getSupabaseProjectUrl: async () => project, API_URL: 'https://synthetic.invalid' },
  './vault-crypto.mjs': crypto, './vault-signing.mjs': signing, './electricity-cache.mjs': cache,
  './local-storage-cache.mjs': localStorageCache,
});
const open = async () => { const vault = new EnergyVault(home, user); await vault.unlock(crypto.recoveryKey(key)); return vault; };
let vault = await open();
await vault.mutateElectricityRecords(['year/2024'], () => ({ 'year/2024': { v: 1, points: [{ at: consumption.midnight('2024-01-01'), kwh: 100, incomplete: false }] } }));
assert.ok(!JSON.stringify([...cloud.values()]).includes('kwh'));
assert.ok(!JSON.stringify([...phoneCache.values()]).includes('kwh'));
const oldBody = writes.at(-1).write;
assert.equal((await electricityRecordWriteResponse(request, oldBody, context)).body.code, 'ELECTRICITY_REVISION_CONFLICT');
const otherPhone = await open();
beforeSave = async () => { await otherPhone.mutateElectricityRecords(['year/2024'], latest => ({ 'year/2024': { ...latest['year/2024'], points: [...latest['year/2024'].points, { at: 'synthetic-concurrent', kwh: 7 }] } })); };
await vault.mutateElectricityRecords(['year/2024'], latest => ({ 'year/2024': { ...latest['year/2024'], ownUpdate: true } }));
assert.equal(vault.cachedElectricityRecord('year/2024').points.length, 2, 'CAS retry merges a concurrent device update');
assert.equal(vault.cachedElectricityRecord('year/2024').ownUpdate, true);
const current = clone(cloud.get('year/2024'));
cloud.set('year/2024', { ...current, record_key: 'year/2024', envelope: signed.records[0].envelope, revision: 1 });
await assert.rejects(vault.loadElectricityRecords(['year/2024'], true), /ældre/);
cloud.set('year/2024', current);
cloud.set('hour/2026-10-02', { household_id: home, record_key: 'hour/2026-10-02', revision: 1, envelope: signed.records[0].envelope });
await assert.rejects(vault.loadElectricityRecords(['hour/2026-10-02'], true), /anden periode/, 'Ciphertext cannot move between record keys at the same revision');
cloud.delete('hour/2026-10-02');
const history = load('../src/services/electricity-history.ts', {
  'expo-crypto': { getRandomBytesAsync: async length => new Uint8Array(randomBytes(length)) },
  './consumption-data.mjs': consumption, './electricity-cache.mjs': cache, './electricity-periods.mjs': periods,
}, fetchRecord, (fn, ms) => ms === 1000 ? setTimeout(fn, 0) : setTimeout(fn, ms));
const apiCalls = [];
let failRequest = Infinity, providerRequests = 0;
const provider = async body => {
  apiCalls.push(clone(body));
  if (body.action === 'history') return { meters: [{ metering_point_id: meter.metering_point_id, from: '2026-08-01', to: null }] };
  assert.equal(body.action, 'timeseries'); assert.equal(body.aggregation, 'Hour');
  if (++providerRequests === failRequest) throw new Error('synthetic provider outage');
  return { result: [{ success: true, MyEnergyData_MarketDocument: { TimeSeries: [{ businessType: 'A04', 'MarketEvaluationPoint.mRID': { name: meter.metering_point_id }, 'measurement_Unit.name': 'KWH', Period: [{ resolution: 'PT1H', timeInterval: { start: consumption.midnight(body.from), end: consumption.midnight(body.to) }, Point: consumption.expectedIntervals(body.from, body.to, 'hour').map((_, index) => ({ position: index + 1, 'out_Quantity.quantity': 1 })) }] }] } }] };
};
const monthView = { from: '2026-01-01', to: '2027-01-01', aggregation: 'Month' };
await Promise.all([history.readElectricityPeriods(vault, [monthView]), history.readElectricityPeriods(vault, [monthView])]);
history.startElectricityHistory(vault, provider);
await history.waitForElectricityHistory(vault);
await new Promise(resolve => setImmediate(resolve));
assert.equal(apiCalls.filter(call => call.action === 'history').length, 1);
assert.equal(apiCalls.filter(call => call.action === 'timeseries').length, 3);
assert.equal(vault.cachedElectricityRecord('state/import').meters[0].cursor, '2026-08-01');
assert.equal(vault.cachedElectricityRecord('state/import').meters[0].importedTo, '2026-10-14');
const points = history.storedElectricityPoints(vault, monthView, '2026-10-14');
assert.equal(points[7].kwh, 31 * 24); assert.equal(points[7].incomplete, false);
assert.equal(points[8].kwh, 30 * 24); assert.equal(points[9].kwh, 13 * 24); assert.equal(points[9].incomplete, true);
assert.deepEqual(vault.data.readings, [], 'Historical imports do not grow the root snapshot');
const callCount = apiCalls.length, writeCount = writes.length;
queries = [];
await history.readElectricityPeriods(vault, [monthView]);
history.startElectricityHistory(vault, provider); await history.waitForElectricityHistory(vault); await new Promise(resolve => setImmediate(resolve));
assert.equal(apiCalls.length, callCount); assert.equal(writes.length, writeCount); assert.equal(queries.length, 0, 'Cached charts and up-to-date history make no DB or provider calls');
const dayView = { from: '2026-09-01', to: '2026-10-01', aggregation: 'Day' };
const hourView = { from: '2026-09-12', to: '2026-09-13', aggregation: 'Hour' };
vault.close(); vault = await open(); queries = [];
await history.readElectricityPeriods(vault, [monthView]);
assert.equal(queries.length, 0, 'New session uses independently cached summary records');
assert.equal(vault.cachedElectricityRecord('hour/2026-09-12'), undefined, 'Monthly view does not load hourly history');
await history.readElectricityPeriods(vault, [dayView, hourView]);
assert.equal(queries.length, 0); assert.equal(history.storedElectricityPoints(vault, hourView, '2026-10-14').length, 24);
vault.close();
for (const name of [...phoneCache.keys()]) if (name.includes('.period.')) phoneCache.delete(name);
vault = await open(); queries = [];
await history.readElectricityPeriods(vault, [monthView]);
assert.deepEqual(queries.filter(query => query.table === 'electricity_period_records').flatMap(query => query.keys).sort(), ['month/2026', 'state/import']);
assert.equal(apiCalls.length, callCount, 'Cold cache reads requested DB periods, never provider history');
const oldHourRevision = cloud.get('hour/2026-10-13').revision;
now = Date.parse('2026-10-15T15:15:00Z');
history.startElectricityHistory(vault, provider); await history.waitForElectricityHistory(vault); await new Promise(resolve => setImmediate(resolve));
assert.deepEqual(apiCalls.at(-1), { action: 'timeseries', meteringPointId: meter.metering_point_id, from: '2026-10-14', to: '2026-10-15', aggregation: 'Hour' });
assert.equal(apiCalls.length, callCount + 1, 'Only the newly available day is fetched');
assert.equal(cloud.get('hour/2026-10-13').revision, oldHourRevision);
assert.equal(history.storedElectricityPoints(vault, monthView, '2026-10-15')[9].kwh, 14 * 24);
offline = true; const cachedPoints = history.storedElectricityPoints(vault, monthView, '2026-10-15');
await history.readElectricityPeriods(vault, [monthView]);
assert.deepEqual(history.storedElectricityPoints(vault, monthView, '2026-10-15'), cachedPoints); offline = false;
assert.ok([...phoneCache.values()].every(value => !value.includes('kwh') && !value.includes('fixture-meter')));

// A partially completed historical import resumes without repeating saved days.
vault.close(); otherPhone.close();
cloud.clear(); versions.clear();
for (const name of [...phoneCache.keys()]) if (name.includes('.period.')) phoneCache.delete(name);
now = Date.parse('2026-10-14T15:15:00Z'); apiCalls.length = 0; providerRequests = 0; failRequest = 2;
vault = await open();
await history.readElectricityPeriods(vault, [monthView]);
history.startElectricityHistory(vault, provider);
await assert.rejects(history.waitForElectricityHistory(vault), /synthetic provider outage/);
await new Promise(resolve => setImmediate(resolve));
const completed = [...cloud.values()].filter(row => row.record_key.startsWith('hour/')).map(row => [row.record_key, row.revision]);
assert.equal(completed.length, 31);
assert.equal(vault.cachedElectricityRecord('state/import').meters[0].cursor, '2026-09-13');
assert.match(history.electricityImportStatus(vault).error, /provider outage/);
vault.close(); vault = await open(); apiCalls.length = 0; failRequest = Infinity;
await history.readElectricityPeriods(vault, [monthView]);
history.startElectricityHistory(vault, provider); await history.waitForElectricityHistory(vault); await new Promise(resolve => setImmediate(resolve));
assert.equal(apiCalls.filter(call => call.action === 'history').length, 0, 'Import bounds/state survive restart');
assert.equal(apiCalls.filter(call => call.action === 'timeseries').length, 2, 'Only unfinished historical batches are fetched');
for (const [key, revision] of completed) assert.equal(cloud.get(key).revision, revision);

// Cloud state from another device prevents duplicate daily provider retrieval.
const second = await open(); await history.readElectricityPeriods(second, [monthView]);
now = Date.parse('2026-10-15T15:15:00Z');
history.startElectricityHistory(vault, provider); await history.waitForElectricityHistory(vault); await new Promise(resolve => setImmediate(resolve));
const beforeSecond = apiCalls.length;
history.startElectricityHistory(second, provider); await history.waitForElectricityHistory(second); await new Promise(resolve => setImmediate(resolve));
assert.equal(apiCalls.length, beforeSecond);
assert.equal(history.storedElectricityPoints(second, monthView, '2026-10-15')[9].kwh, 14 * 24, 'Fresh cloud summaries are loaded when another device advanced the import');
// Simultaneous devices contend for a signed lease before any provider request.
now = Date.parse('2026-10-16T15:15:00Z');
const beforeParallel = apiCalls.length;
history.startElectricityHistory(vault, provider);
history.startElectricityHistory(second, provider);
await Promise.all([history.waitForElectricityHistory(vault), history.waitForElectricityHistory(second)]);
await new Promise(resolve => setImmediate(resolve));
assert.equal(apiCalls.length, beforeParallel + 1, 'A concurrent second device must not fetch the same new day');
history.startElectricityHistory(second, provider); await history.waitForElectricityHistory(second); await new Promise(resolve => setImmediate(resolve));
assert.equal(apiCalls.length, beforeParallel + 1);
assert.equal(history.storedElectricityPoints(second, monthView, '2026-10-16')[9].kwh, 15 * 24);
second.close(); vault.close();

// Existing hourly snapshot data migrates once, without root deletion or refetch.
cloud.clear(); versions.clear();
for (const name of [...phoneCache.keys()]) if (name.includes('.period.')) phoneCache.delete(name);
const legacySnapshot = { ...snapshot, readings: consumption.expectedIntervals('2026-10-13', '2026-10-14', 'hour').map(interval => ({ ...interval, meter_id: meter.id, resolution: 'hour', kwh: 1 })) };
root.set(home, { household_id: home, revision: 2, envelope: crypto.sealVault(legacySnapshot, key, randomBytes(24), home, 2) });
now = Date.parse('2026-10-14T15:15:00Z'); apiCalls.length = 0;
vault = await open();
const legacyProvider = async body => body.action === 'history' ? (apiCalls.push(body), { meters: [{ metering_point_id: meter.metering_point_id, from: '2026-10-13', to: null }] }) : provider(body);
history.startElectricityHistory(vault, legacyProvider); await history.waitForElectricityHistory(vault); await new Promise(resolve => setImmediate(resolve));
assert.equal(apiCalls.filter(call => call.action === 'timeseries').length, 0);
assert.equal(vault.data.readings.length, 24);
assert.equal(vault.cachedElectricityRecord('hour/2026-10-13').meters[meter.id].values.length, 24);
assert.equal(vault.cachedElectricityRecord('state/import').legacyComplete, true);
assert.equal(history.storedElectricityPoints(vault, { from: '2026-10-13', to: '2026-10-14', aggregation: 'Hour' }, '2026-10-14').reduce((sum, point) => sum + point.kwh, 0), 24);
for (const [day, count] of [['2026-03-29', 23], ['2026-10-25', 25]]) {
  const intervals = consumption.expectedIntervals(day, consumption.advance(day, 'day'), 'hour');
  const rows = intervals.map(interval => ({ ...interval, meter_id: meter.id, kwh: 1 }));
  const updated = periods.mergeDayRecords({}, day, rows, [{ id: meter.id, from: '2021-01-01', to: null }], [meter.id], now);
  assert.equal(updated[`hour/${day}`].meters[meter.id].values.length, count);
  assert.equal(updated[`day/${day.slice(0, 7)}`].points[0].kwh, count);
  assert.equal(updated[`day/${day.slice(0, 7)}`].points[0].incomplete, false);
}
console.log('PASS: independent record signatures, key/context tampering, pinned-writer gateway, replay/CAS conflicts, encrypted per-period phone cache, one-time all-history import, targeted month/day/hour reads, daily-only provider updates and offline reuse. Synthetic I/O plus separate real-dev SQL tests.');
