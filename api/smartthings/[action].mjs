import authorize from '../../src/server/smartthings/authorize.mjs';
import callback from '../../src/server/smartthings/callback.mjs';
import command from '../../src/server/smartthings/command.mjs';
import devices from '../../src/server/smartthings/devices.mjs';
import status from '../../src/server/smartthings/status.mjs';
import webhook from '../../src/server/smartthings/webhook.mjs';

const handlers = new Map(Object.entries({ authorize, callback, command, devices, status, webhook }));

export default async function smartThings(request, response) {
  const pathname = new URL(request.url ?? '/', 'https://localhost').pathname;
  const handler = handlers.get(pathname.split('/').pop());
  if (!handler) return response.status(404).json({ error: 'Unknown SmartThings endpoint.' });
  return handler(request, response);
}
