import type { BackgroundUsage } from './eloverblik';
export function backgroundWindow(now?: number): { from: string; to: string; aggregation: string };
export function estimateBackground(usage: { from: string; to: string; points: { at: string; kwh: number | null; incomplete: boolean }[]; syncFailed?: boolean }): BackgroundUsage;
