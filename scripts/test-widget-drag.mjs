import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function compile(file, deps) {
  const js = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} }; vm.runInThisContext(`(function(require,module,exports){${js}\n})`)(name => { assert.ok(name in deps, name); return deps[name]; }, module, module.exports); return module.exports;
}
const math = compile('../src/utils/widgetDrag.ts', {});
const spans = { a: { columns: 2, rows: 8 }, b: { columns: 2, rows: 4 }, c: { columns: 2, rows: 4 }, d: { columns: 4, rows: 4 }, e: { columns: 4, rows: 12 } };
const tracks = math.widgetTrackLayout(Object.keys(spans), spans, 390);
assert.equal(tracks.layouts.a.height, 312);
assert.equal(tracks.layouts.b.height, tracks.layouts.c.height);
assert.equal(tracks.layouts.b.y, tracks.layouts.a.y);
assert.equal(tracks.layouts.c.y + tracks.layouts.c.height, tracks.layouts.a.height, 'Two single rows align with one double row including the gutter');
assert.equal(tracks.layouts.d.y, 320);
assert.equal(tracks.layouts.e.height, 472);
for (const [id, box] of Object.entries(tracks.layouts)) {
  assert.equal(box.y % 40, 0, 'Every widget begins on a grid track');
  for (const [other, target] of Object.entries(tracks.layouts)) if (id !== other) assert.ok(box.x + box.width <= target.x || target.x + target.width <= box.x || box.y + box.height <= target.y || target.y + target.height <= box.y, 'Spanning widgets never overlap');
}
const movedTrack = math.widgetGridDragPosition(Object.keys(spans), tracks.layouts, {}, 390, 'b', 236, 0, spans);
assert.ok(movedTrack);
const nextTracks = math.widgetTrackLayout(movedTrack.order, spans, 390);
for (const id of Object.keys(spans)) if (id !== 'b') {
  assert.equal(movedTrack.offsets[id], nextTracks.layouts[id].y - tracks.layouts[id].y);
  assert.equal(movedTrack.offsetsX[id], nextTracks.layouts[id].x - tracks.layouts[id].x);
}
const layout = { a: { y: 0, height: 100 }, b: { y: 100, height: 200 }, c: { y: 300, height: 120 } };
assert.equal(math.widgetDragPosition(['a', 'b', 'c'], layout, 'a', 90).target, 0);
const crossed = math.widgetDragPosition(['a', 'b', 'c'], layout, 'a', 130);
assert.deepEqual(crossed.order, ['b', 'a', 'c']); assert.deepEqual(crossed.offsets, { a: 130, b: -100, c: 0 }); assert.equal(crossed.landing, 200);
assert.deepEqual(math.widgetDragPosition(['a', 'b', 'c'], layout, 'b', 70).order, ['a', 'c', 'b'], 'Tall cards can cross short cards without crossing their center');
assert.equal(math.widgetDragPosition(['a', 'b', 'c'], layout, 'b', 1000).landing, 120);
assert.deepEqual(math.widgetDragPosition(['a', 'b', 'c'], layout, 'b', -60).order, ['b', 'a', 'c']);
assert.equal(math.widgetDragPosition(['a', 'b', 'c'], layout, 'a', -1000).delta, 0);
assert.equal(math.widgetDragPosition(['a', 'b', 'c'], layout, 'a', 1000).delta, 320);
assert.equal(math.widgetDragPosition(['a', 'b', 'c'], {}, 'a', 10), null);
const gridTiny = { a: true, b: true, c: false, d: true, e: true };
const gridHeights = { a: 100, b: 140, c: 200, d: 120, e: 100 };
const gridIds = ['a', 'b', 'c', 'd', 'e'];
const grid = math.widgetGridLayout(gridIds, gridHeights, gridTiny, 300);
assert.deepEqual(grid.a, { x: 0, y: 0, width: 144, height: 100 });
assert.equal(grid.b.x, 156); assert.equal(grid.b.y, 0);
assert.equal(grid.c.y, 140); assert.equal(grid.c.width, 300);
assert.equal(grid.d.y, 340); assert.equal(grid.e.y, 340);
const horizontal = math.widgetGridDragPosition(gridIds, grid, gridTiny, 300, 'a', 0, 156);
assert.deepEqual(horizontal.order, ['b', 'a', 'c', 'd', 'e']);
assert.equal(horizontal.landingX, 156); assert.equal(horizontal.offsetsX.b, -156);
const mixed = math.widgetGridDragPosition(gridIds, grid, gridTiny, 300, 'a', 240, 0);
assert.deepEqual(mixed.order, ['b', 'c', 'a', 'd', 'e']);
assert.equal(mixed.offsets.c, 0); assert.equal(mixed.offsetsX.d, 156);
const odd = math.widgetGridLayout(['a', 'c', 'b'], gridHeights, gridTiny, 300);
assert.equal(odd.c.y, 100); assert.equal(odd.b.y, 300); assert.equal(odd.b.x, 0, 'Unpaired tiny remains half-width; full row is not backfilled');
assert.equal(math.widgetGridDragPosition(gridIds, grid, gridTiny, 300, 'a', -999, -999).delta, 0);
assert.equal(math.widgetGridDragPosition(gridIds, grid, gridTiny, 300, 'a', 999, 999).deltaX, 156);

let slots, cursor, effects, animationCalls, frames, frameId, reduced, changes, saves, scrollCalls, saveResult;
function reset() { slots = []; cursor = 0; effects = []; animationCalls = []; frames = new Map(); frameId = 0; reduced = false; changes = []; saves = []; scrollCalls = []; saveResult = true; }
reset();
const react = {
  useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
  useRef(initial) { const i = cursor++; return slots[i] ?? (slots[i] = { current: initial }); },
  useMemo(fn, deps) { const i = cursor++, prior = slots[i]; if (!prior || deps.some((v, n) => v !== prior.deps[n])) slots[i] = { deps, value: fn() }; return slots[i].value; },
  useEffect(fn, deps) { const i = cursor++, prior = slots[i]; if (!prior || deps.some((v, n) => v !== prior.deps[n])) { prior?.cleanup?.(); slots[i] = { deps }; effects.push(() => { slots[i].cleanup = fn(); }); } },
};
react.useLayoutEffect = react.useEffect;
class Value { constructor(value) { this.value = value; } setValue(value) { this.value = value; } stopAnimation() {} }
const jsx = (type, props) => ({ type, props: props ?? {} });
const deps = {
  react, 'react/jsx-runtime': { jsx, jsxs: jsx }, '../utils/widgetDrag': math, '../styles/theme': { colors: { primary: 'blue' } },
  'react-native': { View: 'View', Pressable: 'Pressable', StyleSheet: { create: x => x },
    AccessibilityInfo: { isReduceMotionEnabled: async () => reduced, addEventListener: () => ({ remove() {} }) },
    PanResponder: { create: handlers => ({ panHandlers: handlers }) },
    Animated: { View: 'AnimatedView', Value, spring: (value, options) => ({ start: callback => { animationCalls.push(options); value.setValue(options.toValue); callback?.({ finished: true }); } }) },
  },
};
globalThis.requestAnimationFrame = fn => { const id = ++frameId; frames.set(id, fn); return id; };
globalThis.cancelAnimationFrame = id => frames.delete(id);
const { DraggableWidgetList } = compile('../src/components/DraggableWidgetList.tsx', deps);
function makeProps() {
  const props = { ids: ['a', 'b', 'c'], disabled: false, label: id => id, renderCard: id => jsx('Card', { id }),
    onDragChange: active => changes.push(active), onReorder: async ids => { saves.push(ids); const ok = await saveResult; if (ok) props.ids = ids; return ok; },
    scroll: { offset: { current: 100 }, maxOffset: { current: 2000 }, ref: { current: { getNativeScrollRef: () => ({ measureInWindow: fn => fn(0, 0, 400, 500) }), scrollTo: value => scrollCalls.push(value) } } },
  }; return props;
}
function render(props) { cursor = 0; const tree = DraggableWidgetList(props); effects.splice(0).forEach(fn => fn()); return tree; }
async function tick(props) { await new Promise(resolve => setImmediate(resolve)); return render(props); }
function nodes(tree) { return Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : []; }
function card(tree, id) { return nodes(tree).find(n => n.type === 'Pressable' && n.props.accessibilityLabel === id); }
function measure(tree, positions = layout) { for (const row of nodes(tree).filter(n => n.type === 'AnimatedView')) { const id = row.props.children[0].props.accessibilityLabel; row.props.onLayout({ nativeEvent: { layout: positions[id] } }); } }
let props = makeProps(), tree = render(props); tree = await tick(props); measure(tree);
assert.equal(tree.props.onMoveShouldSetPanResponder(), false, 'Ordinary page scrolling is not captured');
card(tree, 'a').props.onLongPress({ nativeEvent: { pageY: 80 } });
tree = render(props); assert.equal(tree.props.onMoveShouldSetPanResponder(), true); assert.deepEqual(changes, [true]);
assert.ok(animationCalls.some(call => call.toValue > 1), 'Long press lifts the selected card');
tree.props.onPanResponderMove({ nativeEvent: { pageY: 210 } });
assert.ok(animationCalls.some(call => call.toValue === -100), 'Neighbor springs into the released slot');
tree.props.onPanResponderRelease(); tree = await tick(props);
assert.deepEqual(saves, [['b', 'a', 'c']]); assert.deepEqual(changes, [true, false]); assert.equal(frames.size, 0);
assert.deepEqual(nodes(tree).filter(n => n.type === 'Pressable').map(n => n.props.accessibilityLabel), ['b', 'a', 'c']);

reset(); props = makeProps(); tree = render(props); tree = await tick(props); measure(tree);
card(tree, 'c').props.onLongPress({ nativeEvent: { pageY: 380 } }); tree = render(props);
tree.props.onPanResponderMove({ nativeEvent: { pageY: 100 } }); tree.props.onPanResponderTerminate(); tree = await tick(props);
assert.deepEqual(saves, []); assert.deepEqual(changes, [true, false]);
assert.deepEqual(nodes(tree).filter(n => n.type === 'Pressable').map(n => n.props.accessibilityLabel), ['a', 'b', 'c']);

reset(); props = makeProps(); saveResult = false; tree = render(props); tree = await tick(props); measure(tree);
card(tree, 'a').props.onLongPress({ nativeEvent: { pageY: 80 } }); tree = render(props);
tree.props.onPanResponderMove({ nativeEvent: { pageY: 210 } }); tree.props.onTouchEnd({ nativeEvent: { touches: [] } }); tree = await tick(props);
assert.deepEqual(nodes(tree).filter(n => n.type === 'Pressable').map(n => n.props.accessibilityLabel), ['a', 'b', 'c'], 'Failed save restores controlled order');

reset(); props = makeProps(); reduced = true; tree = render(props); tree = await tick(props); measure(tree);
card(tree, 'a').props.onLongPress({ nativeEvent: { pageY: 80 } }); tree = render(props);
tree.props.onPanResponderMove({ nativeEvent: { pageY: 210 } }); tree.props.onPanResponderRelease(); await tick(props);
assert.equal(animationCalls.length, 0, 'Reduced motion keeps drag functional without spring/lift animation');

reset(); props = makeProps(); tree = render(props); tree = await tick(props); measure(tree, { a: { y: 0, height: 200 }, b: { y: 200, height: 600 }, c: { y: 800, height: 500 } });
card(tree, 'a').props.onLongPress({ nativeEvent: { pageY: 80 } }); tree = render(props);
tree.props.onPanResponderMove({ nativeEvent: { pageY: 490 } });
function frame(time) { const [id, fn] = frames.entries().next().value; frames.delete(id); fn(time); }
frame(100); frame(116); assert.ok(scrollCalls.length); assert.ok(props.scroll.offset.current > 100, 'Edge scrolling advances with the held finger');
for (const slot of slots) slot?.cleanup?.(); assert.equal(frames.size, 0); assert.equal(changes.at(-1), false, 'Unmount restores parent scrolling and cancels animation frames');

reset(); props = makeProps(); props.disabled = true; tree = render(props); tree = await tick(props); measure(tree);
card(tree, 'a').props.onLongPress({ nativeEvent: { pageY: 80 } }); assert.equal(tree.props.onMoveShouldSetPanResponder(), false);
props.disabled = false; tree = render(props); card(tree, 'a').props.onAccessibilityAction({ nativeEvent: { actionName: 'moveDown' } }); await tick(props);
assert.deepEqual(saves, [['b', 'a', 'c']], 'Screen readers retain move actions without visible arrows');
reset(); props = makeProps(); const activations = []; props.onActivate = id => activations.push(id);
tree = render(props); tree = await tick(props); measure(tree);
card(tree, 'a').props.onPressIn(); card(tree, 'a').props.onPress();
assert.deepEqual(activations, ['a'], 'A normal tap opens widget details');
card(tree, 'a').props.onPressIn(); card(tree, 'a').props.onLongPress({ nativeEvent: { pageY: 80 } }); tree = render(props);
tree.props.onPanResponderRelease(); tree = await tick(props); card(tree, 'a').props.onPress();
assert.deepEqual(activations, ['a'], 'A held/released card must not accidentally open details');
card(tree, 'a').props.onPressIn(); card(tree, 'a').props.onPress();
assert.deepEqual(activations, ['a', 'a'], 'A fresh tap works after a drag');

reset(); props = makeProps(); props.isTiny = id => id !== 'c';
tree = render(props); tree = await tick(props);
tree.props.onLayout({ nativeEvent: { layout: { width: 300 } } });
const twoColumn = math.widgetGridLayout(props.ids, { a: 100, b: 100, c: 200 }, { a: true, b: true, c: false }, 300);
measure(tree, twoColumn);
assert.equal(nodes(tree).find(n => n.type === 'AnimatedView').props.style[1].width, '48%');
card(tree, 'a').props.onLongPress({ nativeEvent: { pageY: 50, pageX: 72 } }); tree = render(props);
tree.props.onPanResponderMove({ nativeEvent: { pageY: 50, pageX: 228 } });
assert.ok(animationCalls.some(call => call.toValue === -156), 'Neighbor animates horizontally into released column');
tree.props.onPanResponderRelease(); tree = await tick(props);
assert.deepEqual(saves, [['b', 'a', 'c']], 'Horizontal grid reorder is saved');
assert.deepEqual(changes, [true, false]);

reset(); props = makeProps(); props.isTiny = id => id !== 'c'; tree = render(props); tree = await tick(props);
tree.props.onLayout({ nativeEvent: { layout: { width: 300 } } }); measure(tree, twoColumn);
card(tree, 'a').props.onLongPress({ nativeEvent: { pageY: 50, pageX: 72 } }); tree = render(props);
tree.props.onPanResponderMove({ nativeEvent: { pageY: 50, pageX: 228 } }); tree.props.onPanResponderTerminate(); await tick(props);
assert.deepEqual(saves, [], 'Cancelled grid drag does not save');
console.log('PASS: actual drag geometry and component lifecycle: unequal card sizes, hold/lift, animated neighbors, drop persistence, cancellation, failed-save rollback, reduced motion, edge autoscroll, cleanup, disabled state and screen-reader movement. Synthetic RN gestures/animation; device visual testing still required.');
console.log('PASS: mixed full/half-width grid packing, odd counts, bounds, horizontal neighbor animation, drop persistence and cancellation. Synthetic RN layout/gestures.');
reset(); props = makeProps();
const fixedSpans = { a: { columns: 2, rows: 8 }, b: { columns: 2, rows: 4 }, c: { columns: 2, rows: 4 } };
props.gridSpans = id => fixedSpans[id];
tree = render(props); tree = await tick(props);
tree.props.onLayout({ nativeEvent: { layout: { width: 300 } } }); tree = render(props);
measure(tree, math.widgetTrackLayout(props.ids, fixedSpans, 300).layouts);
card(tree, 'b').props.onLongPress({ nativeEvent: { pageY: 50, pageX: 228 } }); tree = render(props);
tree.props.onPanResponderMove({ nativeEvent: { pageY: 210, pageX: 228 } });
assert.ok(animationCalls.some(call => call.toValue === -160));
tree.props.onPanResponderRelease(); tree = await tick(props);
assert.deepEqual(saves, [['a', 'c', 'b']], 'Fixed-track reorder uses row spans rather than measured variable-height flex packing');
assert.deepEqual(math.resizeWidgetSpan({columns:2,rows:4},-999,-999,390,{columns:2,rows:4}),{columns:2,rows:4});
assert.deepEqual(math.resizeWidgetSpan({columns:2,rows:4},100,40,390,{columns:2,rows:4}),{columns:3,rows:5});
assert.equal(math.widgetGridColumns(720),8);
const { ResizableWidget } = compile('../src/components/ResizableWidget.tsx', deps);
reset(); const previews = [], resized = [];
const resizeProps = { children: jsx('Card',{}), enabled: true, disabled: false, label: 'fixture', span: {columns:2,rows:4}, minimum: {columns:2,rows:4}, width:390, rowHeight:32, onPreview: next=>previews.push(next), onCommit: async next=>{resized.push(next);return false;} };
function resizeTree() {cursor=0;const result=ResizableWidget(resizeProps);effects.splice(0).forEach(fn=>fn());return result;}
let resizeView=resizeTree();
const resizeHandle=(axis='both')=>nodes(resizeView).find(n=>n.props.testID===`resize-${axis}-fixture`);
resizeHandle().props.onPanResponderGrant();resizeHandle().props.onPanResponderMove({}, {dx:-999,dy:-999});
assert.deepEqual(previews.at(-1),{columns:2,rows:4},'Minimum size enforced');
resizeHandle().props.onPanResponderMove({}, {dx:100,dy:40});
assert.deepEqual(previews.at(-1),{columns:3,rows:5});
resizeHandle().props.onPanResponderRelease();await new Promise(done=>setImmediate(done));
assert.deepEqual(resized,[{columns:3,rows:5}]);assert.equal(previews.at(-1),null,'Failed save clears live preview');
resizeHandle().props.onPanResponderGrant();resizeHandle().props.onPanResponderMove({}, {dx:100,dy:40});resizeHandle().props.onPanResponderTerminate();
assert.equal(resized.length,1,'Cancelled resize never saves');assert.equal(previews.at(-1),null);
resizeHandle().props.onPanResponderGrant();resizeProps.width=720;resizeView=resizeTree();assert.equal(previews.at(-1),null,'Orientation change cancels resize');
let resolveResize;
resizeProps.onCommit=next=>new Promise(resolve=>{resolveResize=resolve;});resizeView=resizeTree();
resizeHandle().props.onPanResponderGrant();resizeHandle().props.onPanResponderMove({}, {dx:100,dy:40});resizeHandle().props.onPanResponderRelease();
for(const slot of slots)slot?.cleanup?.();assert.equal(previews.at(-1),null,'Unmount unlocks scrolling even during save');resolveResize(false);await new Promise(done=>setImmediate(done));
console.log('PASS: resize handles, fine snapping/minimums, cancellation, failed-save preview rollback, responsive width changes and unmount during save. Synthetic native responders.');
