import type { AddressSuggestion } from '../addresses';
import { API_URL, getSupabase } from './supabase';
import { loadProfile, saveProfile, type StoredProfile } from './storage';
import { fetchGridSuppliers, GRID_SUPPLIERS, type GridSupplier } from '../prices';

export type PreciseAddressSuggestion = AddressSuggestion & { kind: 'address'; x: number; y: number; municipalityCode: string; postcode: string };

export function isPreciseAddress(value: AddressSuggestion | null): value is PreciseAddressSuggestion {
  return !!value && value.kind === 'address' && !value.searchText && !!value.id && !!value.text.trim()
    && Number.isFinite(value.x) && Number.isFinite(value.y)
    && /^\d{4}$/.test(value.municipalityCode ?? '') && /^\d{4}$/.test(value.postcode ?? '');
}

export async function findAddressGrid(address: AddressSuggestion): Promise<{ id?: string; name: string }> {
  if (!isPreciseAddress(address)) throw new Error('Vælg din fulde adresse fra listen.');
  const response = await fetch(`${API_URL}/api/grid/lookup?${new URLSearchParams({ x: String(address.x), y: String(address.y) })}`);
  const result = await response.json();
  if (!response.ok || !result.name) throw new Error('Netselskabet kunne ikke findes. Du kan prøve igen eller vælge det senere under El.');
  const suppliers = await fetchGridSuppliers().catch(() => GRID_SUPPLIERS);
  return { id: matchAddressGrid(result.name, result.cvr, suppliers)?.id, name: result.name };
}

export function matchAddressGrid(name: string, code: string, suppliers: GridSupplier[]) {
  const ids: Record<string, string> = { '3159': 'n1_c', '3220': 'n1_344', '3167': 'trefor_el-net_c', '3596': 'trefor_el-net_oest_c', '3100': 'radius_c', '3592': 'radius_c', '3143': 'cerius_c', '3544': 'cerius_c', '3558': 'cerius_c', '3559': 'cerius_c' };
  const normalize = (s: string) => s.toLocaleLowerCase('da-DK').replace(/[^a-z0-9æøå]/g, '');
  return suppliers.find(s => s.id === ids[code]) ?? suppliers.find(s => [s.name, s.companyName].some(n => n && normalize(n) === normalize(name)));
}

export async function saveSetupProfile(userId: string, firstName: string, lastName: string, address: AddressSuggestion, grid?: { id?: string; name: string }) {
  if (!firstName.trim() || !lastName.trim()) throw new Error('Udfyld både fornavn og efternavn.');
  if (!isPreciseAddress(address)) throw new Error('Vælg din fulde adresse fra forslagene, inklusive etage og dør hvis relevant.');
  const client = await getSupabase();
  const { data: { session } } = await client.auth.getSession();
  if (session?.user.id !== userId) throw new Error('Log ind igen for at gemme din profil.');
  const existing = await loadProfile(userId, session.user.email);
  const profile: StoredProfile = { ...existing, firstName: firstName.trim(), lastName: lastName.trim(), name: `${firstName.trim()} ${lastName.trim()}`, email: session.user.email,
    address: address.text, addressId: address.id, addressX: address.x, addressY: address.y, municipalityCode: address.municipalityCode, postcode: address.postcode,
    gridSupplierId: grid?.id, gridSupplierName: grid?.name };
  const saved = await client.auth.updateUser({ data: { given_name: profile.firstName, family_name: profile.lastName, full_name: profile.name, home_profile: profile } });
  if (saved.error) throw new Error('Profilen kunne ikke gemmes. Prøv igen.');
  await saveProfile(profile, userId);
}
