import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Animated, PanResponder, Pressable, View } from 'react-native';
import { AppIcon } from './AppIcon';
import { resizeWidgetSpan, widgetGridColumns, widgetGridGap, type WidgetSpan } from '../utils/widgetDrag';
import { widgetHaptic } from '../utils/widgetHaptics';

type Props = { children: ReactNode; enabled: boolean; disabled: boolean; label: string; span: WidgetSpan; minimum: WidgetSpan; maximumRows?: number; width: number; rowHeight: number; onPreview: (span: WidgetSpan | null) => void; onCommit: (span: WidgetSpan) => Promise<boolean>; onRemove?: () => Promise<void> };
export function ResizableWidget(props: Props) {
  const latest = useRef(props); latest.current = props;
  const active = useRef<{ start: WidgetSpan; next: WidgetSpan } | null>(null);
  const engaged = useRef(false);
  const alive = useRef(true);
  const reveal = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(reveal, { toValue: props.enabled ? 1 : 0, duration: 140, useNativeDriver: true }).start(); }, [props.enabled, reveal]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; if (engaged.current) latest.current.onPreview(null); active.current = null; engaged.current = false; }; }, []);
  useEffect(() => { if (active.current) { active.current = null; engaged.current = false; latest.current.onPreview(null); } }, [props.width, props.rowHeight]);
  const gestures = useMemo(() => (['both', 'width', 'height'] as const).map(axis => PanResponder.create({
    onStartShouldSetPanResponderCapture: () => latest.current.enabled && !latest.current.disabled && latest.current.width > 0 && !engaged.current,
    onStartShouldSetPanResponder: () => latest.current.enabled && !latest.current.disabled && latest.current.width > 0 && !engaged.current,
    onMoveShouldSetPanResponder: () => !!active.current,
    onPanResponderGrant: () => { engaged.current = true; active.current = { start: latest.current.span, next: latest.current.span }; widgetHaptic('grab'); latest.current.onPreview(latest.current.span); },
    onPanResponderMove: (_event, gesture) => {
      const current = active.current; if (!current) return;
      const next = resizeWidgetSpan(current.start, gesture.dx, gesture.dy, latest.current.width, latest.current.minimum, latest.current.rowHeight, axis);
      next.rows = Math.min(latest.current.maximumRows ?? 96, next.rows);
      if (next.columns !== current.next.columns || next.rows !== current.next.rows) { current.next = next; widgetHaptic('step'); latest.current.onPreview(next); }
    },
    onPanResponderRelease: () => {
      const current = active.current; active.current = null; if (!current) return;
      widgetHaptic('drop');
      void (async () => { try { if (current.next.columns !== current.start.columns || current.next.rows !== current.start.rows) await latest.current.onCommit(current.next); } catch { /* Preference owner reports save errors and restores its previous size. */ } finally { engaged.current = false; if (alive.current) latest.current.onPreview(null); } })();
    },
    onPanResponderTerminate: () => { active.current = null; engaged.current = false; latest.current.onPreview(null); },
    onPanResponderTerminationRequest: () => false,
    onShouldBlockNativeResponder: () => true,
  }).panHandlers), []);
  return <View collapsable={false} style={{ position: 'relative', width: '100%', height: props.span.rows * (props.rowHeight + widgetGridGap) - widgetGridGap }}>{props.children}
    <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, elevation: 8 }}>
    {props.enabled && props.onRemove ? <Pressable accessibilityRole="button" accessibilityLabel="Fjern widget fra dashboard" disabled={props.disabled} onPress={event => { event.stopPropagation(); widgetHaptic('drop'); void props.onRemove?.(); }} style={{ position: 'absolute', top: 0, left: 0, width: 44, height: 44, zIndex: 5, alignItems: 'center', justifyContent: 'center' }}><View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#E8EAEE', alignItems: 'center', justifyContent: 'center' }}><AppIcon name="minus" size={17} color="#414955" /></View></Pressable> : null}
    {props.enabled ? <Animated.View testID={`resize-both-${props.label}`} accessible accessibilityRole="adjustable" accessibilityLabel={`Tilpas størrelse: ${props.label}`} accessibilityState={{ disabled: props.disabled }} accessibilityValue={{ text: `${props.span.columns} kolonner, ${props.span.rows} rækker` }} accessibilityActions={[{ name: 'increment', label: 'Større' }, { name: 'decrement', label: 'Mindre' }]} onAccessibilityAction={event => {
    if (latest.current.disabled) return;
    const direction = event.nativeEvent.actionName === 'increment' ? 1 : event.nativeEvent.actionName === 'decrement' ? -1 : 0;
    const next = resizeWidgetSpan(latest.current.span, direction * (latest.current.width + widgetGridGap) / widgetGridColumns(latest.current.width), direction * (latest.current.rowHeight + widgetGridGap), latest.current.width, latest.current.minimum, latest.current.rowHeight);
    next.rows = Math.min(latest.current.maximumRows ?? 96, next.rows);
    void latest.current.onCommit(next);
  }} {...gestures[0]} style={{ position: 'absolute', width: 48, height: 48, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 4, opacity: reveal, transform: [{ scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] }}>
    <View pointerEvents="none" style={{ width: 28, height: 28, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: 15, height: 15, borderRightWidth: 3, borderBottomWidth: 3, borderColor: '#59616D', borderBottomRightRadius: 8 }} />
    </View>
  </Animated.View> : null}</View></View>;
}
