import { teslaVehicles } from '../../src/services/tesla-server.mjs';

export default async function vehicles(request, response) {
  const req = new Request('https://localhost/api/tesla/vehicles', { headers: { authorization: request.headers.authorization ?? '' } });
  const result = await teslaVehicles(req);
  response.status(result.status).setHeader('Content-Type', 'application/json').setHeader('Cache-Control', 'no-store').end(JSON.stringify(result.body));
}
