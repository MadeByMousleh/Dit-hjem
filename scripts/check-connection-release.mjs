import assert from 'node:assert/strict';

// Public, read-only checks: no supplier login, credentials or household data.
for (const origin of ['https://huslyg.dk', 'https://dit-hjem-five.vercel.app']) {
  const page = await fetch(origin, { signal: AbortSignal.timeout(15000) });
  assert.equal(page.status, 200);
  const html = await page.text();
  const bundlePath = [...html.matchAll(/src="([^"]+\.js)"/g)].map(match => match[1]).find(path => path.includes('AppEntry-'));
  assert.ok(bundlePath);
  const bundleResponse = await fetch(new URL(bundlePath, origin), { signal: AbortSignal.timeout(15000) });
  assert.equal(bundleResponse.status, 200);
  const bundle = await bundleResponse.text();
  assert.ok(bundle.includes('Skift login') && bundle.includes('HEATING_CREDENTIALS_REJECTED'), 'Heat repair missing from served bundle');
  const returnPage = await fetch(`${origin}/eloverblik/return.html?app=1`, { signal: AbortSignal.timeout(15000) });
  assert.equal(returnPage.status, 200);
  assert.ok((await returnPage.text()).includes('stromblik://eloverblik/connected'));
  const auth = await fetch(`${origin}/api/auth/config`, { signal: AbortSignal.timeout(15000) });
  assert.equal(auth.status, 200);
  assert.equal((await auth.json()).url.replace(/\/$/, ''), 'https://arkpfdsglgufnnukader.supabase.co');
  for (const [path, body] of [
    ['/api/energy/vault', { operation: 'heating', action: 'status' }],
    ['/api/eloverblik/usage', { action: 'status' }],
  ]) {
    const response = await fetch(origin + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
    assert.equal(response.status, 401);
    assert.match(response.headers.get('cache-control'), /no-store/);
  }
  const address = await fetch(`${origin}/api/address/search?id=70865c44-d570-44e7-a6f5-6f7c90add725`, { signal: AbortSignal.timeout(15000) });
  assert.equal(address.status, 200);
  const resolved = await address.json();
  assert.equal(resolved.kind, 'address'); assert.equal(resolved.municipalityCode, '0101');
  const tesla = await fetch(`${origin}/api/tesla/status`, { signal: AbortSignal.timeout(15000) });
  assert.equal(tesla.status, 401);
  console.log(`PASS: ${origin} serves repaired bundle ${bundlePath}, app-return page, production auth, public address ID resolution and protected connection endpoints.`);
}
