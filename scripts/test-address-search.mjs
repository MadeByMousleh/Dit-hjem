import assert from 'node:assert/strict';
import { findAddressSuggestionById, findAddressSuggestions } from '../src/services/address-search.mjs';
import handler from '../api/address/search.mjs';

const id = '00000000-0000-0000-0000-000000000001';
const details = { status: 'ok', adresse: { adressebetegnelse: 'Testvej 1, 6400 Testby', husnummer: {
  adgangspunkt: { geometri: { crs: { properties: { name: 'EPSG:25832' } }, coordinates: [500000, 6094791.421] } },
  navngivenvejkommunedel: { kommune: '0540' }, postnummer: { postnr: '6400' },
} } };
const requests = [];
const fetcher = async url => {
  const parsed = new URL(url); requests.push(parsed);
  return { ok: true, json: async () => parsed.pathname.endsWith('/soeg')
    ? { status: 'ok', fund: [{ type: 'vejnavn', titel: 'Testvej' }, { type: 'adresse', id, titel: 'Testvej 1, 6400 Testby' }] }
    : details };
};
const results = await findAddressSuggestions('Testvej', fetcher);
assert.deepEqual(results[0], { id: 'Testvej', text: 'Testvej', searchText: 'Testvej' });
assert.equal(results[1].municipalityCode, '0540');
assert.equal(results[1].postcode, '6400');
assert.ok(Math.abs(results[1].x - 9) < 0.00001);
assert.ok(Math.abs(results[1].y - 55) < 0.00001);
assert.equal(requests.length, 2);
assert.equal(results[1].kind, 'address');
const resolved = await findAddressSuggestionById(id, fetcher);
assert.equal(resolved.id, id);
assert.equal(resolved.text, 'Testvej 1, 6400 Testby');
const entrance = await findAddressSuggestions('Testvej 1', async () => ({ ok: true, json: async () => ({ status: 'ok', fund: [{ type: 'husnummer', id, titel: 'Testvej 1, 6400 Testby' }] }) }));
assert.equal(entrance[0].refinement, 'unit');
assert.ok(entrance[0].searchText, 'A building entrance must be refined to an apartment/address before saving');
assert.ok(requests.every(url => url.hostname === 'adressevaelger.dk'));
await assert.rejects(findAddressSuggestions('Testvej', async () => ({ ok: false, status: 503 })), /503/);
await assert.rejects(findAddressSuggestions('Testvej', async () => ({ ok: true, json: async () => ({ status: 'ok' }) })), /ugyldigt/);
const invalidDetails = structuredClone(details);
invalidDetails.adresse.husnummer.adgangspunkt.geometri.crs.properties.name = 'EPSG:4326';
await assert.rejects(findAddressSuggestions('Testvej', async url => ({ ok: true, json: async () => url.includes('/soeg?')
  ? { status: 'ok', fund: [{ type: 'adresse', id, titel: 'Testvej 1' }] } : invalidDetails })), /koordinater/);
for (const [request, expected] of [[{ method: 'POST' }, 405], [{ method: 'GET', query: { q: 'ab' } }, 200], [{ method: 'GET', query: { q: 'a'.repeat(74) } }, 400]]) {
  const response = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
  await handler(request, response); assert.equal(response.code, expected);
}
console.log('PASS: address refinement, municipality/postcode, coordinate conversion, upstream/schema failures and handler validation.');
