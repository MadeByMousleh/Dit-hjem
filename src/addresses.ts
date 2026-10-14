import { API_URL } from './services/supabase';

export type AddressSuggestion = {
  id: string;
  text: string;
  x?: number;
  y?: number;
  searchText?: string;
  kind?: 'address';
  refinement?: 'unit';
  municipalityCode?: string;
  postcode?: string;
};

async function addressSuggestionsFrom(response: Response): Promise<AddressSuggestion[]> {
  const result = await response.json().catch(() => undefined);
  if (!response.ok) throw new Error(result?.error ?? `Adresseopslaget svarede med ${response.status}`);
  if (!Array.isArray(result)) throw new Error('Adresseopslaget returnerede et ugyldigt svar.');
  return result.map(normalizeAddressSuggestion);
}

function normalizeAddressSuggestion(value: unknown): AddressSuggestion {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Adresseopslaget returnerede et ugyldigt svar.');
  const item = value as AddressSuggestion;
  if (typeof item.id !== 'string' || !item.id || typeof item.text !== 'string' || !item.text.trim()) throw new Error('Adresseopslaget returnerede et ugyldigt svar.');
  // The deployed search API predates `kind`. Its complete address rows already
  // contain all required data; road/entrance refinements must remain refinements.
  if (item.kind === undefined && !item.searchText && !item.refinement
    && Number.isFinite(item.x) && Number.isFinite(item.y)
    && /^\d{4}$/.test(item.municipalityCode ?? '') && /^\d{4}$/.test(item.postcode ?? '')) {
    return { ...item, kind: 'address' };
  }
  return item;
}

const recentSearches = new Map<string, { expires: number; suggestions: AddressSuggestion[] }>();

async function timedSearch<T>(url: string, parse: (response: Response) => Promise<T>, timeout: number, signal?: AbortSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, timeout);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (__DEV__) console.info('[Address response]', { endpoint: url.split('?')[0], status: response.status, contentType: response.headers.get('content-type') });
    return await parse(response);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

export async function searchAddresses(query: string, signal?: AbortSignal): Promise<AddressSuggestion[]> {
  query = query.trim();
  if (query.length < 3) return [];
  const cached = recentSearches.get(query);
  if (cached && cached.expires > Date.now()) return cached.suggestions;
  const proxyParams = new URLSearchParams({ q: query });
  const suggestions = await timedSearch(`${API_URL}/api/address/search?${proxyParams.toString()}`, addressSuggestionsFrom, 18000, signal);
  if (!signal?.aborted) {
    if (recentSearches.size >= 30) recentSearches.delete(recentSearches.keys().next().value!);
    recentSearches.set(query, { expires: Date.now() + 300000, suggestions });
  }
  return suggestions;
}

export async function resolveAddress(id: string, text: string, signal?: AbortSignal): Promise<AddressSuggestion> {
  // Include q so an older server can return its search array. Only accept the
  // selected ID from that array, never a similar address or another apartment.
  const params = new URLSearchParams({ id, q: text });
  return timedSearch(`${API_URL}/api/address/search?${params}`, async response => {
    const result = await response.json().catch(() => undefined);
    if (!response.ok) throw new Error(result?.error ?? `Adresseopslaget svarede med ${response.status}`);
    const selected = Array.isArray(result) ? result.find(item => item?.id === id) : result;
    if (!selected || selected.id !== id) throw new Error('Adressen kunne ikke findes igen. Søg efter din fulde adresse og vælg den på listen.');
    return normalizeAddressSuggestion(selected);
  }, 18000, signal);
}
