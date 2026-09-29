import { teslaChargingCommand } from '../../src/services/tesla-server.mjs';

export default async function charging(request, response) {
  if (request.method !== 'POST') { response.setHeader('Allow', 'POST'); return response.status(405).json({ error: 'Method not allowed' }); }
  let body;
  try { body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body; } catch { return response.status(400).json({ error: 'Invalid JSON' }); }
  const req = new Request('https://localhost/api/tesla/charging', { method: 'POST', headers: { authorization: request.headers.authorization ?? '' } });
  const result = await teslaChargingCommand(req, body);
  response.status(result.status).setHeader('Cache-Control', 'no-store').json(result.body);
}
