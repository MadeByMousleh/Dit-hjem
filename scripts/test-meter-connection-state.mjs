import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise status failures, foreground refresh and late responses after unmount.
const states = [], effects = [], pending = [];
let stateIndex = 0, foreground;
const react = {
  useState(initial) { const i = stateIndex++; states[i] = initial; return [initial, value => { states[i] = value; }]; },
  useRef: current => ({ current }), useCallback: fn => fn,
  useEffect: fn => { effects.push(fn); },
};
const module = { exports: {} };
const source = readFileSync(new URL('../src/hooks/useMeterConnection.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const dependencies = {
  react,
  'react-native': { Platform: { OS: 'android' }, AppState: { addEventListener: (_, fn) => { foreground = fn; return { remove() {} }; } } },
  '../services/private-electricity': { hasPrivateMeterConnection: () => new Promise((resolve, reject) => pending.push({ resolve, reject })) },
};
// Native exposes window as the global object, without browser event methods.
vm.runInNewContext(`(function(require,module,exports){${js}\n})`, { window: {} })(name => {
  assert.ok(name in dependencies, name); return dependencies[name];
}, module, module.exports);
const hook = module.exports.useMeterConnection({});
const cleanups = effects.map(fn => fn());
assert.equal(pending.length, 1);
pending.shift().reject(new Error('offline'));
await new Promise(resolve => setImmediate(resolve));
assert.equal(states[0], null, 'A network failure must not mean disconnected');
assert.ok(states[1]);
const retry = hook.refresh();
pending.shift().resolve(true);
await retry;
assert.equal(states[0], true);
assert.equal(states[1], '');
foreground('active');
pending.shift().reject(new Error('offline'));
await new Promise(resolve => setImmediate(resolve));
assert.equal(states[0], true, 'Preserve the last confirmed status on transient errors');
const older = hook.refresh(), newer = hook.refresh();
pending.pop().resolve(true);
await newer;
pending.shift().resolve(false);
await older;
assert.equal(states[0], true, 'An older request must not overwrite a newer response');
const late = hook.refresh();
cleanups.forEach(fn => fn?.());
pending.shift().resolve(false);
await late;
assert.equal(states[0], true, 'Ignore responses after unmount');
console.log('PASS: connection status errors, retry, foreground refresh, request ordering and unmount.');
