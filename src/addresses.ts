import { API_URL } from './services/supabase';

export type AddressSuggestion = {
  id: string;
  text: string;
  x: number;
  y: number;
  municipalityCode?: string;
  postcode?: string;
};

const DAWA_AUTOCOMPLETE_URL = 'https://api.dataforsyningen.dk/autocomplete';

type DawaSuggestion = {
  tekst?: string;
  data?: { id?: string; x?: number; y?: number; kommunekode?: string; postnr?: string };
};

async function addressSuggestionsFrom(response: Response): Promise<AddressSuggestion[]> {
  const result = await response.json().catch(() => undefined);
  if (!response.ok) throw new Error(result?.error ?? `Adresseopslaget svarede med ${response.status}`);
  if (!Array.isArray(result)) throw new Error('Adresseopslaget returnerede et ugyldigt svar.');
  return result as AddressSuggestion[];
}

async function addressSuggestionsFromDawa(response: Response): Promise<AddressSuggestion[]> {
  const result = await response.json().catch(() => undefined);
  if (!response.ok) throw new Error(`DAWA svarede med ${response.status}`);
  if (!Array.isArray(result)) throw new Error('DAWA returnerede et ugyldigt svar.');
  return (result as DawaSuggestion[])
    .filter((suggestion) => suggestion.tekst && suggestion.data?.id && Number.isFinite(suggestion.data.x) && Number.isFinite(suggestion.data.y))
    .map((suggestion) => ({
      id: suggestion.data!.id!,
      text: suggestion.tekst!,
      x: suggestion.data!.x!,
      y: suggestion.data!.y!,
      municipalityCode: suggestion.data!.kommunekode,
      postcode: suggestion.data!.postnr,
    }));
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
  let suggestions: AddressSuggestion[];
  try {
    suggestions = await timedSearch(`${API_URL}/api/address/search?${proxyParams.toString()}`, addressSuggestionsFrom, 1200, signal);
  } catch (proxyError) {
    if (signal?.aborted) throw proxyError;
    if (__DEV__) console.warn('[Address proxy failed]', proxyError instanceof Error ? proxyError.message : 'Unknown error');
    const dawaParams = new URLSearchParams({ q: query, type: 'adresse', per_side: '6' });
    suggestions = await timedSearch(`${DAWA_AUTOCOMPLETE_URL}?${dawaParams.toString()}`, addressSuggestionsFromDawa, 5000, signal);
  }
  if (!signal?.aborted) {
    if (recentSearches.size >= 30) recentSearches.delete(recentSearches.keys().next().value!);
    recentSearches.set(query, { expires: Date.now() + 300000, suggestions });
  }
  return suggestions;
}
