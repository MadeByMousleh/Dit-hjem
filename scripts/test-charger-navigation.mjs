import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

let selected, backHandler;
const effects = [];
const jsx = (type, props) => ({ type, props: props ?? {} });
const native = { View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView', StyleSheet: { create: value => value, hairlineWidth: 1 }, BackHandler: { addEventListener: (_, fn) => { backHandler = fn; return { remove() {} }; } } };
const colors = { primary: 'blue', primarySoft: 'lightblue', ink: 'black', muted: 'grey', white: 'white', paper: 'offwhite', line: 'grey' };
const dependencies = {
  'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
  react: { useEffect: effect => effects.push(effect), useState: value => [value, () => {}] },
  'react-native': native,
  'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) },
  '../styles/theme': { colors },
  './AppIcon': { AppIcon: 'AppIcon' }, '../components/AppIcon': { AppIcon: 'AppIcon' },
  '../hooks/useDashboardViewState': { useDashboardViewState: () => ({ setActiveTab: tab => { selected = tab; } }) },
  '../hooks/useRememberedScroll': { useRememberedScroll: () => ({}) },
};
function load(path) {
  const js = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText;
  const mod = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${js}\n})`)(name => dependencies[name] ?? new Proxy({}, { get: (_, key) => String(key) }), mod, mod.exports);
  return mod.exports;
}
function nodes(tree) { return Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : []; }
function text(tree) { return Array.isArray(tree) ? tree.map(text).join(' ') : tree && typeof tree === 'object' ? text(tree.props?.children) : typeof tree === 'string' ? tree : ''; }
const charger = load('../src/components/ChargerPage.tsx');
dependencies['../components/ChargerPage'] = charger;
const screen = load('../src/screens/SecondaryTabsScreen.tsx');
const props = { activeTab: 'car', styles: {}, colors, electricityUsage: { auth: { householdId: 'fixture' } } };
const carTree = screen.SecondaryTabScreen(props);
const entry = nodes(carTree).find(node => node.type === charger.ChargerEntry);
assert.ok(entry, 'Charger entry exists without a connected Tesla');
const entryTree = charger.ChargerEntry(entry.props);
nodes(entryTree).find(node => node.props.accessibilityLabel === 'Åbn ladeboks').props.onPress();
assert.equal(selected, 'charger');
effects.length = 0;
const pageTree = screen.SecondaryTabScreen({ ...props, activeTab: 'charger' });
assert.ok(nodes(pageTree).some(node => node.type === charger.ChargerPage));
nodes(pageTree).find(node => node.props.accessibilityLabel === 'Tilbage til Bil').props.onPress();
assert.equal(selected, 'car');
effects.forEach(effect => effect()); selected = null;
assert.equal(backHandler(), true); assert.equal(selected, 'car', 'Android back returns to the parent car page');
const rendered = charger.ChargerPage();
assert.ok(text(rendered).includes('Ikke forbundet'));
const start = nodes(rendered).find(node => node.props.accessibilityLabel === 'Start opladning');
assert.equal(start.props.disabled, true); assert.equal(start.props.accessibilityState.disabled, true);
assert.equal(start.props.onPress, undefined, 'Unpaired UI cannot send a command or simulate charging');
const tabs = load('../src/components/BottomTabs.tsx').BottomTabs({ activeTab: 'charger', onSelect() {} });
const selectedTabs = nodes(tabs).filter(node => node.props.accessibilityRole === 'tab' && node.props.accessibilityState.selected);
assert.equal(selectedTabs.length, 1); assert.equal(selectedTabs[0].props.accessibilityLabel, 'Bil');
console.log('PASS: actual charger entry/page, Tesla-independent access, parent/header/Android back navigation, selected Bil tab and disabled unpaired start. Synthetic JSX/platform; no charger transport.');
