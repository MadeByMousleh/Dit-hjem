import { API_URL, getSupabase } from './supabase';

export type SmartThingsDevice = {
  id: string; label: string; type: string | null; health: string | null; statusError: boolean;
  manufacturer?: string | null; model?: string | null;
  categories?: string[];
  components: { id: string; label: string; capabilities: string[] }[];
  status: Record<string, Record<string, Record<string, { value: string | number | boolean | string[]; unit: string | null; timestamp?: string | null }>>>;
};
export class SmartThingsClientError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
async function request<T>(action: string, body?: unknown): Promise<T> {
  const client = await getSupabase();
  const { data: { session } } = await client.auth.getSession();
  if (!session) throw new SmartThingsClientError('Log ind for at forbinde SmartThings.', 401);
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 55000);
  try {
    const response = await fetch(`${API_URL}/api/smartthings/${action}`, {
      method: body === undefined ? 'GET' : 'POST', signal: controller.signal,
      headers: { Accept: 'application/json', Authorization: `Bearer ${session.access_token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    let payload;
    try { payload = await response.json(); } catch { throw new SmartThingsClientError('SmartThings svarede med ugyldigt indhold. Prøv igen.', response.status); }
    if (!response.ok) throw new SmartThingsClientError(typeof payload?.error === 'string' ? payload.error : 'SmartThings kunne ikke kontaktes.', response.status);
    return payload as T;
  } catch (error) {
    if (error instanceof SmartThingsClientError) throw error;
    throw new SmartThingsClientError('Forbindelsen til SmartThings blev afbrudt. Prøv igen.', 0);
  } finally { clearTimeout(timer); }
}
export const getSmartThingsStatus = () => request<{ connected: boolean }>('status');
export const getSmartThingsDevices = () => request<{ devices: SmartThingsDevice[]; truncated: boolean }>('devices');
export const removeSmartThingsConnection = () => request<{ connected: false }>('disconnect', {});
export const commandSmartThingsSwitch = (deviceId: string, component: string, command: 'on' | 'off') => request<{ accepted: true }>('command', { deviceId, component, capability: 'switch', command, arguments: [] });
export const commandSmartThingsProgram = (deviceId: string, component: string, capability: string, program: string) => request<{ accepted: true }>('command', { deviceId, component, capability, command: 'setProgram', arguments: [program] });
export const startSmartThingsProgram = (deviceId: string, component: string, expectedProgram: string) => request<{ accepted: true }>('command', { deviceId, component, capability: 'signalahead13665.startstopprogramv2', command: 'setStartstop', arguments: ['play'], expectedProgram });
export async function getSmartThingsAuthorizationUrl(native: boolean) {
  const result = await request<{ authorizationUrl: string }>('authorize', native ? { returnTo: 'stromblik://smartthings/connected' } : {});
  const url = new URL(result.authorizationUrl);
  if (url.origin !== 'https://api.smartthings.com' || !['/oauth/authorize', '/v1/oauth/authorize'].includes(url.pathname)) throw new Error('SmartThings-loginadressen er ugyldig.');
  return url.toString();
}
