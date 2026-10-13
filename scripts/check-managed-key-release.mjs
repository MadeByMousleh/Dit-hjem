import assert from 'node:assert/strict';

// Public, read-only release checks. Never retrieves user keys or credentials.
for (const origin of ['https://huslyg.dk', 'https://dit-hjem-five.vercel.app']) {
  const page = await fetch(origin);
  assert.equal(page.status, 200);
  const html = await page.text();
  const scripts = [...html.matchAll(/src="([^"]+\.js)"/g)].map(match => match[1]);
  assert.ok(scripts.length);
  let fixed = false;
  for (const path of scripts) {
    const response = await fetch(new URL(path, origin));
    assert.equal(response.status, 200);
    fixed ||= (await response.text()).includes('Forbindelsen til sikker lagring svarede ikke korrekt');
  }
  assert.ok(fixed, 'New managed-key client is missing');
  const config = await fetch(`${origin}/api/auth/config`);
  assert.equal(config.status, 200);
  assert.ok(JSON.stringify(await config.json()).includes('arkpfdsglgufnnukader'));
  const keyResponse = await fetch(`${origin}/api/energy/vault`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'managed-key', operation: 'get', householdId: '00000000-0000-4000-8000-000000000000' }),
  });
  assert.equal(keyResponse.status, 401);
  assert.match(keyResponse.headers.get('cache-control'), /no-store/);
  console.log(`PASS: ${origin} serves repaired client, production auth config and uncached session-protected key endpoint.`);
}
