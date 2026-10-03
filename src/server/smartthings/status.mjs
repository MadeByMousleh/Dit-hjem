import { smartThingsStatus } from '../../services/smartthings-server.mjs';
export default async function status(request, response) { const result = await smartThingsStatus(new Request('https://localhost/api/smartthings/status', { headers: { authorization: request.headers.authorization ?? '' } })); response.status(result.status).setHeader('Cache-Control', 'no-store').json(result.body); }
