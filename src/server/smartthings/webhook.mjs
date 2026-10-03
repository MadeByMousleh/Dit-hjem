function confirmationUrl(value) {
  try {
    const url = new URL(String(value ?? ''));
    if (url.protocol !== 'https:' || url.hostname !== 'api.smartthings.com' || !/^\/v1\/apps\/[^/]+\/confirm-registration$/.test(url.pathname)) throw new Error();
    return url;
  } catch { return undefined; }
}

export default async function webhook(request, response) {
  if (request.method !== 'POST') { response.setHeader('Allow', 'POST'); return response.status(405).json({ error: 'Method not allowed' }); }
  const payload = request.body ?? {};
  if (payload.messageType !== 'CONFIRMATION') return response.status(204).end();
  const url = confirmationUrl(payload.confirmationData?.confirmationUrl);
  if (!url) return response.status(400).json({ error: 'Invalid SmartThings confirmation.' });
  try {
    const confirmed = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!confirmed.ok) return response.status(502).json({ error: 'SmartThings could not confirm the target URL.' });
    response.status(200).json({ confirmed: true });
  } catch { response.status(502).json({ error: 'SmartThings confirmation failed.' }); }
}
