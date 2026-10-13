import { thirdPartyConnectionResponse } from '../../src/services/eloverblik-third-party-server.mjs';

export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed' });
  }
  let body;
  try { body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body; }
  catch { return response.status(400).json({ error: 'Invalid JSON' }); }
  const req = new Request('https://localhost/api/eloverblik/usage', { method: 'POST', headers: { authorization: request.headers.authorization ?? '' } });
  const result = await thirdPartyConnectionResponse(req, body);
  return response.status(result.status).json(result.body);
}
