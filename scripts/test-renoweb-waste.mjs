import assert from 'node:assert/strict';

process.env.VERCEL = '1';
const { getRenoWebEvents } = await import('../server.mjs');
const requests = [];
const mockFetch = async (url) => {
  const parsed = new URL(url);
  requests.push(parsed);
  const path = parsed.pathname;
  const body = path.endsWith('GetJSONRoad.aspx')
    ? { list: [{ id: 10, name: 'Example Road, 6400 Sønderborg' }] }
    : path.endsWith('GetJSONAdress.aspx')
      ? { list: [{ id: 20, presentationString: 'Example Road 1, 6400 Sønderborg' }] }
      : path.endsWith('GetJSONContainerList.aspx')
        ? { list: [
          { name: 'Madaffald', nextpickupdatetimestamp: '1767225600' },
          { name: 'Papir og plast', nextpickupdate: '2026-01-02T00:00:00' },
          { name: 'Madaffald', nextpickupdatetimestamp: '1767225600' },
          { name: 'Ugyldig', nextpickupdate: 'ukendt' },
        ] }
        : null;
  assert.ok(body, `Unexpected path ${path}`);
  return { ok: true, json: async () => body };
};

const events = await getRenoWebEvents('Example Road 1', '6400', mockFetch);
assert.deepEqual(events, [
  { id: '2026-01-01-Madaffald', date: '2026-01-01', title: 'Madaffald', category: 'madaffald' },
  { id: '2026-01-02-Papir og plast', date: '2026-01-02', title: 'Papir og plast', category: 'plast-papir' },
]);
assert.equal(requests.length, 3);
assert.equal(requests[0].searchParams.get('roadname'), 'Example Road');
assert.equal(requests[1].searchParams.get('roadid'), '10');
assert.equal(requests[1].searchParams.get('streetBuildingIdentifier'), '1');
assert.equal(requests[2].searchParams.get('adressId'), '20');
assert.equal(requests.every(request => request.searchParams.get('municipalitycode') === '540'), true);
await assert.rejects(getRenoWebEvents('Example Road', '6400', mockFetch), /vejnavn og husnummer/);
console.log('PASS: SONFOR RenoWeb road/address/container lookup, date parsing and duplicate removal.');
