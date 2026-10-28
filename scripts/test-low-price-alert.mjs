import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/services/low-price-alert.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
const storage = new Map();
const scheduled = [];
const presented = [];
const calls = [];
let storagePause, schedulePause;
let cancellationFails = false;
let notificationId = 0;
const notifications = {
  SchedulableTriggerInputTypes: { DATE: 'date' },
  AndroidImportance: { DEFAULT: 3 },
  IosAuthorizationStatus: { PROVISIONAL: 3 },
  getAllScheduledNotificationsAsync: async () => [...scheduled],
  cancelScheduledNotificationAsync: async (identifier) => {
    if (cancellationFails) throw Error('Synthetic cancellation failure');
    const index = scheduled.findIndex((request) => request.identifier === identifier);
    if (index >= 0) scheduled.splice(index, 1);
  },
  scheduleNotificationAsync: async (request) => {
    const identifier = `notification-${++notificationId}`;
    const item = {...request, identifier};
    calls.push(item);
    if (request.trigger === null) presented.push({request:item}); else scheduled.push(item);
    if (schedulePause) { const gate=schedulePause;schedulePause=null;gate.enter();await gate.wait; }
    return identifier;
  },
  setNotificationChannelAsync: async () => {},
  getPresentedNotificationsAsync: async () => [...presented],
  dismissNotificationAsync: async identifier => { const i=presented.findIndex(n=>n.request.identifier===identifier);if(i>=0)presented.splice(i,1); },
  getLastNotificationResponseAsync: async () => null,
  clearLastNotificationResponseAsync: async () => {},
};
let sessionModule;
const requireMock = name => {
  if (name === 'expo') return { isRunningInExpoGo: () => false };
  if (name === 'expo-notifications') return notifications;
  if (name === '@react-native-async-storage/async-storage') return { default: { getItem: async (key) => { if(storagePause){const gate=storagePause;storagePause=null;gate.enter();await gate.wait;}return storage.get(key) ?? null; }, setItem: async (key, value) => storage.set(key, value) } };
  if (name === 'react-native') return { Platform: { OS: 'ios' } };
  if (name === './notification-session') return sessionModule.exports;
  throw new Error(`Unexpected import ${name}`);
};
sessionModule={exports:{}};
const sessionOutput=ts.transpileModule(readFileSync(new URL('../src/services/notification-session.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
vm.runInThisContext(`(function(require,module,exports){${sessionOutput}\n})`)(requireMock,sessionModule,sessionModule.exports);
vm.runInThisContext(`(function(require,module,exports){${output}\n})`)(requireMock,module,module.exports);
const{setNotificationSession,clearNotificationSession,withNotificationSession}=sessionModule.exports;
const owner=setNotificationSession('user-a','home-a');

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
    scheduleLowPriceAlert(owner,[point(11, 100), point(12, 100), point(13, 230), point(14, 230)]),
    scheduleLowPriceAlert(owner,[point(11, 100), point(12, 100), point(13, 230), point(14, 230)]),
  ]);
  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0].content.data.userId,'user-a');assert.equal(scheduled[0].content.data.householdId,'home-a');

  // Once today's notification was delivered, a dashboard refresh may not send
  // another low-price notification for that same local calendar day.
  scheduled.length = 0;
  Date.now=()=>now+3600000;
  await scheduleLowPriceAlert(owner,[point(14, 100), point(15, 100), point(16, 230), point(17, 230)]);
  assert.equal(scheduled.length, 0);
} finally {
  Date.now = actualNow;
}

console.log('PASS: price alerts, charging windows, daily notification deduplication and monthly consumption-budget thresholds are calculated correctly.');

const budgetArgs={progress:{actual:330,forecast:330,percentage:110,level:'100'},unit:'kwh',limit:300,monthKey:'2026-10'};
await Promise.all([module.exports.sendConsumptionBudgetAlert({owner,...budgetArgs}),module.exports.sendConsumptionBudgetAlert({owner,...budgetArgs})]);
assert.equal(calls.filter(n=>n.content.data.kind==='consumption-budget-alert').length,1,'Concurrent budget checks deduplicate');
const ownerB=setNotificationSession('user-b','home-a');await module.exports.sendConsumptionBudgetAlert({owner:ownerB,...budgetArgs});
assert.equal(calls.filter(n=>n.content.data.kind==='consumption-budget-alert').length,2,'Different user has independent dedupe');
assert(presented.every(n=>n.request.content.data.userId==='user-b'),'Old presented content removed');
const ownerC=setNotificationSession('user-b','home-b');await module.exports.sendConsumptionBudgetAlert({owner:ownerC,...budgetArgs});
assert.equal(calls.filter(n=>n.content.data.kind==='consumption-budget-alert').length,3,'Different household has independent dedupe');

scheduled.push({identifier:'legacy-private',content:{data:{kind:'low-price-alert'}}},{identifier:'other-feature',content:{data:{kind:'other-feature'}}});
await withNotificationSession(ownerC,async()=>{});assert(!scheduled.some(n=>n.identifier==='legacy-private'));assert(scheduled.some(n=>n.identifier==='other-feature'));
const gate=()=>{let enter,release;const entered=new Promise(r=>enter=r),wait=new Promise(r=>release=r);return{enter,release,entered,wait};};
Date.now=()=>now;
try{
 let active=setNotificationSession('race-a','house');storagePause=gate();const blocked=storagePause,before=calls.length;
 const pending=scheduleLowPriceAlert(active,[point(11,100),point(12,100),point(13,230)]);await blocked.entered;
 const next=setNotificationSession('race-b','house');blocked.release();await pending;await withNotificationSession(next,async()=>{});assert.equal(calls.length,before,'Old request blocked after owner changes during await');
 active=setNotificationSession('race-a','house');schedulePause=gate();const native=schedulePause;
 const pendingNative=scheduleLowPriceAlert(active,[point(11,100),point(12,100),point(13,230)]);await native.entered;
 setNotificationSession('race-b','house');const returned=setNotificationSession('race-a','house');native.release();await pendingNative;await withNotificationSession(returned,async()=>{});
 assert.equal(scheduled.filter(n=>n.content.data.kind==='low-price-alert').length,0,'In-flight old session cancelled even after A-B-A');
 scheduled.push({identifier:'failed-cleanup',content:{data:{kind:'low-price-alert'}}});cancellationFails=true;
 const beforeFailure=calls.length;
 await assert.rejects(module.exports.sendConsumptionBudgetAlert({owner:returned,...budgetArgs}),/Synthetic cancellation failure/);
 assert.equal(calls.length,beforeFailure,'Failed cleanup must block new private notification writes');
 cancellationFails=false;await module.exports.sendConsumptionBudgetAlert({owner:returned,...budgetArgs});
 await clearNotificationSession();assert(scheduled.every(n=>n.content.data.kind==='other-feature'));assert.equal(presented.length,0,'Logout dismisses private presented notifications');
 assert.equal(await withNotificationSession(returned,async()=>{throw Error('Stale task ran');}),undefined);
}finally{Date.now=actualNow;}
console.log('PASS: user/household isolation, concurrent budget dedupe, legacy cleanup, logout, stale async and A-B-A races, cleanup failure/retry, unrelated notifications preserved.');
