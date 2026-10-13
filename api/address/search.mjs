import { findAddressSuggestionById, findAddressSuggestions } from '../../src/services/address-search.mjs';

export default async function search(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' });

  const query = typeof request.query?.q === 'string' ? request.query.q.trim() : '';
  const id = typeof request.query?.id === 'string' ? request.query.id.trim() : '';
  if (id) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return response.status(400).json({ error: 'Adresse-id er ugyldigt.' });
    try {
      const address = await findAddressSuggestionById(id);
      response.setHeader('Cache-Control', 'public, max-age=300');
      return response.status(200).json(address);
    } catch (error) {
      return response.status(502).json({ error: error instanceof Error ? error.message : 'Adressen kunne ikke hentes lige nu.' });
    }
  }
  if (query.length < 3) return response.status(200).json([]);
  if (query.length > 73) return response.status(400).json({ error: 'Adressen er for lang.' });

  try {
    const addresses = await findAddressSuggestions(query);
    response.setHeader('Cache-Control', 'public, max-age=300');
    return response.status(200).json(addresses);
  } catch (error) {
    return response.status(502).json({ error: error instanceof Error ? error.message : 'Adressen kunne ikke hentes lige nu.' });
  }
}
