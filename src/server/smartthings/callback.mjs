import { finishSmartThingsAuthorization, SmartThingsError } from '../../services/smartthings-server.mjs';
export default async function callback(request, response) {
  try {
    const result = await finishSmartThingsAuthorization(`https://${request.headers.host ?? 'dit-hjem-five.vercel.app'}${request.url ?? '/api/smartthings/callback'}`);
    response.statusCode = 302; response.setHeader('Location', result.redirect); response.setHeader('Cache-Control', 'no-store'); response.end();
  } catch (error) { response.status(error instanceof SmartThingsError ? error.status : 503).send(error instanceof Error ? error.message : 'SmartThings-login mislykkedes.'); }
}
