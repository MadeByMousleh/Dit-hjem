import type { WasteEvent } from '../waste';
export function planWasteReminders(events: WasteEvent[], amount: number, unit: 'days' | 'hours', now?: number): { event: WasteEvent; date: Date }[];
