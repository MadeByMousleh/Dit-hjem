import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const jsx = (type, props) => ({ type, props: props ?? {} });
let user = 'alice', selected, linkHandler, appHandler, initialUrl = null, status = { connected: false }, deviceList = [], failure = false, opens = [], commandCalls = [];
let slots = [], cursor = 0, effects = [];
const react = {
  useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
  useRef(initial) { const i = cursor++; return slots[i] ?? (slots[i] = { current: initial }); },
  useCallback(fn, deps) { const i = cursor++, prior = slots[i]; if (!prior || deps.some((v, n) => v !== prior.deps[n])) slots[i] = { deps, fn }; return slots[i].fn; },
  useEffect(fn, deps) { const i = cursor++, prior = slots[i]; if (!prior || deps.some((v, n) => v !== prior.deps[n])) { prior?.cleanup?.(); slots[i] = { deps }; effects.push(() => { slots[i].cleanup = fn(); }); } },
};
const setActiveTab = value => { selected = value; };
const dependencies = {
  react,
  'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
  'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', ActivityIndicator: 'Spinner', ScrollView: 'ScrollView', StyleSheet: { create: x => x }, Platform: { OS: 'android' },
    Linking: { addEventListener: (_, fn) => { linkHandler = fn; return { remove() {} }; }, getInitialURL: async () => initialUrl, openURL: async url => opens.push(url) },
    AppState: { addEventListener: (_, fn) => { appHandler = fn; return { remove() {} }; } }, Alert: { alert() {} },
    BackHandler: { addEventListener: () => ({ remove() {} }) },
  },
  '../styles/theme': { colors: {} }, './AppIcon': { AppIcon: 'AppIcon' }, '../components/AppIcon': { AppIcon: 'AppIcon' },
  './useHouseholdSession': { useHouseholdSession: () => ({ session: user ? { user: { id: user } } : null }) },
  './useDashboardViewState': { useDashboardViewState: () => ({ setActiveTab }) },
  '../hooks/useDashboardViewState': { useDashboardViewState: () => ({ setActiveTab }) },
  '../hooks/useRememberedScroll': { useRememberedScroll: () => ({}) },
  'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
};
class ClientError extends Error { constructor(message, status) { super(message); this.status = status; } }
dependencies['../services/smartthings'] = {
  SmartThingsClientError: ClientError,
  getSmartThingsStatus: async () => { if (failure) throw new ClientError('synthetic outage', 503); return status; },
  getSmartThingsDevices: async () => ({ devices: deviceList, truncated: false }),
  getSmartThingsAuthorizationUrl: async native => { assert.equal(native, true); return 'https://api.smartthings.com/oauth/authorize?synthetic=1'; },
  commandSmartThingsSwitch: async (...args) => { commandCalls.push(args); return { accepted: true }; },
  commandSmartThingsProgram: async (...args) => { commandCalls.push(['program', ...args]); return { accepted: true }; },
  startSmartThingsProgram: async (...args) => { commandCalls.push(['start', ...args]); return { accepted: true }; },
  removeSmartThingsConnection: async () => ({ connected: false }),
};
function load(path) {
  const js = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} }; vm.runInThisContext(`(function(require,module,exports){${js}\n})`)(name => dependencies[name] ?? new Proxy({}, { get: (_, key) => String(key) }), mod, mod.exports); return mod.exports;
}
const { useSmartThingsConnection } = load('../src/hooks/useSmartThingsConnection.ts');
dependencies['./applianceCatalog'] = load('../src/utils/applianceCatalog.ts');
dependencies['../utils/applianceEnergy'] = load('../src/utils/applianceEnergy.ts');
const { SmartThingsPage, SmartThingsEntry, ApplianceDetail } = load('../src/components/SmartThingsPage.tsx');
function renderHook(active = true) { cursor = 0; return useSmartThingsConnection(active); }
async function settle(active = true) { renderHook(active); effects.splice(0).forEach(fn => fn()); await new Promise(resolve => setImmediate(resolve)); return renderHook(active); }
function nodes(tree) { return Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : []; }
function text(tree) { return Array.isArray(tree) ? tree.map(text).join(' ') : tree && typeof tree === 'object' ? text(tree.props?.children) : typeof tree === 'string' ? tree : ''; }
globalThis.window = {}; // Native React Native window has no DOM event methods.
let connection = await settle();
assert.equal(connection.connected, false);
await connection.connect(); assert.equal(opens.length, 1);
status = { connected: true };
deviceList = [{ id: 'lamp', label: 'Lampe', components: [{ id: 'main', label: 'main', capabilities: ['switch'] }], status: { main: { switch: { switch: { value: 'off' } } } } }, { id: 'dishwasher', label: 'Opvaskemaskine', components: [{ id: 'main', label: 'main', capabilities: ['dishwasherOperatingState'] }], status: {} }];
await connection.refresh(); connection = renderHook();
assert.equal(connection.connected, true); assert.equal(connection.devices.length, 2);
let page = SmartThingsPage({ connection });
assert.ok(nodes(page).some(n => n.props.accessibilityLabel === 'Åbn Lampe'));
assert.ok(!nodes(page).some(n => n.props.accessibilityLabel === 'Tænd Lampe'), 'Controls live inside detail, not compact cards');
const lampDetail = ApplianceDetail({ device: deviceList[0], component: 'main', connection, draft: '', onSelect() {} });
const on = nodes(lampDetail).find(n => n.props.accessibilityLabel === 'Tænd Lampe'); assert.ok(on); assert.equal(on.props.disabled, false);
assert.equal(nodes(lampDetail).find(n => n.props.accessibilityLabel === 'Sluk Lampe').props.disabled, true);
assert.ok(!nodes(page).some(n => n.props.accessibilityLabel === 'Tænd Opvaskemaskine'), 'No invented dishwasher switch');
const bosch = { id: 'bosch', label: 'Opvaskemaskine', manufacturer: 'Bosch', model: 'SMD6ZC804E', components: [{ id: 'main', label: 'main', capabilities: ['switch', 'signalahead13665.dishwasherprogramsv2'] }], status: { main: { switch: { switch: { value: 'off' } }, 'signalahead13665.dishwasherprogramsv2': { program: { value: 'Dishcare_Dishwasher_Program_Eco50' } } } } };
const { applianceInfo } = dependencies['../utils/applianceEnergy'];
assert.equal(applianceInfo(bosch, 'main').estimate.min, 0.645);
assert.equal(applianceInfo({ ...bosch, model: 'SMD6ZC804E/OTHER' }, 'main').estimate.basis, 'Groft standardestimat');
assert.equal(applianceInfo({ ...bosch, manufacturer: 'Other' }, 'main').estimate.basis, 'Groft standardestimat');
assert.equal(applianceInfo({ ...bosch, status: { main: { 'signalahead13665.dishwasherprogramsv2': { program: { value: 'Dishcare_Dishwasher_Program_Auto2' } } } } }, 'main').estimate.basis, 'Groft standardestimat');
assert.match(text(SmartThingsPage({ connection: { ...connection, devices: [bosch] } })), /0,65 kWh/);
assert.match(text(SmartThingsPage({ connection: { ...connection, devices: [{ ...bosch, statusError: true }] } })), /Status utilgængelig/);
await connection.setSwitch('lamp', 'main', 'on'); connection = renderHook();
assert.deepEqual(commandCalls, [['lamp', 'main', 'on']]);
assert.equal(connection.devices[0].status.main.switch.switch.value, 'off', 'ACCEPTED never becomes an optimistic physical state');
assert.match(connection.notice, /sendt/);
await connection.setProgram('bosch', 'main', 'signalahead13665.dishwasherprogramsv2', 'Dishcare_Dishwasher_Program_Eco50');
assert.equal(commandCalls.at(-1)[0], 'program');
assert.equal(connection.devices[0].status.main.switch.switch.value, 'off');
const catalog = dependencies['./applianceCatalog'];
assert.equal(catalog.identifyAppliance(['dryerOperatingState'], 'Tumbler'), 'dryer');
assert.equal(catalog.identifyAppliance(['dishwasherOperatingState'], 'Kitchen'), 'dishwasher');
assert.equal(catalog.identifyAppliance([], 'Mikroovn'), 'microwave');
assert.equal(catalog.identifyAppliance([], 'Lampe'), 'unknown');
for (const [kind, record] of Object.entries(catalog.applianceCatalog)) {
  assert.ok(record.min > 0 && record.max >= record.min && record.period && record.assumption, kind);
  assert.ok(applianceInfo({ ...bosch, label: record.label, manufacturer: null, model: null, components: [{ id: 'main', capabilities: [] }], status: {} }, 'main').estimate, kind);
}
const programDevice = { ...bosch, components: [{ id: 'main', capabilities: ['switch', 'signalahead13665.dishwasherprogramsv2', 'signalahead13665.startstopprogramv2'] }], status: { main: { ...bosch.status.main, switch: { switch: { value: 'on' } }, 'signalahead13665.applianceoperationstatesv2': { operationState: { value: 'Ready' } }, 'signalahead13665.dishwasherprogramsv2': { program: { value: 'Dishcare_Dishwasher_Program_Eco50' }, availablePrograms: { value: ['Dishcare_Dishwasher_Program_Eco50', 'Dishcare_Dishwasher_Program_MachineCare'] } } } } };
const detail = (device, draft) => ApplianceDetail({ device, component: 'main', connection: { ...connection, pending: '', loading: false }, draft, onSelect() {} });
const startButton = tree => nodes(tree).find(n => n.type === 'Pressable' && text(n) === 'Start program');
assert.equal(startButton(detail(programDevice, 'Dishcare_Dishwasher_Program_Eco50')).props.disabled, false);
assert.equal(startButton(detail(programDevice, 'Dishcare_Dishwasher_Program_MachineCare')).props.disabled, true, 'Unconfirmed selection cannot start');
assert.equal(startButton(detail({ ...programDevice, statusError: true }, 'Dishcare_Dishwasher_Program_Eco50')).props.disabled, true);
failure = true; await connection.refresh(); connection = renderHook();
assert.equal(connection.connected, true); assert.equal(connection.devices.length, 2); assert.match(connection.error, /outage/);
failure = false;
initialUrl = 'stromblik://smartthings/connected';
await settle(false); assert.equal(selected, 'smartthings'); selected = null;
await settle(true); await settle(false); assert.equal(selected, null, 'Initial intent is not replayed on every tab change');
linkHandler({ url: 'stromblik://smartthings/connected-evil' }); assert.equal(selected, null);
linkHandler({ url: 'stromblik://smartthings/connected' }); assert.equal(selected, 'smartthings');
await new Promise(resolve => setImmediate(resolve));
user = 'bob'; connection = renderHook(); assert.deepEqual(connection.devices, []); assert.equal(connection.connected, null);
status = { connected: false }; await settle(); connection = renderHook(); assert.deepEqual(connection.devices, []);
await connection.disconnect(); connection = renderHook(); assert.equal(connection.connected, false);
assert.match(connection.notice, /fjernet/);
SmartThingsEntry({ onOpen: () => setActiveTab('smartthings') }).props.onPress(); assert.equal(selected, 'smartthings');
delete globalThis.window;
console.log('PASS: actual SmartThings hook/JSX, native window compatibility, connect, capability controls, accepted-versus-confirmed status, outage preservation, user isolation, disconnect and warm/cold return replay handling. Synthetic platform and API.');
