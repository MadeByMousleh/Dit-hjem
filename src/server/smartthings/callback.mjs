import { finishSmartThingsAuthorization, SmartThingsError } from '../../services/smartthings-server.mjs';
export default async function callback(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (request.method !== 'GET') { response.setHeader('Allow', 'GET'); return response.status(405).end(); }
  try {
    const result = await finishSmartThingsAuthorization(`https://${request.headers.host ?? 'dit-hjem-five.vercel.app'}${request.url ?? '/api/smartthings/callback'}`);
    response.statusCode = 302; response.setHeader('Location', result.redirect); response.setHeader('Cache-Control', 'no-store'); response.end();
  } catch (error) { response.status(error instanceof SmartThingsError ? error.status : 503).send(error instanceof SmartThingsError ? error.message : 'SmartThings-login mislykkedes. Prøv igen.'); }
}
