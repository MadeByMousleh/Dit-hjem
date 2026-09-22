import { API_URL, getSupabase } from "./supabase";
export type UsageAggregation = "Year" | "Month" | "Day" | "Hour";
export type UsageSelection = { from: string; to: string; aggregation: UsageAggregation };
export type ElectricityUsage = {
  availableYears: number[];
  syncFailed?: boolean;
  points: { at: string; kwh: number | null; incomplete: boolean }[];
  aggregation: UsageAggregation;
  incomplete: boolean;
  totalKwh: number;
  meterCount: number;
  from: string;
  to: string;
};
export type BackgroundUsage = {
  algorithm: string;
  status: 'ready' | 'insufficient_data';
  from: string; to: string;
  watts: number | null; dailyKwh: number | null; monthlyKwh: number | null;
  validIntervals: number; expectedIntervals: number; nights: number; coverage: number;
  syncFailed: boolean;
};

async function postUsage<T>(payload: Record<string, unknown>): Promise<T> {
  const client = await getSupabase();
  const { data: { session } } = await client.auth.getSession();
  if (!session) throw new Error("Log ind for at se elforbrug.");
  const response = await fetch(`${API_URL}/api/eloverblik/usage`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(payload),
  });
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Elforbrug kunne ikke hentes");
  return body;
}

export function fetchElectricityUsage(householdId: string, selection?: UsageSelection) {
  return postUsage<ElectricityUsage>({ householdId, ...selection });
}
export function fetchBackgroundUsage(householdId: string) {
  return postUsage<BackgroundUsage>({ householdId, view: 'background' });
}
