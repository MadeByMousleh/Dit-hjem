import { disconnectSmartThings } from '../../services/smartthings-server.mjs';
export default async function disconnect(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'POST') { response.setHeader('Allow', 'POST'); return response.status(405).json({ error: 'Method not allowed' }); }
  const result = await disconnectSmartThings(new Request('https://localhost/api/smartthings/disconnect', { method: 'POST', headers: { authorization: request.headers.authorization ?? '' } }));
  return response.status(result.status).json(result.body);
}
