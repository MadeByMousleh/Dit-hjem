import { useRef } from 'react';
import { type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, ScrollView } from 'react-native';
import { type DashboardTab, useDashboardViewState } from './useDashboardViewState';

// The vault screen unmounts protected content on background. Keep only the
// non-sensitive scroll position above that gate, and restore it after unlock.
export function useRememberedScroll(tab: DashboardTab, active = true) {
  const { scrollPositions, rememberScroll } = useDashboardViewState();
  const scrollRef = useRef<ScrollView>(null);
  const target = useRef(scrollPositions[tab]);
  const viewportHeight = useRef(0);
  const contentHeight = useRef(0);
  const restored = useRef(target.current === 0);
  const pendingRestore = useRef<number | null>(null);
  const wasActive = useRef(active);
  if (active && !wasActive.current) {
    target.current = scrollPositions[tab];
    viewportHeight.current = 0;
    contentHeight.current = 0;
    restored.current = target.current === 0;
    pendingRestore.current = null;
  }
  wasActive.current = active;
  const restore = () => {
    if (restored.current || !viewportHeight.current || contentHeight.current < target.current + viewportHeight.current) return;
    restored.current = true;
    pendingRestore.current = target.current;
    scrollRef.current?.scrollTo({ y: target.current, animated: false });
  };
  return {
    scrollRef,
    onLayout: (event: LayoutChangeEvent) => { viewportHeight.current = event.nativeEvent.layout.height; restore(); },
    onContentSizeChange: (_width: number, height: number) => { contentHeight.current = height; restore(); },
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!restored.current) return;
      const offset = event.nativeEvent.contentOffset.y;
      if (pendingRestore.current !== null) {
        if (Math.abs(offset - pendingRestore.current) > 3) return;
        pendingRestore.current = null;
      }
      rememberScroll(tab, offset);
    },
  };
}
