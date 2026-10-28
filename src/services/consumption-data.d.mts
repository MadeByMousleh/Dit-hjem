export type Reading = { starts_at: string; ends_at: string; kwh: number | null; quality?: string | null };
export function midnight(date: string): string;
export function advance(date: string, resolution: string): string;
export function danishDate(date?: Date): string;
export function expectedIntervals(from: string, to: string, resolution: string): { starts_at: string; ends_at: string }[];
export function meterReadings(payload: unknown, meterPointId: string, resolution: string): Reading[];
export function sourceHours(rows: Reading[]): Reading[];
export function aggregateReadings(rows: (Reading & { meter_id: string })[], meters: { id: string }[], from: string, to: string, resolution: string, today: string): { at: string; kwh: number | null; incomplete: boolean }[];
