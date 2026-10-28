import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {authSessionStorage} from './native-auth-storage';
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? (typeof window !== 'undefined' && window.location && !['localhost', '127.0.0.1', '::1', '[::1]'].includes(window.location.hostname) ? '' : 'http://localhost:8787');
let pending: Promise<SupabaseClient> | undefined;
let projectUrl: string | undefined;
export async function resetSavedLogin() {
  if (!projectUrl) await getSupabase();
  const client = await getSupabase();
  await client.auth.stopAutoRefresh();
  const key = `sb-${new URL(projectUrl!).hostname.split('.')[0]}-auth-token`;
  const storage = authSessionStorage();
  await storage.removeItem(key);
  await storage.removeItem(key + '-code-verifier');
  pending = undefined;
}
export async function getSupabaseProjectUrl() { await getSupabase(); return projectUrl!; }
export function getSupabase() {
  pending ??= (async () => {
    const response = await fetch(`${API_URL}/api/auth/config`);
    const config = await response.json();
    if (!response.ok || !config.url || !config.publishableKey?.startsWith('sb_publishable_')) throw new Error('Login er ikke konfigureret.');
    projectUrl = config.url.replace(/\/$/, '');
    return createClient(config.url, config.publishableKey, { auth: { storage: authSessionStorage(), persistSession: true, autoRefreshToken: true, detectSessionInUrl: typeof window !== 'undefined' } });
  })().catch(error => { pending = undefined; throw error; });
  return pending;
}
