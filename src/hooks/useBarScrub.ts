import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { PanResponder, ScrollView, View } from 'react-native';
import { barIndexAt } from '../utils/barScrub';

type Options = {
  count: number;
  stride: number;
  inset: number;
  viewportWidth: number;
  contentWidth: number;
  scrollRef: RefObject<ScrollView | null>;
  onSelect: (index: number, initial: boolean) => void;
  onScrubChange?: (active: boolean) => void;
};

// Pressable owns the initial long press. After that, the viewport captures
// movement so the same finger can cross child bars without releasing.
export function useBarScrub(options: Options) {
  const latest = useRef(options);
  latest.current = options;
  const viewportRef = useRef<View>(null);
  const viewportPageX = useRef(0);
  const measured = useRef(false);
  const scrollX = useRef(0);
  const fingerPageX = useRef<number | null>(null);
  const active = useRef(false);
  const suppressTapUntil = useRef(0);
  const [isScrubbing, setIsScrubbing] = useState(false);

  const selectAt = useCallback((pageX: number) => {
    if (!active.current || !measured.current) return;
    const config = latest.current;
    const index = barIndexAt(pageX, viewportPageX.current, scrollX.current, config.inset, config.stride, config.count);
    if (index >= 0) config.onSelect(index, false);
  }, []);

  const begin = useCallback((index: number, pageX: number) => {
    if (index < 0 || index >= latest.current.count) return;
    active.current = true;
    measured.current = false;
    fingerPageX.current = pageX;
    suppressTapUntil.current = Date.now() + 1000;
    setIsScrubbing(true);
    latest.current.onScrubChange?.(true);
    latest.current.onSelect(index, true);
    viewportRef.current?.measureInWindow(x => {
      if (!active.current) return;
      viewportPageX.current = x;
      measured.current = true;
      if (fingerPageX.current !== null) selectAt(fingerPageX.current);
    });
  }, [selectAt]);

  const end = useCallback(() => {
    if (!active.current) return;
    active.current = false;
    measured.current = false;
    fingerPageX.current = null;
    // Pressable may dispatch onPress just after a long-press release.
    suppressTapUntil.current = Date.now() + 250;
    setIsScrubbing(false);
    latest.current.onScrubChange?.(false);
  }, []);

  const panHandlers = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: () => active.current,
    onMoveShouldSetPanResponderCapture: () => active.current,
    onPanResponderMove: event => {
      fingerPageX.current = event.nativeEvent.pageX;
      selectAt(event.nativeEvent.pageX);
    },
    onPanResponderRelease: end,
    onPanResponderTerminate: end,
    onPanResponderTerminationRequest: () => !active.current,
  }).panHandlers, [end, selectAt]);

  useEffect(() => {
    if (!isScrubbing) return;
    let frame: number;
    let previous = 0;
    const step = (time: number) => {
      const elapsed = previous ? Math.min(time - previous, 50) / 1000 : 0;
      previous = time;
      const config = latest.current;
      const finger = fingerPageX.current;
      if (finger !== null && measured.current && config.viewportWidth > 0) {
        const x = finger - viewportPageX.current;
        const edge = Math.min(36, config.viewportWidth / 4);
        const direction = x < edge ? -(1 - Math.max(0, x) / edge)
          : x > config.viewportWidth - edge ? 1 - Math.max(0, config.viewportWidth - x) / edge : 0;
        const maxScroll = Math.max(0, config.contentWidth - config.viewportWidth);
        const next = Math.max(0, Math.min(maxScroll, scrollX.current + direction * 165 * elapsed));
        if (Math.abs(next - scrollX.current) >= 0.5) {
          scrollX.current = next;
          config.scrollRef.current?.scrollTo({ x: next, animated: false });
          selectAt(finger);
        }
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [isScrubbing, selectAt]);

  useEffect(() => () => { if (active.current) latest.current.onScrubChange?.(false); }, []);

  return {
    viewportRef,
    panHandlers,
    isScrubbing,
    begin,
    end,
    setScrollX: (value: number) => { scrollX.current = value; },
    shouldIgnorePress: () => Date.now() < suppressTapUntil.current,
  };
}
