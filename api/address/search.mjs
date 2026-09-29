const DAWA_AUTOCOMPLETE_URL = 'https://api.dataforsyningen.dk/autocomplete';

function toAddressSuggestion(suggestion) {
  const data = suggestion?.data;
  if (!data || !Number.isFinite(data.x) || !Number.isFinite(data.y) || !data.id || !suggestion.tekst) return null;
  return {
    id: data.id,
    text: suggestion.tekst,
    x: data.x,
    y: data.y,
    municipalityCode: data.kommunekode,
    postcode: data.postnr,
  };
}

export default async function search(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' });

  const query = typeof request.query?.q === 'string' ? request.query.q.trim() : '';
  if (query.length < 3) return response.status(200).json([]);
  if (query.length > 160) return response.status(400).json({ error: 'Adressen er for lang.' });

  try {
    const params = new URLSearchParams({ q: query, type: 'adresse', per_side: '6' });
    const upstream = await fetch(`${DAWA_AUTOCOMPLETE_URL}?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    });
    if (!upstream.ok) throw new Error(`Adresseopslaget svarede med ${upstream.status}`);

    const suggestions = await upstream.json();
    const addresses = Array.isArray(suggestions) ? suggestions.map(toAddressSuggestion).filter(Boolean) : [];
    response.setHeader('Cache-Control', 'public, max-age=300');
    return response.status(200).json(addresses);
  } catch (error) {
    return response.status(502).json({ error: error instanceof Error ? error.message : 'Adressen kunne ikke hentes lige nu.' });
  }
}
