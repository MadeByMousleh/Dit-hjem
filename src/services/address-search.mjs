import proj4 from 'proj4';

const BASE_URL = 'https://adressevaelger.dk';
// Public token recommended by KDS until user management is introduced.
const TOKEN = 'adressevaelger123';
const ETRS89_UTM32 = '+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs';

async function getJson(path, params, fetcher) {
  const response = await fetcher(`${BASE_URL}${path}?${new URLSearchParams({ ...params, token: TOKEN })}`, {
    headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Adresseopslaget svarede med ${response.status}`);
  const result = await response.json();
  if (result?.status !== 'ok') throw new Error('Adresseopslaget returnerede et ugyldigt svar.');
  return result;
}

async function fullAddressSuggestion(id, text, fetcher) {
  if (!/^[0-9a-f-]{36}$/i.test(id ?? '')) throw new Error('Adresseopslaget returnerede et ugyldigt adresse-id.');
  const details = await getJson(`/adresser/${id}`, {}, fetcher);
  const house = details.adresse?.husnummer;
  const point = house?.adgangspunkt;
  const coordinates = point?.geometri?.coordinates;
  if (point?.geometri?.crs?.properties?.name !== 'EPSG:25832' || !Array.isArray(coordinates) || !coordinates.slice(0, 2).every(Number.isFinite) || coordinates.length < 2) {
    throw new Error('Adressen mangler gyldige koordinater.');
  }
  const [x, y] = proj4(ETRS89_UTM32, 'EPSG:4326', coordinates.slice(0, 2));
  const municipalityCode = house.navngivenvejkommunedel?.kommune;
  const postcode = house.postnummer?.postnr;
  if (!/^\d{4}$/.test(municipalityCode ?? '') || !/^\d{4}$/.test(postcode ?? '') || !Number.isFinite(x) || !Number.isFinite(y)) {
    throw new Error('Adressen mangler kommune eller postnummer.');
  }
  return { id, text: details.adresse?.adressebetegnelse ?? text, kind: 'address', x, y, municipalityCode, postcode };
}

export async function findAddressSuggestionById(id, fetcher = fetch) {
  return fullAddressSuggestion(id, '', fetcher);
}

export async function findAddressSuggestions(query, fetcher = fetch) {
  const result = await getJson('/adresser/soeg', { tekst: query, maksimum: '6' }, fetcher);
  if (!Array.isArray(result.fund)) throw new Error('Adresseopslaget returnerede et ugyldigt svar.');
  return Promise.all(result.fund.slice(0, 6).map(async (hit) => {
    if (!hit?.titel) throw new Error('Adresseopslaget mangler adressebetegnelse.');
    if (['vejnavn', 'navngivenvejpostnummer'].includes(hit.type)) return { id: hit.id || hit.titel, text: hit.titel, searchText: hit.titel };
    if (!['adresse', 'husnummer'].includes(hit.type) || !/^[0-9a-f-]{36}$/i.test(hit.id ?? '')) throw new Error('Adresseopslaget returnerede en ukendt adressetype.');
    // An entrance may contain many apartments. Never save it as a precise unit.
    if (hit.type === 'husnummer') return { id: hit.id, text: hit.titel, searchText: hit.titel, refinement: 'unit' };
    return fullAddressSuggestion(hit.id, hit.titel, fetcher);
  }));
}
