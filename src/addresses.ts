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
  return result as AddressSuggestion[];
}

async function addressSuggestionFrom(response: Response): Promise<AddressSuggestion> {
  const result = await response.json().catch(() => undefined);
  if (!response.ok) throw new Error(result?.error ?? `Adresseopslaget svarede med ${response.status}`);
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('Adresseopslaget returnerede et ugyldigt svar.');
  return result as AddressSuggestion;
}

const recentSearches = new Map<string, { expires: number; suggestions: AddressSuggestion[] }>();

async function timedSearch(url: string, parse: (response: Response) => Promise<AddressSuggestion[]>, timeout: number, signal?: AbortSignal) {
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

export async function resolveAddress(id: string, signal?: AbortSignal): Promise<AddressSuggestion> {
  const [address] = await timedSearch(`${API_URL}/api/address/search?id=${encodeURIComponent(id)}`, async response => [await addressSuggestionFrom(response)], 18000, signal);
  if (!address) throw new Error('Adresseopslaget returnerede et tomt svar.');
  return address;
}
