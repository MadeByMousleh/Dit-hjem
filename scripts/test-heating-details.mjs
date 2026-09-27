import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(file, dependencies = {}) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInThisContext(`(function(require,module,exports){${output}\n})`)((name) => {
    if (name in dependencies) return dependencies[name];
    if (name === 'react-native') return { Platform: { OS: 'web' } };
    if (name === 'expo-crypto' || name === 'expo-secure-store') return {};
    throw new Error(`Unexpected import: ${name}`);
  }, module, module.exports);
  return module.exports;
}

const { parseHeatReadings, parseHeatSummary, parseHeatCustomer, needsHeatingEnrichment } = load('../src/services/private-heating.ts');
const { dailyTemperaturePoints, temperatureChartPoints } = load('../src/utils/heatingTemperature.ts');
const line = (from, energy, expected, flow, back) => ({
  FraDatoStr: from, TilDatoStr: from, ForventetForbrugENG1: expected,
  Tempfrem: flow, TempRetur: back, Afkoling: '20',
  TForbrugsTaellevaerk: [{ IndexNavn: 'ENG1', Enhed_Txt: 'GJ', Forbrug: energy }],
});
const payload = {
  ForbrugsLinjer: { TForbrugsLinje: [
    line('01-01-2026', '0,36', '0,4', '70,5', '40'),
    line('02-01-2026', '0,72', '0,5', '60,5', '30'),
    line('01-02-2026', '0,36', '0,4', '50', '25'),
  ] },
};
const annualPayload = {
  IaltLinje: {
    FraDatoStr: '01-01-2026', TilDatoStr: '31-12-2026',
    ForventetForbrugENG1: '12,5',
    TForbrugsTaellevaerk: [{ IndexNavn: 'ENG1', Enhed_Txt: 'GJ', Forbrug: '1,44' }],
  },
};
const readings = parseHeatReadings(payload);
assert.equal(readings[0].flowC, 70.5);
assert.equal(readings[0].returnC, 40);
assert.equal(readings[0].expectedKwh, 0.4 / 0.0036);
assert.equal(parseHeatSummary(payload), null);
const summary = parseHeatSummary(annualPayload);
assert.equal(summary.actualKwh, 1.44 / 0.0036);
assert.equal(summary.expectedYearKwh, 12.5 / 0.0036);
assert.equal(summary.from, '2026-01-01');
assert.equal(parseHeatSummary({}), null);
assert.equal(parseHeatSummary({ IaltLinje: { ForventetForbrugENG1: '12' } }).expectedYearKwh, null);
assert.deepEqual(parseHeatCustomer('12345', { ForbrugerNr: 8, InstallationNr: 2, MålerNr: 'M-1', Adresse: 'Varmevej 1', PostNr: 6400, By: 'Sønderborg' }), {
  customerNumber: '12345', consumerNumber: '8', installationNumber: '2', meterNumber: 'M-1', address: 'Varmevej 1', postalCode: '6400', city: 'Sønderborg',
});
assert.equal(parseHeatCustomer('12345', { Adresse: 'x'.repeat(181) }).address, null);
assert.equal(needsHeatingEnrichment({ readings: [{ ...readings[0], flowC: undefined }], summary: undefined }), true);
assert.equal(needsHeatingEnrichment({ readings, summary: null }), true);
assert.equal(needsHeatingEnrichment({ readings, summary, annualRequestAttempted: true }), false);

const days = dailyTemperaturePoints(readings);
assert.equal(days.length, 3);
assert.equal(temperatureChartPoints(readings, 'day', '2026-01-01')[0].flowC, 70.5);
assert.equal(temperatureChartPoints(readings, 'day', '2026-01-01')[2].returnC, null);
const months = temperatureChartPoints(readings, 'month', '2026-01-01');
assert.equal(months[0].flowC, 65.5);
assert.equal(months[0].returnC, 35);
assert.equal(months[1].flowC, 50);
assert.equal(months[2].flowC, null);
assert.equal(dailyTemperaturePoints([{ ...readings[0], to: '2026-01-04' }]).length, 0);
assert.equal(dailyTemperaturePoints([readings[0], { ...readings[0], flowC: 99 }])[0].flowC, null);
assert.equal(dailyTemperaturePoints([{ ...readings[0], flowC: 999, returnC: 0 }])[0].flowC, null);

const requests = [];
const credentials = { username: '12345', password: 'test-code' };
const secureStore = {
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only',
  getItemAsync: async () => JSON.stringify(credentials),
  setItemAsync: async () => {},
};
const nativeService = load('../src/services/private-heating.ts', {
  'react-native': { Platform: { OS: 'ios' } },
  'expo-secure-store': secureStore,
  'expo-crypto': { randomUUID: () => '12345678-1234-1234-1234-123456789012', CryptoDigestAlgorithm: { MD5: 'MD5' }, digestStringAsync: async () => 'digest' },
});
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  const path = new URL(url).pathname;
  const body = options.body ? JSON.parse(options.body) : null;
  requests.push({ path, body });
  let result;
  if (path.includes('getsecuritytoken')) result = { Token: 'challenge' };
  else if (path.includes('/login/')) result = { Result: 1 };
  else if (path.includes('getebrugerinfo')) result = { id: 7 };
  else if (path.includes('FindInstallationer')) result = { Installationer: [{ AktivNr: 1, InstallationNr: 2, ForbrugerNr: 77, MålerNr: 'Meter-123', Adresse: 'Varmevej 1', PostNr: 6400, By: 'Sønderborg' }] };
  else if (path.includes('getaktuelaarsmaerke')) result = { aarsmaerke: '2026' };
  else if (path.includes('getforbrug')) result = body.Aflaesningsfilter === 'afDagsvis' ? payload : annualPayload;
  else throw new Error(`Unexpected request path: ${path}`);
  return { ok: true, json: async () => result };
};
try {
  const legacy = { supplier: 'sonderborg-varme', installation: '12345/1/2', year: '2026', fetchedAt: new Date().toISOString(), summary: null, readings: [{ ...readings[0], flowC: null, returnC: null }] };
  const vault = { userId: 'user', householdId: 'home', data: { heating: [legacy] },
    mutate: async function (update) { this.data = update(this.data); } };
  await nativeService.syncHeating(vault);
  const calls = requests.filter(item => item.path.includes('getforbrug'));
  assert.equal(calls.length, 2);
  assert.equal(calls[0].body.Aflaesningsfilter, 'afDagsvis');
  assert.equal(calls[1].body.Aflaesningsfilter, 'afMaanedsvis');
  assert.equal(calls[1].body.ForbrugsAfgraensning_MedtagMellemliggendeMellemaflas, 'false');
  assert.equal(vault.data.heating[0].summary.expectedYearKwh, 12.5 / 0.0036);
  assert.equal(vault.data.heating[0].readings[0].flowC, 70.5);
  assert.equal(vault.data.heating[0].customer.consumerNumber, '77');
  assert.equal(vault.data.heating[0].customer.address, 'Varmevej 1');
  assert.equal(nativeService.needsHeatingEnrichment(vault.data.heating[0]), false);
  await nativeService.syncHeating(vault);
  assert.equal(requests.length, 7, 'A fresh enriched snapshot should keep the six-hour refresh limit');
} finally {
  globalThis.fetch = originalFetch;
}
console.log('PASS: separate daily/year requests, automatic legacy backfill, refresh limit, GJ totals and temperature charts.');
