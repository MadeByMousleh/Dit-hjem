import { teslaStatus } from '../../src/services/tesla-server.mjs';

export default async function status(request, response) {
  const req = new Request('https://localhost/api/tesla/status', { headers: { authorization: request.headers.authorization ?? '' } });
  const result = await teslaStatus(req);
  response.status(result.status).setHeader('Content-Type', 'application/json').setHeader('Cache-Control', 'no-store').end(JSON.stringify(result.body));
}
