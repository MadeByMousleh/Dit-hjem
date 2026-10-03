import { beginSmartThingsAuthorization } from '../../services/smartthings-server.mjs';
export default async function authorize(request, response) {
  if (request.method !== 'POST') { response.setHeader('Allow', 'POST'); return response.status(405).json({ error: 'Method not allowed' }); }
  const result = await beginSmartThingsAuthorization(new Request('https://localhost/api/smartthings/authorize', { method: 'POST', headers: { authorization: request.headers.authorization ?? '' } }), request.body ?? {});
  response.status(result.status).setHeader('Cache-Control', 'no-store').json(result.body);
}
