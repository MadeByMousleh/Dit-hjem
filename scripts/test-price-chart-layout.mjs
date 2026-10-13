import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { jsx, jsxs } from 'react/jsx-runtime';

function load(file, dependencies = {}) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const module = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${output}\n})`)(name => {
    if (name in dependencies) return dependencies[name];
    throw new Error(`Unexpected import: ${name}`);
  }, module, module.exports);
  return module.exports;
}

const theme = load('../src/styles/theme.ts');
const { styles } = load('../src/styles/appStyles.ts', {
  'react-native': { StyleSheet: { create: value => value } }, './theme': theme,
});
const { PriceChart } = load('../src/components/PriceChart.tsx', {
  'react/jsx-runtime': { jsx, jsxs },
  react: { useMemo: fn => fn(), useCallback: fn => fn, useEffect: () => {},
    useRef: current => ({ current }), useState: value => [value, () => {}] },
  'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView',
    PanResponder: { create: () => ({ panHandlers: {} }) } },
  './AppIcon': { AppIcon: 'Icon' },
  '../utils/formatting': { dayKey: date => date.toISOString().slice(0, 10), formatPrice: String },
  '../styles/theme': theme, '../styles/appStyles': { styles },
  '../hooks/useBarScrub': { useBarScrub: () => ({ panHandlers: {} }) },
  '../utils/barScrub': { tickSelection: () => {} },
});
const flatten = value => Object.assign({}, ...[value].flat(Infinity).filter(Boolean));
function barsIn(node) {
  if (!node || typeof node !== 'object') return [];
  const children = [node.props?.children].flat(Infinity);
  return [
    ...(node.type === 'View' && node.props.style?.includes?.(styles.bar) ? [flatten(node.props.style)] : []),
    ...children.flatMap(barsIn),
  ];
}
const points = [1, 0.5, 0.01, 0].map((price, index) => ({
  startsAt: new Date(Date.UTC(2026, 9, 5, 10 + index)), totalOrePerKwh: price * 100,
}));
for (const now of [points[0].startsAt.getTime(), points[2].startsAt.getTime(), Date.UTC(2026, 9, 5)]) {
  const bars = barsIn(PriceChart({ points, now }));
  assert.equal(bars.length, 4);
  assert.equal(bars[1].height / bars[0].height, 0.5);
  assert.equal(bars[2].height / bars[0].height, 0.01);
  assert.equal(bars[3].height, 0);
  for (const bar of bars) {
    assert.ok((bar.minHeight ?? 0) <= bar.height, 'Shared styles must not enlarge short bars');
    assert.equal(bar.flexShrink, 0);
  }
}
console.log('PASS: rendered price bar styles preserve 1:0.5:0.01:0 ratios, including selected/current/cheapest bars.');
