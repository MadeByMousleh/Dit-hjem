import assert from 'node:assert/strict';
import * as cache from '../src/services/electricity-cache.mjs';
import * as consumption from '../src/services/consumption-data.mjs';

const { advance, expectedIntervals, midnight } = consumption;
const meter = { id: 'one', metering_point_id: '123456789012345678' };
const empty = () => ({ version: 1, meters: [meter], readings: [], agreements: [] });
const rows = (from, to, kwh = 1, id = meter.id) => expectedIntervals(from, to, 'hour').map(interval => ({ ...interval, meter_id: id, resolution: 'hour', kwh }));
const selection = (from, to, aggregation = 'Day') => ({ from, to, aggregation });
const today = '2026-10-14';
let now = Date.parse('2026-10-14T15:15:00Z'); // 17:15 Copenhagen

for (const [day, count] of [['2026-03-29', 23], ['2026-10-25', 25]]) {
  const data = { ...empty(), readings: rows(day, advance(day, 'day')) };
  cache.materializeElectricityCache(data);
  const points = cache.cachedElectricityPoints(data, day, advance(day, 'day'), 'day', '2027-01-01');
  assert.deepEqual(points, [{ at: midnight(day), kwh: count, incomplete: false }]);
  assert.equal(cache.completeHourlyDay(data, meter.id, day), true);
  assert.equal(cache.cachedElectricityPoints(data, day, advance(day, 'day'), 'hour', '2027-01-01').length, count);
}
const october = { ...empty(), readings: rows('2026-10-01', '2026-11-01', 0.0004) };
assert.equal(new Date(cache.nextElectricitySyncAt(Date.parse('2026-03-29T00:00:00Z'))).toISOString(), '2026-03-29T15:00:00.000Z');
assert.equal(new Date(cache.nextElectricitySyncAt(Date.parse('2026-10-25T00:00:00Z'))).toISOString(), '2026-10-25T16:00:00.000Z');
assert.equal(new Date(cache.nextElectricitySyncAt(Date.parse('2026-10-14T15:00:00Z'))).toISOString(), '2026-10-15T15:00:00.000Z');
cache.materializeElectricityCache(october);
const monthly = cache.cachedElectricityPoints(october, '2026-10-01', '2026-11-01', 'month', '2027-01-01');
assert.equal(monthly[0].kwh, Math.round(october.readings.length * 0.0004 * 1000) / 1000, 'Do not compound daily rounding');
assert.equal(monthly[0].incomplete, false);
const restored = JSON.parse(JSON.stringify(october));
assert.deepEqual(cache.cachedElectricityPoints(restored, '2026-10-01', '2026-11-01', 'month', '2027-01-01'), monthly, 'Persisted summaries survive restart');
assert.ok(restored.electricity_cache.summaries.some(row => row.resolution === 'day'));
assert.ok(restored.electricity_cache.summaries.some(row => row.resolution === 'month'));
const source = { ...empty(), readings: rows('2026-10-01', '2026-10-02', 0) };
source.readings[4].kwh = null;
cache.materializeElectricityCache(source);
assert.deepEqual(cache.cachedElectricityPoints(source, '2026-10-01', '2026-10-02', 'day', today), [{ at: midnight('2026-10-01'), kwh: 0, incomplete: true }]);
source.readings[4].kwh = 5;
const changed = JSON.parse(JSON.stringify(source)); // Older-client write retaining stale summaries.
assert.deepEqual(cache.cachedElectricityPoints(changed, '2026-10-01', '2026-10-02', 'day', today), [{ at: midnight('2026-10-01'), kwh: 5, incomplete: false }]);
const legacy = { ...empty(), readings: [{ meter_id: meter.id, resolution: 'day', starts_at: midnight('2026-10-01'), ends_at: midnight('2026-10-02'), kwh: 42 }] };
assert.equal(cache.cachedElectricityPoints(legacy, '2026-10-01', '2026-10-02', 'day', today)[0].kwh, 42);
assert.equal(cache.completeHourlyDay(legacy, meter.id, '2026-10-01'), false, 'Coarse history must not pretend hours are cached');
const partialYear = { ...empty(), readings: [{ meter_id: meter.id, resolution: 'year', starts_at: midnight('2024-07-01'), ends_at: midnight('2025-01-01'), kwh: 100 }] };
assert.deepEqual(cache.cachedElectricityPoints(partialYear, '2024-01-01', '2025-01-01', 'year', today), [{ at: midnight('2024-01-01'), kwh: 100, incomplete: true }]);
let sourceReads = 0;
const indexed = { ...empty(), get readings() { sourceReads++; return october.readings; } };
cache.cachedElectricityPoints(indexed, '2026-10-01', '2026-11-01', 'month', today);
const beforeReads = sourceReads;
for (let i = 0; i < 20; i++) cache.cachedElectricityPoints(indexed, '2026-10-01', '2026-11-01', 'month', today);
assert.equal(sourceReads, beforeReads, 'Repeated charts use indexed summaries, not full-history scans');

console.log('PASS: legacy snapshot summary compatibility, DST, precision, missing/zero distinction and indexed reads. Period-record import/sync is tested in test-electricity-records.mjs.');
