export type AddressSuggestion = {
  id: string;
  text: string;
  x: number;
  y: number;
  municipalityCode?: string;
  postcode?: string;
};

type DawaSuggestion = {
  tekst: string;
  data?: { id: string; x: number; y: number; kommunekode?: string; postnr?: string };
};

export async function searchAddresses(query: string): Promise<AddressSuggestion[]> {
  if (query.trim().length < 3) return [];
  const params = new URLSearchParams({ q: query, type: "adresse", per_side: "6" });
  const response = await fetch(`https://api.dataforsyningen.dk/autocomplete?${params.toString()}`);
  if (!response.ok) throw new Error(`Adresseopslaget svarede med ${response.status}`);
  const suggestions = (await response.json()) as DawaSuggestion[];
  return suggestions
    .filter((suggestion) => suggestion.data && Number.isFinite(suggestion.data.x) && Number.isFinite(suggestion.data.y))
    .map((suggestion) => ({ id: suggestion.data!.id, text: suggestion.tekst, x: suggestion.data!.x, y: suggestion.data!.y, municipalityCode: suggestion.data!.kommunekode, postcode: suggestion.data!.postnr }));
}
