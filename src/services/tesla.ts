import { TeslaVehicle } from "../types/app";
import { API_URL } from "./supabase";

async function jsonPayload(response: Response): Promise<{ payload: unknown; errorMessage?: string }> {
  const body = await response.text();
  if (!body) return { payload: undefined };
  try {
    return { payload: JSON.parse(body) };
  } catch {
    if (__DEV__) console.warn('[Tesla response]', { api: API_URL, status: response.status, contentType: response.headers.get('content-type'), html: /^\s*</.test(body) });
    return { payload: undefined, errorMessage: `Tjenesten svarede med ugyldigt indhold (HTTP ${response.status}).` };
  }
}

async function teslaFetch(path: string, options: RequestInit = {}) {
  const { getSupabase } = await import('./supabase');
  const client = await getSupabase();
  const { data: { session } } = await client.auth.getSession();
  if (!session) throw new Error('Log ind for at forbinde din Tesla.');
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  headers.set('Authorization', `Bearer ${session.access_token}`);
  return fetch(`${API_URL}${path}`, { ...options, headers });
}

export async function getTeslaStatus() {
  const response = await teslaFetch('/api/tesla/status');
  const { payload, errorMessage } = await jsonPayload(response);
  if (!response.ok || !payload || typeof payload !== 'object') throw new Error(errorMessage ?? `Tesla-status svarede med ${response.status}.`);
  return payload as { connected: boolean; virtualKeyPairingUrl?: string };
}

export async function getTeslaVehicles() {
  const response = await teslaFetch('/api/tesla/vehicles');
  const { payload, errorMessage } = await jsonPayload(response);
  if (!response.ok || !payload || typeof payload !== 'object') throw new Error(errorMessage ?? `Tesla-køretøjer svarede med ${response.status}.`);
  const data = payload as { vehicles?: TeslaVehicle[] };
  return data.vehicles ?? [];
}

export async function setTeslaCharging(vin: string, action: 'start' | 'stop') {
  const response = await teslaFetch('/api/tesla/charging', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vin, action }) });
  const { payload, errorMessage } = await jsonPayload(response);
  const data = payload && typeof payload === 'object' ? payload as { result?: boolean; error?: string } : undefined;
  if (!response.ok || !data?.result) throw new Error(data?.error ?? errorMessage ?? `Tesla-kommandoen svarede med ${response.status}.`);
}

export async function getTeslaAuthorizationUrl(native: boolean) {
  const response = await teslaFetch('/api/tesla/authorize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(native ? { returnTo: 'stromblik://tesla/connected' } : {}) });
  const { payload, errorMessage } = await jsonPayload(response);
  const data = payload && typeof payload === 'object' ? payload as { authorizationUrl?: string; error?: string } : undefined;
  if (!response.ok || !data?.authorizationUrl) throw new Error(data?.error ?? errorMessage ?? `Tesla-login kunne ikke startes (HTTP ${response.status}).`);
  return data.authorizationUrl;
}
