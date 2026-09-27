import * as Haptics from 'expo-haptics';

export function barIndexAt(pageX: number, viewportPageX: number, scrollX: number, inset: number, stride: number, count: number): number {
  if (count <= 0 || stride <= 0) return -1;
  const x = pageX - viewportPageX + scrollX - inset;
  return Math.max(0, Math.min(count - 1, Math.floor(x / stride)));
}

export function tickSelection() {
  void Haptics.selectionAsync().catch(() => { /* Haptics may be disabled on this device. */ });
}
