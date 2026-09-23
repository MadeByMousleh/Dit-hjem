import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

let now = Date.parse('2026-09-22T12:00:00Z');
let calls = 0;
let fail = false;
class Clock extends Date { static now() { return now; } }
const exports = {};
const disk = new Map();
const code = ts.transpileModule(readFileSync(new URL('../src/prices.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const context = { exports, Date: Clock, URLSearchParams, AbortController, setTimeout, clearTimeout,
  require: name => {
    assert.equal(name, '@react-native-async-storage/async-storage');
    return { default: { getItem: async key => disk.get(key) ?? null, setItem: async (key, value) => { disk.set(key, value); } } };
  },
  fetch: async () => {
    calls++;
    if (fail) throw new Error('offline');
    return { ok: true, json: async () => ({ prices: [{ date: new Date(now).toISOString(), price: {total: 2}, details: {electricity: {total: 1}} }] }) };
  },
};
vm.runInNewContext(code, context);
const { fetchPrices, getCachedPrices } = exports;
const [a, b] = await Promise.all([fetchPrices('DK1', 'n1_c'), fetchPrices('DK1', 'n1_c')]);
assert.equal(calls, 1, 'concurrent requests share one fetch');
assert.equal(a, b);
assert.equal(await fetchPrices('DK1', 'n1_c'), a);
assert.equal(calls, 1, 'reopening uses cached data');
assert.equal(a[0].totalOrePerKwh, 200);
await fetchPrices('DK2', 'radius_c');
assert.equal(calls, 2, 'different suppliers have separate entries');
await fetchPrices('DK1', 'n1_c', true);
assert.equal(calls, 3, 'manual refresh bypasses cache');
now += 15 * 60 * 1000;
assert.equal(getCachedPrices('DK1', 'n1_c'), undefined);
fail = true;
await assert.rejects(fetchPrices('DK1', 'n1_c'));
fail = false;
await fetchPrices('DK1', 'n1_c');
assert.equal(calls, 5, 'failed request does not prevent retry');
assert.ok(getCachedPrices('DK1', 'n1_c'));
const restarted = {};
vm.runInNewContext(code, { ...context, exports: restarted });
const restored = await restarted.fetchPrices('DK1', 'n1_c');
assert.equal(calls, 5, 'cold restart loads valid public disk cache without network');
assert.equal(typeof restored[0].startsAt.getTime(), 'number');
disk.set('stromblik.public-prices.v1.DK2:broken', '{invalid');
await restarted.fetchPrices('DK2', 'broken');
assert.equal(calls, 6, 'corrupt disk cache recovers through network');
console.log('PASS: price cache, concurrent request deduplication, supplier isolation, expiry, manual refresh and retry.');
