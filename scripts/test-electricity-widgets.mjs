import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { advance, midnight } from '../src/services/consumption-data.mjs';

const jsx = (type, props) => ({ type, props: props ?? {} });
const effects = [];
let selected, backHandler;
const dependencies = {
  'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
  react: { useMemo: fn => fn(), useEffect: fn => effects.push(fn), useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}] },
  'react-native': { View: 'View', Text: 'Text', Modal: 'Modal', Pressable: 'Pressable', ScrollView: 'ScrollView', StyleSheet: { create: x => x }, BackHandler: { addEventListener: (_, fn) => { backHandler = fn; return { remove() {} }; } } },
  '../styles/theme': { colors: {}, dkTime: new Intl.DateTimeFormat('da-DK', { timeZone: 'Europe/Copenhagen', hour: '2-digit', minute: '2-digit' }) },
  '../services/consumption-data.mjs': { advance, midnight },
  './AppIcon': { AppIcon: 'AppIcon' }, '../components/AppIcon': { AppIcon: 'AppIcon' },
  '../prices': {},
  'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({}) },
  '../hooks/useDashboardViewState': { useDashboardViewState: () => ({ setActiveTab: value => { selected = value; } }) },
  '../hooks/useRememberedScroll': { useRememberedScroll: () => ({}) },
};
function load(path) {
  const js = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mod = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${js}\n})`)(name => dependencies[name] ?? new Proxy({}, { get: (_, key) => String(key) }), mod, mod.exports);
  return mod.exports;
}
dependencies['react-native'].useWindowDimensions = () => ({ fontScale: 1 });
dependencies['../utils/widgetDrag'] = load('../src/utils/widgetDrag.ts');
dependencies['./DraggableWidgetList'] = { DraggableWidgetList: 'DraggableWidgetList', WidgetTrackGrid: ({ ids, renderCard }) => jsx('Grid', { children: ids.map(renderCard) }) };
function nodes(tree) { return Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : []; }
function render(tree) { return Array.isArray(tree) ? tree.map(render) : tree && typeof tree === 'object' ? typeof tree.type === 'function' ? render(tree.type(tree.props)) : { ...tree, props: { ...tree.props, children: render(tree.props.children) } } : tree; }
function text(tree) { return Array.isArray(tree) ? tree.map(text).join(' ') : tree && typeof tree === 'object' ? text(tree.props?.children) : typeof tree === 'string' ? tree : ''; }
dependencies['./usagePeriods'] = dependencies['../utils/usagePeriods'] = load('../src/utils/usagePeriods.ts');
const model = load('../src/utils/electricityWidgets.ts');
dependencies['../utils/electricityWidgets'] = model;
dependencies['./electricityWidgets'] = model;
dependencies['../styles/theme'] = load('../src/styles/theme.ts');
const appearanceModel = load('../src/utils/widgetAppearance.ts');
dependencies['../utils/widgetAppearance'] = appearanceModel;
for (const background of appearanceModel.widgetBackgrounds) {
  for (const textColor of ['auto', 'dark', 'white']) {
    const palette = appearanceModel.widgetAppearanceColors({ background: background.id, text: textColor });
    assert.ok(appearanceModel.contrastRatio(palette.background, palette.text) >= 4.5, 'All text selections resolve to readable colors');
  }
}
assert.deepEqual(appearanceModel.parseWidgetAppearances('null'), {});
assert.deepEqual(appearanceModel.parseWidgetAppearances('{"appearances":{"latest":{"background":"blue","text":"auto","columns":1,"rows":2}}}').latest, { background: 'blue', text: 'auto', columns: 1, rows: 2 });
assert.deepEqual(appearanceModel.widgetSpan('latest', { background: 'blue', text: 'auto', columns: 1, rows: 2 }), { columns: 2, rows: 6 });
assert.deepEqual(appearanceModel.parseWidgetAppearances('{"dashboard":["latest"]}'), {}, 'Old preferences default to original styling');
assert.deepEqual(appearanceModel.parseWidgetAppearances('{"appearances":{"latest":{"background":"navy","text":"white"},"price":{"background":"invalid","text":"dark"},"unknown":{"background":"blue","text":"auto"}}}'), { latest: { background: 'navy', text: 'white' } });
dependencies['../utils/usageTotalCost'] = load('../src/utils/usageTotalCost.ts');
const widgets = load('../src/components/ElectricityWidgets.tsx');
dependencies['../components/ElectricityWidgets'] = widgets;
const now = Date.parse('2026-10-15T10:00:00Z');
const point = (day, kwh = 2, incomplete = false) => ({ at: midnight(`2026-10-${String(day).padStart(2, '0')}`), kwh, incomplete });
const usage = points => ({ aggregation: 'Day', meterCount: 1, points });
let days = Array.from({ length: 13 }, (_, i) => point(i + 1));
let summary = model.widgetUsageSummary(usage([...days, point(14, null), point(15, 99)]), null, now);
assert.equal(dependencies['./usagePeriods'].usageToday(Date.parse(summary.latest.at)), '2026-10-13');
assert.equal(summary.total, 26); assert.equal(summary.forecastKwh, 62);
summary = model.widgetUsageSummary(usage([...days, point(14)]), null, now);
assert.equal(dependencies['./usagePeriods'].usageToday(Date.parse(summary.latest.at)), '2026-10-14');
assert.equal(summary.total, 28); assert.equal(summary.forecastKwh, 62);
summary = model.widgetUsageSummary(usage(days.filter((_, i) => i !== 3)), null, now);
assert.equal(summary.contiguous, false); assert.equal(summary.forecastKwh, null);
summary = model.widgetUsageSummary(usage([point(1, 0), point(2, 100, true)]), null, now);
assert.equal(summary.total, 0); assert.equal(summary.forecastKwh, 0);
const firstDay = Date.parse('2026-11-01T08:00:00Z');
summary = model.widgetUsageSummary(usage([]), usage([point(31)]), firstDay);
assert.equal(dependencies['./usagePeriods'].usageToday(Date.parse(summary.latest.at)), '2026-10-31');
assert.equal(summary.through, null); assert.equal(summary.forecastKwh, null);
assert.deepEqual(model.parseWidgetPins('{"dashboard":["latest","latest","unknown"],"electricity":["price"]}'), { dashboard: ['latest'], electricity: ['price'] });
assert.deepEqual(model.parseWidgetPins('null'), model.emptyWidgetPins());
assert.deepEqual(model.parseWidgetPins('{"dashboard":["budget","price","budget","latest","unknown"],"electricity":["month","latest"]}'), { dashboard: ['budget', 'price', 'latest'], electricity: ['month', 'latest'] }, 'Saved order survives validation and duplicate removal');
const prices = Array.from({ length: 12 }, (_, i) => ({ startsAt: new Date(now + i * 900000), totalOrePerKwh: i === 0 ? -1000 : i < 4 ? 1000 : i < 8 ? 50 : 100 }));
assert.equal(model.cheapestWidgetHour(prices, now).start, now + 3600000);
assert.equal(model.cheapestWidgetHour(prices.slice(0, 3), now), null);
assert.equal(model.cheapestWidgetHour(prices.map((p, i) => ({ ...p, startsAt: new Date(now + 2 * 86400000 + i * 900000) })), now), null);
assert.equal(model.cheapestWidgetHour(prices.filter((_, i) => i !== 5), now).start, now + 6 * 900000);
const fortnight = Array.from({ length: 14 }, (_, i) => point(i + 1, i < 7 ? 2 : 1));
let weekly = model.widgetWeekSummary(usage([...fortnight, point(15, 999)]), null, now);
assert.equal(weekly.total, 7); assert.equal(weekly.previousTotal, 14); assert.equal(weekly.change, -50);
assert.equal(weekly.days[0].day, '2026-10-08'); assert.equal(weekly.days.at(-1).day, '2026-10-14');
weekly = model.widgetWeekSummary(usage(fortnight.filter((_, i) => i !== 10)), null, now);
assert.equal(weekly.total, null); assert.equal(weekly.change, null); assert.equal(weekly.days[3].kwh, null, 'Missing day is not silently replaced with zero or another older day');
assert.equal(model.widgetWeekSummary(usage(fortnight.map(p => ({ ...p, kwh: 0 }))), null, now).change, null, 'Never divide by zero');
assert.equal(model.widgetWeekSummary(usage(fortnight.map((p, i) => ({ ...p, incomplete: i === 10 }))), null, now).total, null);
const rolloverPoints = Array.from({ length: 14 }, (_, i) => { const d = new Date('2026-09-20T12:00:00Z'); d.setUTCDate(d.getUTCDate() + i); return { at: d.toISOString(), kwh: 2 }; });
weekly = model.widgetWeekSummary(usage(rolloverPoints.filter(p => p.at.startsWith('2026-10'))), usage(rolloverPoints.filter(p => p.at.startsWith('2026-09'))), Date.parse('2026-10-04T10:00:00Z'));
assert.equal(weekly.total, 14); assert.equal(weekly.previousTotal, 14); assert.equal(weekly.change, 0);
assert.equal(weekly.days[0].day, '2026-09-27');
assert.equal(model.widgetWeekSummary({ ...usage(rolloverPoints.filter(p => p.at.startsWith('2026-10'))), meterCount: 2 }, usage(rolloverPoints.filter(p => p.at.startsWith('2026-09'))), Date.parse('2026-10-04T10:00:00Z')).change, null, 'Changed meter coverage is not comparable');
const priceDay = (start, count, interval = 3600000) => Array.from({ length: count }, (_, i) => ({ startsAt: new Date(Date.parse(start) + i * interval), totalOrePerKwh: i - 12 }));
const fullPriceDay = priceDay('2026-10-14T22:00:00Z', 24);
assert.equal(model.widgetPriceStatus(fullPriceDay, Date.parse('2026-10-14T22:30:00Z')).level, 'low');
assert.equal(model.widgetPriceStatus(fullPriceDay, Date.parse('2026-10-15T10:30:00Z')).level, 'medium');
assert.equal(model.widgetPriceStatus(fullPriceDay, Date.parse('2026-10-15T21:30:00Z')).level, 'high');
assert.equal(model.widgetPriceStatus(fullPriceDay.filter((_, i) => i !== 5), now), null);
assert.equal(model.widgetPriceStatus(fullPriceDay.slice(1), now), null, 'Missing start of day prevents status');
assert.equal(model.widgetPriceStatus(fullPriceDay.slice(0, -1), now), null, 'Missing end of day prevents status');
assert.equal(model.widgetPriceStatus(fullPriceDay.map(p => ({ ...p, totalOrePerKwh: -10 })), now).flat, true);
assert.equal(model.widgetPriceStatus(priceDay('2026-10-14T22:00:00Z', 96, 900000), now).level, 'medium');
assert.ok(model.widgetPriceStatus(priceDay('2026-10-24T22:00:00Z', 25), Date.parse('2026-10-25T10:30:00Z')), '25-hour Copenhagen fall DST day');
assert.ok(model.widgetPriceStatus(priceDay('2026-03-28T23:00:00Z', 23), Date.parse('2026-03-29T10:30:00Z')), '23-hour Copenhagen spring DST day');
assert.equal(model.widgetShortcut('latest', '2026-10-13').aggregation, 'Hour');
for (const id of ['month', 'week', 'comparison']) assert.equal(model.widgetShortcut(id).aggregation, 'Day');
for (const id of ['price', 'cheapest', 'priceStatus']) assert.equal(model.widgetShortcut(id).section, 'prices');
assert.equal(model.widgetShortcut('budget').tab, 'profile');

const dataProps = { usage: { currentMonthDays: usage(days), previousMonthDays: null, agreements: { records: [] }, connected: true }, prices, isSample: true, supplier: { area: 'DK1', id: 'fixture' }, now, unit: 'kwh', limit: 50, enabled: false };
const data = widgets.useElectricityWidgetData(dataProps);
assert.match(data.latest.detail, /13\. oktober/);
assert.equal(data.price.value, '—'); assert.equal(data.cheapest.value, '—');
assert.match(data.month.detail, /13\. oktober/); assert.match(data.budget.note, /62 kWh/);
assert.equal(data.week.days.length, 7); assert.match(data.week.detail, /7\. oktober.*13\. oktober/);
assert.equal(data.priceStatus.status, undefined, 'Sample prices never produce a colored status');
const extendedData = widgets.useElectricityWidgetData({ ...dataProps, isSample: false, prices: fullPriceDay, usage: { ...dataProps.usage, currentMonthDays: usage(fortnight) } });
assert.equal(extendedData.comparison.value, '50 % mindre'); assert.equal(extendedData.week.value, '7 kWh');
assert.equal(extendedData.latest.anchor, '2026-10-14'); assert.equal(extendedData.priceStatus.status, 'medium');
const missing = widgets.useElectricityWidgetData({ ...dataProps, usage: { ...dataProps.usage, currentMonthDays: usage(days.filter((_, i) => i !== 2)) } });
assert.match(missing.month.note, /mangler/); assert.match(missing.budget.note, /afventer/);
const money = widgets.useElectricityWidgetData({ ...dataProps, unit: 'dkk' });
assert.equal(money.budget.value, '—', 'No fabricated kroner without historical tariffs and agreement');
const initialUseState = dependencies.react.useState;
const historicalPrices = Array.from({ length: 13 * 24 }, (_, i) => ({ startsAt: new Date(Date.parse(midnight('2026-10-01')) + i * 3600000), totalOrePerKwh: 200, gridAndTaxOrePerKwh: 50 }));
dependencies.react.useState = () => [{ key: 'DK1:fixture:2026-10-01:2026-10-15', prices: historicalPrices }, () => {}];
const agreement = { date_from: '2026-01-01', date_to: null, price_type: 'fixed', fixed_ore: 100, markup_ore: 10, subscription_dkk: 31 };
const costProps = { ...dataProps, prices: prices.map(p => ({ ...p, gridAndTaxOrePerKwh: 50 })), isSample: false, unit: 'dkk', usage: { ...dataProps.usage, agreements: { records: [agreement] } } };
const pricedData = widgets.useElectricityWidgetData(costProps);
assert.equal(pricedData.latest.note, 'Ca. 4,2 kr.');
assert.equal(pricedData.month.note, 'Ca. 54,6 kr.');
assert.equal(pricedData.budget.value, 'Ca. 54,6 / 50 kr.');
assert.match(pricedData.budget.note, /130,2 kr/);
assert.equal(pricedData.price.value, '1,6 kr./kWh', 'Current interval applies fixed agreement and markup');
dependencies.react.useState = () => [{ key: 'DK1:fixture:2026-10-01:2026-10-15', prices: historicalPrices.slice(1) }, () => {}];
assert.equal(widgets.useElectricityWidgetData(costProps).budget.value, '—', 'A missing historical interval prevents an incomplete cost total');
dependencies.react.useState = initialUseState;
const pins = { dashboard: ['latest'], electricity: ['month'] }, calls = [];
const preferences = { pins, ready: true, saving: false, error: '', toggle: (...args) => calls.push(args) };
const catalog = render(widgets.ElectricityWidgetsPage({ preferences, data }));
const controls = nodes(catalog).filter(n => n.props.accessibilityRole === 'checkbox');
assert.equal(controls.length, model.electricityWidgetIds.length * 2);
assert.equal(data.priceChart.prices.length, 0, 'Sample prices are never shown as live chart data');
assert.equal(model.widgetShortcut('priceChart').section, 'prices');
assert.ok(controls.some(n => n.props.accessibilityLabel === 'Elprisgraf på Overblik'));
assert.equal(controls.find(n => n.props.accessibilityLabel === 'Seneste dags forbrug på Overblik').props.accessibilityState.checked, true);
controls.find(n => n.props.accessibilityLabel === 'Seneste dags forbrug på El').props.onPress();
assert.deepEqual(calls, [['electricity', 'latest']]);
assert.match(text(render(widgets.PinnedElectricityWidgets({ location: 'dashboard', preferences, data, onManage() {} }))), /Forbrug/);
assert.doesNotMatch(text(render(widgets.PinnedElectricityWidgets({ location: 'dashboard', preferences, data, onManage() {} }))), /Denne måneds forbrug/);
const reorderCalls = [];
const orderedPreferences = { ...preferences, key: 'fixture', pins: { dashboard: ['price', 'latest', 'month'], electricity: ['month', 'latest'] }, reorder: async (...args) => { reorderCalls.push(args); return true; } };
dependencies['./DraggableWidgetList'] = { ...dependencies['./DraggableWidgetList'], DraggableWidgetList: 'DraggableWidgetList' };
const normalPinned = widgets.PinnedElectricityWidgets({ location: 'dashboard', preferences: orderedPreferences, data, onManage() {} });
const draggable = nodes(normalPinned).find(n => n.type === 'DraggableWidgetList');
assert.ok(draggable); assert.deepEqual(draggable.props.ids, ['price', 'latest', 'month']);
const shortcutCalls = [];
const shortcutsTree = widgets.PinnedElectricityWidgets({ location: 'dashboard', preferences: orderedPreferences, data, onManage() {}, onOpen: (...args) => shortcutCalls.push(args) });
nodes(shortcutsTree).find(n => n.type === 'DraggableWidgetList').props.onActivate('latest');
assert.deepEqual(shortcutCalls, [['latest', '2026-10-13']]);
assert.ok(nodes(normalPinned).some(n => n.props.accessibilityLabel === 'Rediger widgetlayout'));
await draggable.props.onReorder(['latest', 'price', 'month']);
assert.deepEqual(reorderCalls, [['dashboard', ['latest', 'price', 'month']]]);
const savingTree = widgets.PinnedElectricityWidgets({ location: 'dashboard', preferences: { ...orderedPreferences, saving: true, error: 'Valget kunne ikke gemmes.' }, data, onManage() {} });
assert.equal(nodes(savingTree).find(n => n.type === 'DraggableWidgetList').props.disabled, true);
assert.ok(nodes(savingTree).some(n => n.props.accessibilityRole === 'alert'));
const elTree = widgets.PinnedElectricityWidgets({ location: 'electricity', preferences: orderedPreferences, data, onManage() {} });
assert.ok(!nodes(elTree).some(n => n.type === 'DraggableWidgetList'));
const screen = load('../src/screens/SecondaryTabsScreen.tsx');
const screenProps = { activeTab: 'electricity-widgets', styles: {}, colors: {}, electricityUsage: { auth: { householdId: 'fixture' } }, widgetPreferences: preferences, widgetData: data };
effects.length = 0;
const page = screen.SecondaryTabScreen(screenProps);
nodes(page).find(n => n.props.accessibilityLabel === 'Tilbage til El').props.onPress(); assert.equal(selected, 'electricity');
effects.forEach(fn => fn()); selected = null; backHandler(); assert.equal(selected, 'electricity');
const tabs = load('../src/components/BottomTabs.tsx').BottomTabs({ activeTab: 'electricity-widgets', onSelect() {} });
assert.equal(nodes(tabs).find(n => n.props.accessibilityState?.selected).props.accessibilityLabel, 'Mit hjem');
console.log('PASS: historical dates, delayed data, month rollover, missing/zero readings, honest cost/projection, contiguous cheapest hour, independent pins, actual JSX catalog and parent navigation. Synthetic data/platform.');

// Exercise the real preference hook through rerenders and asynchronous storage.
const storage = new Map();
let slots = [], cursor = 0, pendingEffects = [], failSave = false;
dependencies.react = {
  useState(initial) {
    const i = cursor++;
    if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
    return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }];
  },
  useRef(initial) { const i = cursor++; return slots[i] ?? (slots[i] = { current: initial }); },
  useEffect(fn, deps) {
    const i = cursor++, prior = slots[i];
    if (!prior || deps.some((v, n) => v !== prior.deps[n])) {
      prior?.cleanup?.();
      slots[i] = { deps };
      pendingEffects.push(() => { slots[i].cleanup = fn(); });
    }
  },
};
dependencies['@react-native-async-storage/async-storage'] = { default: {
  getItem: async key => storage.get(key) ?? null,
  setItem: async (key, value) => { if (failSave) throw Error('synthetic failure'); storage.set(key, value); },
} };
const { useElectricityWidgets } = load('../src/hooks/useElectricityWidgets.ts');
function preferencesFor(user, house) { cursor = 0; return useElectricityWidgets(user, house); }
async function hydrate(user, house) {
  preferencesFor(user, house); pendingEffects.splice(0).forEach(fn => fn());
  await new Promise(resolve => setImmediate(resolve));
  return preferencesFor(user, house);
}
let prefs = await hydrate('alice', 'home-a');
assert.equal(prefs.ready, true);
await prefs.toggle('dashboard', 'latest');
prefs = preferencesFor('alice', 'home-a');
await prefs.toggle('electricity', 'latest');
prefs = preferencesFor('alice', 'home-a');
assert.deepEqual(prefs.pins, { dashboard: ['latest'], electricity: ['latest'] });
failSave = true; await prefs.toggle('dashboard', 'price');
prefs = preferencesFor('alice', 'home-a');
assert.deepEqual(prefs.pins.dashboard, ['latest']); assert.match(prefs.error, /ikke gemmes/);
failSave = false;
assert.deepEqual(preferencesFor('bob', 'home-a').pins, model.emptyWidgetPins(), 'No previous user pins before hydration');
prefs = await hydrate('bob', 'home-a'); assert.deepEqual(prefs.pins, model.emptyWidgetPins());
prefs = await hydrate('alice', 'home-a'); assert.deepEqual(prefs.pins, { dashboard: ['latest'], electricity: ['latest'] });
await prefs.toggle('dashboard', 'latest');
prefs = preferencesFor('alice', 'home-a'); assert.deepEqual(prefs.pins, { dashboard: [], electricity: ['latest'] });
assert.deepEqual((await hydrate('alice', 'home-b')).pins, model.emptyWidgetPins());
prefs = await hydrate('alice', 'home-a');
for (const id of ['price', 'latest', 'month']) { await prefs.toggle('dashboard', id); prefs = preferencesFor('alice', 'home-a'); }
assert.deepEqual(prefs.pins.dashboard, ['price', 'latest', 'month']);
await prefs.move('dashboard', 'month', -1); prefs = preferencesFor('alice', 'home-a');
assert.deepEqual(prefs.pins.dashboard, ['price', 'month', 'latest']);
await prefs.move('dashboard', 'price', 1); prefs = preferencesFor('alice', 'home-a');
assert.deepEqual(prefs.pins, { dashboard: ['month', 'price', 'latest'], electricity: ['latest'] });
const storedOrder = storage.get('stromblik.widgets.v1.alice.home-a');
await prefs.move('dashboard', 'month', -1); await prefs.move('dashboard', 'latest', 1); await prefs.move('dashboard', 'budget', -1);
assert.equal(storage.get('stromblik.widgets.v1.alice.home-a'), storedOrder, 'Boundary/missing-widget moves are no-ops');
failSave = true; await prefs.move('dashboard', 'latest', -1); prefs = preferencesFor('alice', 'home-a');
assert.deepEqual(prefs.pins.dashboard, ['month', 'price', 'latest']); assert.match(prefs.error, /ikke gemmes/);
failSave = false;
await hydrate('bob', 'home-a'); prefs = await hydrate('alice', 'home-a');
assert.deepEqual(prefs.pins.dashboard, ['month', 'price', 'latest'], 'Saved widget order survives account switching and rehydration');
assert.equal(await prefs.reorder('dashboard', ['latest', 'month', 'price']), true);
prefs = preferencesFor('alice', 'home-a');
assert.deepEqual(prefs.pins.dashboard, ['latest', 'month', 'price']);
assert.deepEqual(prefs.pins.electricity, ['latest']);
assert.equal(await prefs.reorder('dashboard', ['latest', 'latest', 'month']), false, 'Drag result cannot duplicate/drop pinned widgets');
assert.equal(await prefs.reorder('dashboard', ['latest', 'month']), false);
failSave = true; assert.equal(await prefs.reorder('dashboard', ['month', 'price', 'latest']), false); failSave = false;
prefs = preferencesFor('alice', 'home-a'); assert.deepEqual(prefs.pins.dashboard, ['latest', 'month', 'price']);
await hydrate('bob', 'home-a'); prefs = await hydrate('alice', 'home-a');
assert.deepEqual(prefs.pins.dashboard, ['latest', 'month', 'price'], 'Complete drag order is persisted and restored');
console.log('PASS: actual preference hook persistence, reload, independent removal, failed save and user/household isolation. Synthetic AsyncStorage.');
console.log('PASS: dashboard drag-list integration, disabled saves, visible errors, validated complete-order drops, placement independence and persisted-order reload. Synthetic JSX/storage.');
assert.equal(await prefs.customize('latest', { background: 'navy', text: 'white' }), true);
prefs = preferencesFor('alice', 'home-a');
assert.deepEqual(prefs.appearances.latest, { background: 'navy', text: 'white' });
await prefs.reorder('dashboard', ['month', 'latest', 'price']);
prefs = preferencesFor('alice', 'home-a');
assert.deepEqual(prefs.appearances.latest, { background: 'navy', text: 'white' }, 'Drag saves preserve colors');
await hydrate('bob', 'home-a'); prefs = await hydrate('alice', 'home-a');
assert.deepEqual(prefs.appearances.latest, { background: 'navy', text: 'white' }, 'Colors survive reload');
assert.deepEqual(preferencesFor('bob', 'home-a').appearances, {}, 'No other user colors before hydration');
prefs = await hydrate('alice', 'home-a');
failSave = true; assert.equal(await prefs.customize('latest', null), false); failSave = false;
prefs = preferencesFor('alice', 'home-a');
assert.equal(prefs.appearances.latest.background, 'navy', 'Failed reset retains saved colors');
await prefs.customize('price', { background: 'rose', text: 'dark' });
prefs = preferencesFor('alice', 'home-a');
const pinsBeforeReset = structuredClone(prefs.pins);
await prefs.customize('latest', null); prefs = preferencesFor('alice', 'home-a');
assert.equal(prefs.appearances.latest, undefined);
assert.equal(prefs.appearances.price.background, 'rose', 'Reset only affects selected widget');
assert.deepEqual(prefs.pins, pinsBeforeReset, 'Reset preserves placements and order');
await hydrate('bob', 'home-a'); prefs = await hydrate('alice', 'home-a');
assert.equal(prefs.appearances.latest, undefined, 'Reset persists after reload');

// Exercise the actual card editor through hook rerenders; no platform screenshots claimed.
slots = []; cursor = 0;
const editorCalls = [];
const editorPreferences = { ...prefs, customize: async (...args) => { editorCalls.push(args); return true; } };
const editorWidgets = load('../src/components/ElectricityWidgets.tsx');
const cardElement = nodes(editorWidgets.ElectricityWidgetsPage({ preferences: editorPreferences, data })).find(n => typeof n.type === 'function' && n.props.id === 'latest');
function editorTree() { cursor = 0; return cardElement.type(cardElement.props); }
let editor = editorTree();
nodes(editor).find(n => n.props.accessibilityLabel === 'Tilpas Seneste dags forbrug').props.onPress();
editor = editorTree();
assert.ok(nodes(editor).some(n => n.type === 'Modal'));
assert.ok(nodes(editor).find(n => n.props.accessibilityLabel === 'Hvid tekst').props.disabled, 'Unreadable white-on-white cannot be selected');
nodes(editor).find(n => n.props.accessibilityLabel === 'Mørkeblå').props.onPress();
editor = editorTree();
assert.equal(nodes(editor).find(n => n.props.accessibilityLabel === 'Hvid tekst').props.disabled, false);
assert.equal(nodes(editor).find(n => n.props.accessibilityLabel === 'Mørk tekst').props.disabled, true);
nodes(editor).find(n => n.props.accessibilityLabel === 'Hvid tekst').props.onPress();
editor = editorTree();
await nodes(editor).find(n => n.type === 'Pressable' && text(n) === 'Gem tilpasning').props.onPress();
await new Promise(resolve => setImmediate(resolve));
assert.deepEqual(editorCalls[0], ['latest', { background: 'navy', text: 'white' }]);
editor = editorTree();
assert.ok(!nodes(editor).some(n => n.type === 'Modal'), 'Successful save closes editor');
nodes(editor).find(n => n.props.accessibilityLabel === 'Tilpas Seneste dags forbrug').props.onPress();
editor = editorTree();
await nodes(editor).find(n => n.type === 'Pressable' && text(n) === 'Gendan standard').props.onPress();
await new Promise(resolve => setImmediate(resolve));
assert.deepEqual(editorCalls[1], ['latest', null]);
editor = editorTree();
nodes(editor).find(n => n.props.accessibilityLabel === 'Tilpas Seneste dags forbrug').props.onPress();
editor = editorTree();
nodes(editor).find(n => n.props.accessibilityLabel === 'Rosa').props.onPress();
editor = editorTree();
nodes(editor).find(n => n.props.accessibilityLabel === 'Luk tilpasning').props.onPress();
assert.equal(editorCalls.length, 2, 'Closing the editor does not save drafts');
editor = editorTree();
nodes(editor).find(n => n.props.accessibilityLabel === 'Tilpas Seneste dags forbrug').props.onPress();
editor = editorTree();
editorPreferences.customize = async () => false;
await nodes(editor).find(n => n.type === 'Pressable' && text(n) === 'Gem tilpasning').props.onPress();
await new Promise(resolve => setImmediate(resolve));
editor = editorTree();
assert.ok(nodes(editor).some(n => n.type === 'Modal'), 'Failed save keeps editor open');
assert.ok(nodes(editor).some(n => n.props.accessibilityRole === 'alert'));
console.log('PASS: appearance contrast, legacy/invalid preferences, isolated persistence, reorder preservation, per-widget reset, failed-reset rollback and actual JSX color editor/save/reset. Synthetic platform/storage.');

// Size is part of the same atomic appearance preference and survives pin/reorder saves.
slots = []; cursor = 0; pendingEffects = [];
prefs = await hydrate('size-user', 'home');
await prefs.customize('week', { background: 'blue', text: 'auto', size: 'compact' });
prefs = preferencesFor('size-user', 'home'); await prefs.toggle('dashboard', 'week');
prefs = preferencesFor('size-user', 'home');
assert.equal(prefs.appearances.week.size, 'compact');
await hydrate('another-user', 'home'); prefs = await hydrate('size-user', 'home');
assert.equal(prefs.appearances.week.size, 'medium', 'Legacy compact restores as medium');
assert.deepEqual(appearanceModel.parseWidgetAppearances('{"appearances":{"week":{"background":"blue","text":"auto","size":"invalid"}}}').week, { background: 'blue', text: 'auto' });
const sizePreferences = { ...prefs };
slots = []; cursor = 0;
const sizeElement = nodes(editorWidgets.ElectricityWidgetsPage({ preferences: sizePreferences, data })).find(n => typeof n.type === 'function' && n.props.id === 'week');
function sizeTree() { cursor = 0; return sizeElement.type(sizeElement.props); }
let sizeCard = sizeTree();
assert.ok(!nodes(sizeCard).some(n => n.props.accessibilityLabel?.includes('kWh')), 'Compact weekly widget hides the chart');
nodes(sizeCard).find(n => n.props.accessibilityLabel === 'Tilpas Ugens forbrug').props.onPress();
sizeCard = sizeTree();
nodes(sizeCard).find(n => n.props.accessibilityLabel === 'Normal widget').props.onPress();
sizeCard = sizeTree();
const preview = nodes(sizeCard).find(n => n.type === sizeElement.type && n.props.preview);
assert.equal(preview.props.preview.size, 'normal', 'Size changes are previewed without saving');
nodes(sizeCard).find(n => n.props.accessibilityLabel === 'Rosa').props.onPress(); sizeCard = sizeTree();
assert.equal(nodes(sizeCard).find(n => n.type === sizeElement.type && n.props.preview).props.preview.size, 'normal', 'Changing background preserves chosen size');
cursor = 0;
const largeCard = sizeElement.type({ ...sizeElement.props, preferences: { ...sizePreferences, appearances: { week: { background: 'blue', text: 'auto', size: 'large' } } } });
assert.equal(nodes(largeCard).filter(n => n.props.accessibilityLabel?.includes('kWh')).length, 7, 'Large weekly widget renders all seven labeled bars');
assert.equal(appearanceModel.widgetSize({ size: 'large' }), 'normal');
assert.equal(appearanceModel.widgetSize({ size: 'compact' }), 'medium');
assert.equal(appearanceModel.widgetSize(), 'normal');
assert.equal(appearanceModel.parseWidgetAppearances('{"appearances":{"week":{"background":"blue","text":"auto","size":"tiny"}}}').week.size, 'tiny');
const tinyPreferences = { ...sizePreferences, pins: { dashboard: ['week', 'price', 'month'], electricity: ['week', 'price', 'month'] }, appearances: { week: { background: 'blue', text: 'auto', size: 'tiny' }, price: { background: 'rose', text: 'dark', size: 'tiny' } } };
const tinyDashboard = widgets.PinnedElectricityWidgets({ location: 'dashboard', preferences: tinyPreferences, data, onManage() {} });
const gridList = nodes(tinyDashboard).find(n => n.type === 'DraggableWidgetList');
assert.equal(gridList.props.isTiny('week'), true); assert.equal(gridList.props.isTiny('price'), true); assert.equal(gridList.props.isTiny('month'), false);
const tinyEl = widgets.PinnedElectricityWidgets({ location: 'electricity', preferences: tinyPreferences, data, onManage() {} });
assert.equal(nodes(tinyEl).filter(n => n.props.style?.width === '48%').length, 2, 'El page lays out both tiny widgets at half width');
assert.equal(nodes(tinyEl).filter(n => n.props.style?.width === '100%').length, 1);
cursor = 0;
const tinyCard = sizeElement.type({ ...sizeElement.props, preferences: tinyPreferences });
assert.ok(!nodes(tinyCard).some(n => n.props.accessibilityLabel?.includes('kWh')), 'Tiny weekly widget has no full-size chart');
assert.ok(text(tinyCard).includes(data.week.detail), 'Tiny preserves the actual measurement date range');
slots = []; cursor = 0; pendingEffects = [];
prefs = await hydrate('size-user', 'home');
await prefs.customize('week', { background: 'navy', text: 'white', size: 'tiny' });
await hydrate('another-user', 'home'); prefs = await hydrate('size-user', 'home');
assert.deepEqual(prefs.appearances.week, { background: 'navy', text: 'white', size: 'tiny' }, 'Tiny size and colors persist together');
await prefs.customize('week', null); prefs = preferencesFor('size-user', 'home');
assert.equal(appearanceModel.widgetSize(prefs.appearances.week), 'normal', 'Reset restores normal full-width size');
assert.deepEqual(prefs.pins.dashboard, ['week'], 'Reset keeps tiny widget pinned');

// Actual context navigation updates chart selection, destination and scroll state.
slots = []; cursor = 0; pendingEffects = [];
dependencies.react.createContext = () => ({ Provider: 'Provider' });
dependencies.react.createElement = (type, props) => ({ type, props });
const viewState = load('../src/hooks/useDashboardViewState.ts');
function navigationState() { cursor = 0; return viewState.DashboardViewStateProvider({ children: null }).props.value; }
let nav = navigationState(); nav.openWidget('latest', '2026-10-13'); nav = navigationState();
assert.equal(nav.activeTab, 'electricity'); assert.equal(nav.electricAggregation, 'Hour'); assert.equal(nav.electricAnchor, '2026-10-13'); assert.equal(nav.widgetDestination.section, 'usage');
nav.openWidget('week', '2026-10-14'); nav = navigationState(); assert.equal(nav.electricAggregation, 'Day');
nav.openWidget('priceStatus'); nav = navigationState(); assert.equal(nav.widgetDestination.section, 'prices'); assert.equal(nav.scrollPositions.electricity, 0);
nav.openWidget('budget'); nav = navigationState(); assert.equal(nav.activeTab, 'profile'); assert.equal(nav.widgetDestination.section, 'budget');
nav.setActiveTab('home'); nav = navigationState(); assert.equal(nav.widgetDestination, null, 'Ordinary navigation clears shortcut focus');
console.log('PASS: weekly windows/gaps/zeros/month boundaries, comparable periods, relative price status with negative/flat/quarter-hour/DST days, size persistence/preview and actual shortcut navigation. Synthetic fixtures.');

let destination = { section: 'usage' };
dependencies['../hooks/useDashboardViewState'] = { useDashboardViewState: () => ({ setActiveTab() {}, openWidget() {}, widgetDestination: destination }) };
const focusedScreens = load('../src/screens/SecondaryTabsScreen.tsx');
const focusedProps = { ...screenProps, activeTab: 'electricity', selectedSupplier: { name: 'Fixture' }, prices: fullPriceDay, now };
function focusedPage(props = focusedProps) { slots = []; cursor = 0; pendingEffects = []; return focusedScreens.SecondaryTabScreen(props); }
let focused = nodes(focusedPage());
assert.ok(focused.findIndex(n => n.type === 'ElectricityUsageCard') < focused.findIndex(n => n.type === widgets.WidgetsEntry), 'Consumption shortcut puts actual usage graph first');
assert.equal(focused.filter(n => n.type === 'ElectricityUsageCard').length, 1);
destination = { section: 'prices' }; focused = nodes(focusedPage());
assert.ok(focused.findIndex(n => n.type === 'PriceChart') < focused.findIndex(n => n.type === widgets.WidgetsEntry), 'Price shortcut puts price graph first');
assert.equal(focused.filter(n => n.type === 'PriceChart').length, 1);
assert.equal(nodes(focusedPage({ ...focusedProps, pricesAreSample: true })).filter(n => n.type === 'PriceChart').length, 0, 'No unlabeled example price graph');
destination = { section: 'budget' };
assert.equal(focusedPage({ ...focusedProps, activeTab: 'profile' }).props.openBudgetOnMount, true);

dependencies['../hooks/useHouseholdSession'] = { useHouseholdSession: () => ({ households: [], householdId: 'fixture' }) };
dependencies['react-native'].Keyboard = { addListener: () => ({ remove() {} }) };
dependencies['react-native'].Platform = { OS: 'web' };
const { ProfilePage } = load('../src/components/ProfilePage.tsx');
slots = []; cursor = 0; pendingEffects = [];
const profileProps = { openBudgetOnMount: true, consumptionBudgetUnit: 'kwh', consumptionBudgetLimit: 425, addressSuggestions: [], selectedSupplier: { name: 'Fixture' } };
ProfilePage(profileProps); pendingEffects.splice(0).forEach(fn => fn()); cursor = 0;
const budgetProfile = ProfilePage(profileProps);
assert.equal(nodes(budgetProfile).find(n => n.props.accessibilityLabel === 'Månedlig forbrugsgrænse').props.value, '425', 'Budget shortcut opens existing budget editor with current value');
console.log('PASS: actual JSX focused usage/price destinations, sample-price suppression and direct existing Profile budget editor. Synthetic platform.');
