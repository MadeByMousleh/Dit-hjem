import { smartThingsCommand } from '../../services/smartthings-server.mjs';
export default async function command(request, response) {
  if (request.method !== 'POST') { response.setHeader('Allow', 'POST'); return response.status(405).json({ error: 'Method not allowed' }); }
  const result = await smartThingsCommand(new Request('https://localhost/api/smartthings/command', { method: 'POST', headers: { authorization: request.headers.authorization ?? '' } }), request.body ?? {});
  response.status(result.status).setHeader('Cache-Control', 'no-store').json(result.body);
}
