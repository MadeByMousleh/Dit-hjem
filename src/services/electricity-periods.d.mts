export type PeriodSelection = { from: string; to: string; aggregation: string };
export function daysBetween(from: string, to: string): string[];
export function periodKeys(selection: PeriodSelection): string[];
export function updateKeys(days: string[]): string[];
export function hourComplete(payload: any, meterId: string, day: string): boolean;
export function mergeDayRecords(latest: Record<string, any>, day: string, imported: any[], descriptors: any[], checkedIds: string[], now: number): Record<string, any>;
export function selectionPoints(selection: PeriodSelection, records: Record<string, any>, today: string): { at: string; kwh: number | null; incomplete: boolean }[];
export function eligibleThrough(now?: number): string;
export function nextImportBatch(state: any, now?: number): { meter: any; from: string; to: string; direction: string } | null;
