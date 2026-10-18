import authorize from '../../src/server/smartthings/authorize.mjs';
import callback from '../../src/server/smartthings/callback.mjs';
import command from '../../src/server/smartthings/command.mjs';
import devices from '../../src/server/smartthings/devices.mjs';
import status from '../../src/server/smartthings/status.mjs';
import webhook from '../../src/server/smartthings/webhook.mjs';
import disconnect from '../../src/server/smartthings/disconnect.mjs';

const handlers = new Map(Object.entries({ authorize, callback, command, devices, status, webhook, disconnect }));

export default async function smartThings(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  const pathname = new URL(request.url ?? '/', 'https://localhost').pathname;
  const action = pathname.split('/').pop();
  if (['status', 'devices'].includes(action) && request.method !== 'GET') { response.setHeader('Allow', 'GET'); return response.status(405).json({ error: 'Method not allowed' }); }
  const handler = handlers.get(action);
  if (!handler) return response.status(404).json({ error: 'Unknown SmartThings endpoint.' });
  return handler(request, response);
}
