import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

// Execute the actual client and onboarding validation with only dependencies
// replaced, reproducing the response shape observed from the production API.
async function loadClient(path, dependencies = '') {
  const source = (await readFile(new URL(path, import.meta.url), 'utf8')).replace(/^import .*;\r?$/gm, '');
  const { outputText } = ts.transpileModule(dependencies + source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}
globalThis.__DEV__ = false;
const client = await loadClient('../src/addresses.ts', 'const API_URL = "https://dit-hjem-five.vercel.app";\n');
const { isPreciseAddress } = await loadClient('../src/services/onboarding-profile.ts');
const selected = { id: '70865c44-d570-44e7-a6f5-6f7c90add725', text: 'Rådhuspladsen 1, 1550 København V', x: 12.5695776750135, y: 55.675627499559766, municipalityCode: '0101', postcode: '1550' };
const originalFetch = globalThis.fetch;
let calls = [];
const respond = value => async url => {
  calls.push(new URL(url));
  return new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });
};
try {
  globalThis.fetch = respond([selected]);
  const [legacy] = await client.searchAddresses('legacy complete');
  assert.ok(isPreciseAddress(legacy), 'Complete legacy search row is selectable without an ID request');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].searchParams.has('id'), false);

  const [resolvedLegacy] = [await client.resolveAddress(selected.id, selected.text)];
  assert.ok(isPreciseAddress(resolvedLegacy), 'Older API search arrays also resolve by selected ID');
  assert.equal(calls.at(-1).searchParams.get('q'), selected.text);
  assert.equal(calls.at(-1).searchParams.get('id'), selected.id);

  globalThis.fetch = respond({ ...selected, kind: 'address' });
  assert.ok(isPreciseAddress(await client.resolveAddress(selected.id, selected.text)), 'New API detail objects resolve');
  globalThis.fetch = respond([{ ...selected, id: 'other-apartment' }]);
  await assert.rejects(client.resolveAddress(selected.id, selected.text), /kunne ikke findes igen/);
  globalThis.fetch = respond([]);
  await assert.rejects(client.resolveAddress(selected.id, selected.text), /kunne ikke findes igen/);

  for (const [index, row] of [
    { ...selected, searchText: selected.text, refinement: 'unit' },
    { ...selected, searchText: 'Rådhuspladsen' },
    { ...selected, x: undefined },
    { ...selected, municipalityCode: undefined },
  ].entries()) {
    globalThis.fetch = respond([row]);
    const [result] = await client.searchAddresses(`incomplete ${index}`);
    assert.equal(isPreciseAddress(result), false, 'Refinements and incomplete rows cannot be saved');
  }
  if (process.argv.includes('--live')) {
    globalThis.fetch = originalFetch;
    const rows = await client.searchAddresses(selected.text);
    const live = rows.find(row => row.id === selected.id);
    assert.ok(isPreciseAddress(live), 'Live production search row passes onboarding validation');
    const resolved = await client.resolveAddress(selected.id, selected.text);
    assert.ok(isPreciseAddress(resolved), 'Live production response resolves selected ID');
    console.log('PASS: live public City Hall address is selectable with the current production API.');
  }
  console.log('PASS: actual address client handles legacy/new responses, rejects different units and keeps refinements/incomplete rows unselectable.');
} finally {
  globalThis.fetch = originalFetch;
}
