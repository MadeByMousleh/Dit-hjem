import { vaultWriteResponse } from '../../src/services/vault-write-server.mjs';
import { MAX_WRITE_BYTES } from '../../src/services/vault-signing.mjs';

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed' });
  }
  let body;
  try {
    if (typeof request.body === 'string' && Buffer.byteLength(request.body) > MAX_WRITE_BYTES) return response.status(413).json({ error: 'Backup er for stor.' });
    body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
  } catch { return response.status(400).json({ error: 'Invalid JSON' }); }
  const req = new Request('https://localhost/api/energy/vault', { method: 'POST', headers: { authorization: request.headers.authorization ?? '' } });
  const result = await vaultWriteResponse(req, body);
  return response.status(result.status).json(result.body);
}
