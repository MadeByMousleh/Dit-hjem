import { finishTeslaAuthorization, TeslaError } from '../../src/services/tesla-server.mjs';

export default async function callback(request, response) {
  try {
    const result = await finishTeslaAuthorization(`https://${request.headers.host ?? process.env.TESLA_APP_DOMAIN}${request.url ?? '/callback'}`);
    response.statusCode = 302;
    response.setHeader('Location', result.redirect);
    response.setHeader('Cache-Control', 'no-store');
    response.end();
  } catch (error) {
    response.statusCode = error instanceof TeslaError ? error.status : 503;
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(`<h1>Tesla-login mislykkedes</h1><p>${error instanceof Error ? error.message : 'Prøv igen'}</p>`);
  }
}
