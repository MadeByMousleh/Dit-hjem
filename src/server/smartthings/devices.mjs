import { smartThingsDevices } from '../../services/smartthings-server.mjs';
export default async function devices(request, response) { const result = await smartThingsDevices(new Request('https://localhost/api/smartthings/devices', { headers: { authorization: request.headers.authorization ?? '' } })); response.status(result.status).setHeader('Cache-Control', 'no-store').json(result.body); }
