import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/utils/smartCharging.ts', import.meta.url), 'utf8');
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
vm.runInThisContext(`(function(require,module,exports){${output}\n})`)(name => {
  if (name === '../prices') return {};
  throw new Error(`Unexpected import ${name}`);
}, module, module.exports);

const { findSmartChargingPlan } = module.exports;
const now = Date.parse('2026-10-01T12:00:00.000Z');
const point = (hour, ore) => ({ startsAt: new Date(Date.parse(`2026-10-01T${String(hour).padStart(2, '0')}:00:00.000Z`)), totalOrePerKwh: ore });
const plan = findSmartChargingPlan({
  points: [point(13, 260), point(14, 240), point(15, 230), point(16, 210), point(17, 180), point(18, 90), point(19, 80), point(20, 90), point(21, 100), point(22, 250)],
  now,
  currentLevel: 50,
  targetLevel: 80,
  batteryKwh: 60,
  chargerKw: 7.2,
  readyByHour: 1,
  maxPriceOre: 120,
});
assert.ok(plan);
assert.equal(plan.startsAt.toISOString(), '2026-10-01T18:00:00.000Z');
assert.equal(plan.endsAt.toISOString(), '2026-10-01T21:00:00.000Z');
assert.equal(Math.round(plan.requiredKwh), 20);
assert.equal(findSmartChargingPlan({ points: [point(18, 160), point(19, 160), point(20, 160)], now, currentLevel: 50, targetLevel: 80, batteryKwh: 60, chargerKw: 7.2, readyByHour: 1, maxPriceOre: 120 }), null);
console.log('PASS: smart charging selects an uninterrupted affordable window before the deadline.');
