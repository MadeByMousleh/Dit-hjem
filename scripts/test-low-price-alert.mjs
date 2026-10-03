import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/services/low-price-alert.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
const storage = new Map();
const scheduled = [];
let notificationId = 0;
const notifications = {
  SchedulableTriggerInputTypes: { DATE: 'date' },
  AndroidImportance: { DEFAULT: 3 },
  IosAuthorizationStatus: { PROVISIONAL: 3 },
  getAllScheduledNotificationsAsync: async () => [...scheduled],
  cancelScheduledNotificationAsync: async (identifier) => {
    const index = scheduled.findIndex((request) => request.identifier === identifier);
    if (index >= 0) scheduled.splice(index, 1);
  },
  scheduleNotificationAsync: async (request) => {
    const identifier = `notification-${++notificationId}`;
    scheduled.push({ ...request, identifier });
    return identifier;
  },
  setNotificationChannelAsync: async () => {},
};
vm.runInThisContext(`(function(require,module,exports){${output}\n})`)(name => {
  if (name === 'expo') return { isRunningInExpoGo: () => false };
  if (name === 'expo-notifications') return notifications;
  if (name === '@react-native-async-storage/async-storage') return { default: { getItem: async (key) => storage.get(key) ?? null, setItem: async (key, value) => storage.set(key, value) } };
  if (name === 'react-native') return { Platform: { OS: 'ios' } };
  throw new Error(`Unexpected import ${name}`);
}, module, module.exports);

const { findLowPriceWindow, findHighPricePoint, findBestChargingWindow, consumptionBudgetProgress, scheduleLowPriceAlert } = module.exports;
const now = Date.parse('2026-10-01T10:00:00.000Z');
const point = (hour, ore) => ({ startsAt: new Date(Date.parse(`2026-10-01T${String(hour).padStart(2, '0')}:00:00.000Z`)), totalOrePerKwh: ore, priceDkkMwh: ore * 10, gridAndTaxOrePerKwh: 50 });

const window = findLowPriceWindow([
  point(11, 100), point(12, 100), point(13, 230), point(14, 230), point(15, 230), point(16, 230),
], now, 150);
assert.ok(window);
assert.equal(window.startsAt.toISOString(), '2026-10-01T11:00:00.000Z');
assert.equal(window.endsAt.toISOString(), '2026-10-01T13:00:00.000Z');
assert.equal(window.lowestOrePerKwh, 100);

assert.equal(findLowPriceWindow([
  point(11, 100), point(12, 230), point(13, 230), point(14, 230), point(15, 230),
], now, 150), null);
assert.equal(findLowPriceWindow([
  point(10, 100), point(11, 100), point(12, 230), point(13, 230), point(14, 230),
], now, 150), null);

const high = findHighPricePoint([point(10, 110), point(11, 275), point(12, 160)], now, 250);
assert.ok(high);
assert.equal(high.startsAt.toISOString(), '2026-10-01T11:00:00.000Z');
assert.equal(high.orePerKwh, 275);
assert.equal(findHighPricePoint([point(10, 200), point(11, 240), point(12, 230)], now, 250), null);

const charging = findBestChargingWindow([
  point(11, 210), point(12, 220), point(13, 230), point(14, 240), point(15, 250), point(16, 260),
  point(17, 180), point(18, 170), point(19, 160), point(20, 150), point(21, 140), point(22, 130),
], now, 6, 1);
assert.ok(charging);
assert.equal(charging.startsAt.toISOString(), '2026-10-01T17:00:00.000Z');
assert.equal(charging.endsAt.toISOString(), '2026-10-01T23:00:00.000Z');
assert.equal(findBestChargingWindow([point(17, 100), point(18, 100)], now, 6, 1), null);

const budget = consumptionBudgetProgress({ dailyKwh: [12, 10, 11], daysElapsed: 3, daysInMonth: 30, unit: 'kwh', limit: 300, estimatedOrePerKwh: 200 });
assert.equal(budget?.actual, 33);
assert.equal(budget?.forecast, 330);
assert.equal(budget?.level, '100');
assert.equal(consumptionBudgetProgress({ dailyKwh: [8, 8, 8], daysElapsed: 3, daysInMonth: 30, unit: 'dkk', limit: 600, estimatedOrePerKwh: 200 })?.level, '80');

const actualNow = Date.now;
Date.now = () => now;
try {
  // Dashboard renders can overlap while fresh prices arrive. Both requests must
  // resolve to the same single scheduled notification, not two copies.
  await Promise.all([
    scheduleLowPriceAlert([point(11, 100), point(12, 100), point(13, 230), point(14, 230)]),
    scheduleLowPriceAlert([point(11, 100), point(12, 100), point(13, 230), point(14, 230)]),
  ]);
  assert.equal(scheduled.length, 1);

  // Once today's notification was delivered, a dashboard refresh may not send
  // another low-price notification for that same local calendar day.
  scheduled.length = 0;
  await scheduleLowPriceAlert([point(11, 100), point(12, 100), point(13, 230), point(14, 230)]);
  assert.equal(scheduled.length, 0);
} finally {
  Date.now = actualNow;
}

console.log('PASS: price alerts, charging windows, daily notification deduplication and monthly consumption-budget thresholds are calculated correctly.');
