import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/hooks/usePowerSetup.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const returnModule = { exports: {} };
const returnJs = ts.transpileModule(readFileSync(new URL('../src/services/eloverblik-return.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
vm.runInThisContext(`(function(module,exports){${returnJs}\n})`)(returnModule, returnModule.exports);
for (const url of ['stromblik://eloverblik/connected', 'https://huslyg.dk/eloverblik/return.html?app=1']) assert.equal(returnModule.exports.isEloverblikReturnUrl(url), true);
for (const url of ['https://huslyg.dk.attacker.invalid/eloverblik/return.html', 'https://huslyg.dk/eloverblik/return.html/other', 'stromblik://eloverblik/connected-fake', 'https://user@huslyg.dk/eloverblik/return.html']) assert.equal(returnModule.exports.isEloverblikReturnUrl(url), false);
const flush = async () => { for (let i = 0; i < 4; i++) await new Promise(resolve => setImmediate(resolve)); };
function mount({ connected = false, pending = false, initialUrl = null } = {}) {
  const states = [], effects = [], timers = new Map(), listeners = {}, opened = [];
  let index = 0, checks = 0, finishes = 0;
  const behavior = {
    status: async () => { checks++; return { connected, pending }; },
    finish: async () => { finishes++; return { connected, pending }; },
    begin: async () => ({ authorizationUrl: 'https://eloverblik.dk/synthetic-only' }),
  };
  const dependencies = {
    '../services/eloverblik-return': returnModule.exports,
    react: {
      useState: initial => { const i = index++; states[i] = initial; return [initial, value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; },
      useRef: current => ({ current }), useCallback: fn => fn, useEffect: fn => effects.push(fn),
    },
    'react-native': {
      Platform: { OS: 'android' },
      AppState: { currentState: 'active', addEventListener: (_, fn) => { listeners.foreground = fn; return { remove() {} }; } },
      Linking: { openURL: async url => { opened.push(url); }, getInitialURL: () => Promise.resolve(initialUrl), addEventListener: (_, fn) => { listeners.link = fn; return { remove() {} }; } },
    },
    '../services/private-electricity': {
      privateMeterStatus: () => behavior.status(), finishThirdPartyMeterConnection: () => behavior.finish(), beginThirdPartyMeterConnection: () => behavior.begin(),
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(`(function(require,module,exports){${js}\n})`, {
    Error, URL, window: {}, setTimeout: fn => { const id = Symbol(); timers.set(id, fn); return id; }, clearTimeout: id => timers.delete(id),
  })(name => { assert.ok(name in dependencies, name); return dependencies[name]; }, module, module.exports);
  const hook = module.exports.usePowerSetup({});
  const cleanups = effects.map(fn => fn());
  return { hook, states, behavior, listeners, opened, timers, count: () => ({ checks, finishes }), unmount: () => cleanups.forEach(fn => fn?.()) };
}
{
  const app = mount({ connected: true }); await flush();
  assert.equal(app.states[0], 'done'); assert.equal(app.opened.length, 0);
  assert.equal(app.count().finishes, 1, 'Existing connection imports meters without reopening MitID');
  app.unmount();
}
{
  const app = mount(); await flush();
  app.behavior.status = async () => ({ connected: true });
  app.behavior.finish = async () => ({ connected: true });
  app.listeners.link({ url: 'https://huslyg.dk/eloverblik/return.html?app=1' }); await flush();
  assert.equal(app.states[0], 'done', 'Verified HTTPS app links trigger authenticated approval checks');
  app.unmount();
}
{
  const app = mount(); await flush();
  let release;
  app.behavior.begin = () => new Promise(resolve => { release = resolve; });
  const connect = app.hook.connect();
  app.listeners.link({ url: 'stromblik://eloverblik/connected?connected=true' });
  app.behavior.status = async () => ({ connected: false, pending: true });
  app.behavior.finish = async () => ({ connected: true, pending: false });
  release({ authorizationUrl: 'https://eloverblik.dk/synthetic-only' });
  await connect; await flush();
  assert.equal(app.states[0], 'done', 'Return arriving during begin is queued and verified');
  app.unmount();
}
{
  const app = mount({ pending: true }); await flush();
  assert.equal(app.states[0], 'pending');
  assert.equal(app.timers.size, 1);
  app.listeners.link({ url: 'stromblik://eloverblik/connected?connected=true' }); await flush();
  assert.equal(app.states[0], 'pending', 'A forged deep link cannot mark a pending grant connected');
  app.behavior.finish = async () => ({ connected: true, pending: false });
  const [timerId, tick] = app.timers.entries().next().value; app.timers.delete(timerId); tick(); await flush();
  assert.equal(app.states[0], 'done', 'Approval propagating after return is retried');
  app.unmount(); assert.equal(app.timers.size, 0);
}
{
  const app = mount({ pending: true }); await flush();
  app.behavior.status = async () => { throw new Error('Provider unavailable'); };
  await app.hook.check();
  assert.equal(app.states[0], 'pending'); assert.equal(app.states[2], 'Provider unavailable');
  assert.equal(app.timers.size, 0, 'Provider failure stops polling');
  app.unmount();
}
{
  const app = mount({ initialUrl: 'stromblik://eloverblik/connected' });
  app.unmount(); await flush();
  assert.equal(app.count().checks, 1, 'Late cold-start URL is ignored after unmount');
}

const html = readFileSync(new URL('../public/eloverblik/return.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
for (const native of [false, true]) {
  const nodes = { return: {}, help: {} }, redirects = [];
  vm.runInNewContext(script, {
    URLSearchParams, document: { getElementById: id => nodes[id] },
    location: { search: native ? '?app=1&returnUrl=https://attacker.invalid' : '?returnUrl=https://attacker.invalid', replace: url => redirects.push(url) },
  });
  assert.equal(redirects[0], native ? 'stromblik://eloverblik/connected' : '/?eloverblik=return');
  if (native) assert.equal(nodes.return.href, 'stromblik://eloverblik/connected', 'Button remains available if automatic app opening is blocked');
}
console.log('PASS: grant reuse, queued app returns, authenticated verification, delayed approval, outage/unmount cleanup and fixed HTTPS-page navigation. Synthetic platform/provider only.');
