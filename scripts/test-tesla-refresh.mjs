import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const output = ts.transpileModule(readFileSync(new URL('../src/hooks/useTeslaConnection.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
let cursor = 0;
const slots = [];
let effects = [];
let clock = 100_000;
let calls = 0;
let release;
let fail = false;
let connected = true;
const car = { id: 'car', vin: 'fixture' };
const module = { exports: {} };
vm.runInNewContext(`(function(require,module,exports){${output}\n})`, { Date: { now: () => clock } })(name => {
  if (name === 'react-native') return { Platform: { OS: 'web' }, Alert: {}, Linking: {} };
  if (name === '../services/storage') return {};
  if (name === '../services/tesla') return {
    getTeslaStatus: async () => { calls++; if (fail) throw new Error('offline'); return { connected }; },
    getTeslaVehicles: () => new Promise(resolve => { release = () => resolve([car]); }),
  };
  if (name === 'react') return {
    useState: initial => { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], value => { slots[index] = value; }]; },
    useRef: initial => { const index = cursor++; return slots[index] ??= { current: initial }; },
    useCallback: callback => callback,
    useEffect: effect => { effects.push(effect); },
  };
  throw new Error(`Unexpected import ${name}`);
}, module, module.exports);
function render(tab = 'home') { cursor = 0; effects = []; return module.exports.useTeslaConnection(tab); }
let hook = render();
const first = hook.refresh(false);
assert.equal(hook.refresh(false), first, 'Concurrent refreshes share one request');
await new Promise(resolve => setImmediate(resolve));
release();
await first;
hook = render('car');
effects[0]();
await new Promise(resolve => setImmediate(resolve));
assert.equal(calls, 1, 'Opening car tab reuses recent vehicle data');
assert.equal(hook.vehicle, car);
const manual = hook.refresh();
await new Promise(resolve => setImmediate(resolve));
release();
await manual;
assert.equal(calls, 2, 'Manual refresh bypasses freshness interval');
clock += 60_001;
fail = true;
await hook.refresh(false);
hook = render();
assert.equal(hook.vehicle, car, 'Network errors preserve the visible vehicle');
assert.equal(hook.connected, true);
fail = false;
connected = false;
await hook.refresh();
assert.equal(render().vehicle, null, 'Confirmed disconnection clears vehicle data');
hook = render('profile');
effects[0]();
assert.equal(calls, 4, 'Unrelated tabs do not fetch Tesla data');
console.log('PASS: Tesla freshness, concurrent refreshes, manual refresh, network failure and disconnection.');
