import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { nextElectricitySyncAt } from '../src/services/electricity-cache.mjs';

const effects = [], values = [], timers = new Map();
let reads = 0, imports = 0, listener, unsubscribed = false;
const cached = selection => ({ ...selection, points: [{ at: '2026-10-01T22:00:00Z', kwh: 42, incomplete: false }], totalKwh: 42, availableYears: [2026], meterCount: 1, incomplete: false });
const dependencies = {
  react: { useCallback: fn => fn, useRef: value => ({ current: value }), useEffect: effect => effects.push(effect), useState: value => {
    const index = values.length; values.push(value); return [value, next => values[index] = typeof next === 'function' ? next(values[index]) : next];
  } },
  'react-native': { AppState: { addEventListener: () => ({ remove() {} }) } },
  './useHouseholdSession': { useHouseholdSession: () => ({ householdId: 'synthetic' }) },
  '../utils/usagePeriods': { usageToday: () => '2026-10-14', usagePeriod: (aggregation, from) => ({ aggregation, from: from.slice(0, 7) + '-01', to: '2026-11-01' }) },
  './useElectricityAgreements': { useElectricityAgreements: () => ({ records: [] }) },
  '../components/EnergyVaultGate': { useEnergyVault: () => ({ data: { meters: [] } }) },
  './useDashboardViewState': { useDashboardViewState: () => ({ electricAggregation: 'Day', electricAnchor: '2026-10-14', setElectricAggregation() {}, setElectricAnchor() {} }) },
  '../services/private-electricity': {
    cachedPrivateUsage: (_, selection) => cached(selection),
    loadPrivateUsageBatch: async (_, selections) => { reads++; return selections.map(cached); },
    privateUsageBatch: async (_, selections) => { imports++; return selections.map(cached); },
    privateUsage: async (_, selection) => cached(selection),
    subscribePrivateElectricity: (_, callback) => { listener = callback; return () => { unsubscribed = true; listener = null; }; },
    privateImportStatus: () => ({ running: false, error: '', initialComplete: true }),
  },
  './useMeterConnection': { useMeterConnection: () => ({ connected: null, error: '', refresh() {} }) },
  '../services/electricity-cache.mjs': { nextElectricitySyncAt },
};
const js = ts.transpileModule(readFileSync(new URL('../src/hooks/useElectricityUsage.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const mod = { exports: {} };
vm.runInThisContext(`(function(require,module,exports,setTimeout,clearTimeout){${js}\n})`)(name => {
  assert.ok(name in dependencies, name); return dependencies[name];
}, mod, mod.exports, (fn, ms) => { const id = timers.size + 1; timers.set(id, { fn, ms }); return id; }, id => timers.delete(id));
mod.exports.useElectricityUsage(true);
const cleanup = effects.map(effect => effect()).filter(Boolean);
assert.ok(values.some(value => value?.totalKwh === 42), 'Saved charts are published before network status');
assert.equal(reads, 1); assert.equal(imports, 0, 'Unverified/offline connections load saved periods without starting provider imports');
listener();
cleanup.forEach(fn => fn());
await new Promise(resolve => setImmediate(resolve));
assert.ok(unsubscribed); assert.equal(timers.size, 0);
console.log('PASS: actual usage hook publishes cached period charts before connection status, uses read-only loading offline and cleans up import subscriptions/timers. Synthetic React/platform.');
