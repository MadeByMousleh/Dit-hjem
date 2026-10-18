import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { AccessibilityInfo, Animated, PanResponder, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { colors } from '../styles/theme';
import { widgetHaptic } from '../utils/widgetHaptics';
import { widgetDragPosition, widgetGridDragPosition, widgetTrackLayout, widgetGridRowHeight, type WidgetSpan, type WidgetLayout } from '../utils/widgetDrag';

export type WidgetDragScroll = {
  ref: RefObject<ScrollView | null>;
  offset: RefObject<number>;
  maxOffset: RefObject<number>;
};
type Props = {
  ids: string[]; disabled: boolean; label: (id: string) => string;
  renderCard: (id: string, onHold?: (event: { nativeEvent: { pageY: number; pageX: number } }) => void) => ReactNode;
  handleOnly?: (id: string) => boolean;
  onReorder: (ids: string[]) => Promise<boolean>;
  onDragChange?: (active: boolean) => void;
  onHold?: (id: string) => void;
  selectedId?: string | null;
  onActivate?: (id: string) => void;
  scroll?: WidgetDragScroll;
  isTiny?: (id: string) => boolean;
  gridSpans?: (id: string) => WidgetSpan;
  rowHeight?: number;
};
type Drag = { id: string; ids: string[]; layouts: Record<string, WidgetLayout>; startY: number; fingerY: number; startX: number; fingerX: number; width: number; tiny: Record<string, boolean>; spans?: Record<string, WidgetSpan>; rowHeight?: number; scrollStart: number; viewport: { top: number; height: number } | null; frame: number; previousTime: number };

export function WidgetTrackGrid({ ids, spans, rowHeight, renderCard }: { ids: string[]; spans: (id: string) => WidgetSpan; rowHeight: number; renderCard: (id: string) => ReactNode }) {
  const [width, setWidth] = useState(0);
  const track = widgetTrackLayout(ids, Object.fromEntries(ids.map(id => [id, spans(id)])), width, rowHeight);
  return <View style={{ position: 'relative', height: track.height }} onLayout={event => setWidth(event.nativeEvent.layout.width)}>{ids.map(id => <View key={id} style={{ position: 'absolute', left: track.layouts[id]!.x, top: track.layouts[id]!.y, width: track.layouts[id]!.width, height: track.layouts[id]!.height }}>{renderCard(id)}</View>)}</View>;
}

export function DraggableWidgetList(props: Props) {
  const latest = useRef(props); latest.current = props;
  const [order, setOrder] = useState(props.ids);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [gridWidth, setGridWidth] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const layouts = useRef<Record<string, WidgetLayout>>({});
  const shifts = useRef(new Map<string, Animated.Value>());
  const shiftsX = useRef(new Map<string, Animated.Value>());
  const containerWidth = useRef(0);
  const lift = useRef(new Animated.Value(1)).current;
  const drag = useRef<Drag | null>(null), settling = useRef(false), alive = useRef(true);
  const scrollLocked = useRef(false);
  const held = useRef(false);
  const pressedWhileEditing = useRef(false);
  const offset = (id: string) => {
    if (!shifts.current.has(id)) shifts.current.set(id, new Animated.Value(0));
    return shifts.current.get(id)!;
  };
  const offsetX = (id: string) => {
    if (!shiftsX.current.has(id)) shiftsX.current.set(id, new Animated.Value(0));
    return shiftsX.current.get(id)!;
  };
  const spring = (value: Animated.Value, toValue: number, done?: () => void) => {
    value.stopAnimation();
    if (reducedMotion) { value.setValue(toValue); done?.(); }
    else Animated.spring(value, { toValue, useNativeDriver: false, stiffness: 340, damping: 34, mass: 0.7, overshootClamping: true }).start(({ finished }) => { if (finished) done?.(); });
  };
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (live) setReducedMotion(value); }).catch(() => {});
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => { live = false; listener.remove(); };
  }, []);
  const orderKey = props.ids.join(',');
  useEffect(() => { if (!drag.current && !settling.current) setOrder(latest.current.ids); }, [orderKey]);
  useLayoutEffect(() => {
    if (!activeId) { for (const value of [...shifts.current.values(), ...shiftsX.current.values()]) { value.stopAnimation(); value.setValue(0); } lift.stopAnimation(); lift.setValue(1); targets.current.clear(); }
  }, [order.join(','), activeId, lift]);
  const position = (scrollOffset = latest.current.scroll?.offset.current ?? 0) => {
    const current = drag.current;
    if (!current) return null;
    const movement = current.fingerY - current.startY + scrollOffset - current.scrollStart;
    if (current.spans || Object.values(current.tiny).some(Boolean)) return widgetGridDragPosition(current.ids, current.layouts, current.tiny, current.width, current.id, movement, current.fingerX - current.startX, current.spans, current.rowHeight);
    const result = widgetDragPosition(current.ids, current.layouts, current.id, movement);
    return result ? { ...result, deltaX: 0, landingX: 0, offsetsX: Object.fromEntries(current.ids.map(id => [id, 0])) } : null;
  };
  const update = () => {
    const current = drag.current, result = position();
    if (!current || !result) return;
    for (const id of current.ids) {
      const value = result.offsets[id]!;
      if (id === current.id) offset(id).setValue(value);
      else if (targets.current.get(id) !== value) { targets.current.set(id, value); spring(offset(id), value); }
      const x = result.offsetsX[id]!;
      if (id === current.id) offsetX(id).setValue(x);
      else if (targets.current.get(`x:${id}`) !== x) { targets.current.set(`x:${id}`, x); spring(offsetX(id), x); }
    }
  };
  const targets = useRef(new Map<string, number>());
  const finish = (cancel = false) => {
    const current = drag.current, result = position();
    if (!current || !result || settling.current) return;
    settling.current = true;
    cancelAnimationFrame(current.frame);
    drag.current = null;
    const next = cancel ? current.ids : result.order;
    if (cancel) for (const id of current.ids) if (id !== current.id) { spring(offset(id), 0); spring(offsetX(id), 0); }
    spring(lift, 1);
    const landed = () => {
      if (!alive.current) return;
      for (const value of [...shifts.current.values(), ...shiftsX.current.values()]) { value.stopAnimation(); value.setValue(0); }
      setOrder(next); setActiveId(null);
      if (!cancel) widgetHaptic('drop');
      scrollLocked.current = false;
      latest.current.onDragChange?.(false);
      void (async () => {
        let saved = false;
        try { saved = cancel || next.every((id, index) => id === current.ids[index]) || await latest.current.onReorder(next); }
        catch { saved = false; }
        finally {
          if (alive.current) {
            settling.current = false;
            if (!saved) setOrder(latest.current.ids);
          }
        }
      })();
    };
    Animated.parallel([
      Animated.timing(offsetX(current.id), { toValue: cancel ? 0 : result.landingX, duration: reducedMotion ? 0 : 160, useNativeDriver: false }),
      Animated.timing(offset(current.id), { toValue: cancel ? 0 : result.landing, duration: reducedMotion ? 0 : 160, useNativeDriver: false }),
    ]).start(landed);
  };
  const begin = (id: string, pageY: number, pageX = 0) => {
    if (latest.current.disabled || drag.current || settling.current || order.length < 1 || !Number.isFinite(pageY)) return;
    if (!order.every(key => (layouts.current[key]?.height ?? 0) > 0)) return;
    const tiny = Object.fromEntries(order.map(key => [key, !!latest.current.isTiny?.(key)]));
    if ((latest.current.gridSpans || Object.values(tiny).some(Boolean)) && containerWidth.current <= 0) return;
    held.current = true;
    const current: Drag = { id, ids: [...order], layouts: { ...layouts.current }, startY: pageY, fingerY: pageY, startX: pageX, fingerX: pageX, tiny, width: containerWidth.current, scrollStart: latest.current.scroll?.offset.current ?? 0, viewport: null, frame: 0, previousTime: 0 };
    if (latest.current.gridSpans) { current.spans = Object.fromEntries(order.map(key => [key, latest.current.gridSpans!(key)])); current.rowHeight = latest.current.rowHeight ?? widgetGridRowHeight; }
    if (current.spans) current.layouts = widgetTrackLayout(current.ids, current.spans, current.width, current.rowHeight).layouts;
    drag.current = current; targets.current.clear(); setActiveId(id);
    widgetHaptic('grab');
    latest.current.onHold?.(id);
    scrollLocked.current = true; latest.current.onDragChange?.(true); spring(lift, reducedMotion ? 1 : 1.025);
    latest.current.scroll?.ref.current?.getNativeScrollRef()?.measureInWindow((_x: number, top: number, _width: number, height: number) => { if (drag.current === current) current.viewport = { top, height }; });
    const tick = (time: number) => {
      if (drag.current !== current) return;
      const elapsed = current.previousTime ? Math.min(40, time - current.previousTime) / 1000 : 0;
      current.previousTime = time;
      const scrolling = latest.current.scroll, viewport = current.viewport;
      if (scrolling && viewport) {
        const y = current.fingerY - viewport.top, edge = Math.min(72, viewport.height / 4);
        const speed = y < edge ? -Math.min(1, (edge - y) / edge) : y > viewport.height - edge ? Math.min(1, (y - viewport.height + edge) / edge) : 0;
        const next = Math.max(0, Math.min(scrolling.maxOffset.current, scrolling.offset.current + speed * 340 * elapsed));
        const before = position();
        const after = position(next);
        if (before && after && Math.abs(after.delta - before.delta) >= 0.5 && Math.abs(next - scrolling.offset.current) >= 0.5) { scrolling.offset.current = next; scrolling.ref.current?.scrollTo({ y: next, animated: false }); update(); }
      }
      current.frame = requestAnimationFrame(tick);
    };
    current.frame = requestAnimationFrame(tick);
  };
  const handlers = useRef({ update, finish }); handlers.current = { update, finish };
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: () => !!drag.current,
    onMoveShouldSetPanResponderCapture: () => !!drag.current,
    onPanResponderMove: event => { if (drag.current) { drag.current.fingerY = event.nativeEvent.pageY; if (Number.isFinite(event.nativeEvent.pageX)) drag.current.fingerX = event.nativeEvent.pageX; handlers.current.update(); } },
    onPanResponderRelease: () => handlers.current.finish(),
    onPanResponderTerminate: () => handlers.current.finish(true),
    onPanResponderTerminationRequest: () => !drag.current,
    onShouldBlockNativeResponder: () => !!drag.current,
  }).panHandlers, []);
  useEffect(() => { alive.current = true; return () => {
    alive.current = false;
    if (drag.current) cancelAnimationFrame(drag.current.frame);
    drag.current = null;
    for (const value of [...shifts.current.values(), ...shiftsX.current.values()]) value.stopAnimation();
    lift.stopAnimation();
    if (scrollLocked.current) { scrollLocked.current = false; latest.current.onDragChange?.(false); }
  }; }, [lift]);
  const track = props.gridSpans ? widgetTrackLayout(order, Object.fromEntries(order.map(id => [id, props.gridSpans!(id)])), gridWidth, props.rowHeight) : null;
  return <View {...pan} style={[s.grid, track && { height: track.height }]} onLayout={event => { const width = event.nativeEvent.layout.width; if (drag.current && width !== containerWidth.current) finish(true); containerWidth.current = width; if (width !== gridWidth) setGridWidth(width); }} onTouchEnd={event => { if (!event.nativeEvent.touches.length) finish(); }} onTouchCancel={() => finish(true)}>
    {order.map((id, index) => <Animated.View key={id} onLayout={event => { layouts.current[id] = event.nativeEvent.layout; }} style={[s.row, { width: props.isTiny?.(id) ? '48%' : '100%', zIndex: activeId === id ? 10 : props.selectedId === id ? 5 : 0, transform: [{ translateY: offset(id) }, { translateX: offsetX(id) }, { scale: activeId === id ? lift : 1 }] }, track && { position: 'absolute', left: track.layouts[id]!.x, top: track.layouts[id]!.y, width: track.layouts[id]!.width, height: track.layouts[id]!.height }]}>
      <Pressable style={track ? { width: '100%', height: '100%' } : undefined} accessibilityRole="button" accessibilityLabel={props.label(id)} accessibilityHint="Hold på widgettens overskrift for at flytte eller redigere den" accessibilityState={{ disabled: props.disabled, selected: activeId === id || props.selectedId === id }}
        onPressIn={() => { held.current = false; pressedWhileEditing.current = !!props.selectedId; }}
        onPress={() => { if (pressedWhileEditing.current && latest.current.selectedId !== id) return; if (!props.disabled && !held.current && !drag.current && !settling.current) props.onActivate?.(id); }}
        accessibilityActions={[...(index > 0 ? [{ name: 'moveUp', label: 'Flyt op' }] : []), ...(index < order.length - 1 ? [{ name: 'moveDown', label: 'Flyt ned' }] : [])]}
        onAccessibilityAction={event => {
          if (props.disabled || drag.current || settling.current) return;
          const target = index + (event.nativeEvent.actionName === 'moveUp' ? -1 : event.nativeEvent.actionName === 'moveDown' ? 1 : 0);
          if (target < 0 || target >= order.length || target === index) return;
          const next = [...order]; [next[index], next[target]] = [next[target]!, next[index]!];
          void props.onReorder(next);
        }}
        // Keep descendant resize responders enabled; action handlers guard disabled state.
        delayLongPress={350} onLongPress={props.handleOnly?.(id) ? undefined : event => begin(id, event.nativeEvent.pageY, event.nativeEvent.pageX)}>
        {props.renderCard(id, props.handleOnly?.(id) ? event => { if (!props.disabled) begin(id, event.nativeEvent.pageY, event.nativeEvent.pageX); } : undefined)}
      </Pressable>
      {activeId === id || props.selectedId === id ? <View pointerEvents="none" style={[s.outline, track && { bottom: 0 }, activeId !== id && { borderWidth: 1, borderColor: '#9AA8BB' }]} /> : null}
    </Animated.View>)}
  </View>;
}
const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start' },
  row: { position: 'relative' },
  outline: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 20, borderRadius: 24, borderWidth: 2, borderColor: colors.primary },
});
