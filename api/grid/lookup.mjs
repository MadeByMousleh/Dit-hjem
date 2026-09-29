import { findGridSupplier } from '../../src/services/grid-lookup.mjs';

export default async function lookup(request, response) {
  if (request.method !== 'GET') return response.status(405).json({ error: 'Method not allowed' });
  try {
    const x = Number(request.query?.x);
    const y = Number(request.query?.y);
    const result = await findGridSupplier(x, y);
    response.setHeader('Cache-Control', 'public, max-age=86400');
    return response.status(200).json(result);
  } catch (error) {
    return response.status(404).json({ error: error instanceof Error ? error.message : 'Netselskabet kunne ikke findes' });
  }
}
