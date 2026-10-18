import { findAddressSuggestions } from './address-search.mjs';
import { parse } from 'graphql';

// Public BBR/DAR v3 data. The application key never leaves the server.
const endpoint = register => `https://graphql.datafordeler.dk/${register}/v3`;
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const normalize = value => String(value).toLowerCase().replace(/æ/g, 'ae').replace(/ø/g, 'oe').replace(/å/g, 'aa').replace(/[^a-z0-9]/g, '');
const schemas = new Map();
const unwrap = type => type?.ofType ? unwrap(type.ofType) : type;
const fieldValue = (record, ...names) => Object.entries(record ?? {}).find(([key]) => names.some(name => normalize(key) === normalize(name)))?.[1];
const labels = {
  byg007: 'Bygningsnummer', byg021: 'Anvendelse', byg026: 'Opførelsesår', byg027: 'Ombygningsår',
  byg030: 'Vandforsyning', byg031: 'Afløbsforhold', byg032: 'Ydervægge', byg033: 'Tagmateriale',
  byg038: 'Samlet bygningsareal', byg039: 'Boligareal i bygningen', byg040: 'Erhvervsareal', byg041: 'Bebygget areal',
  byg042: 'Indbygget garage', byg043: 'Indbygget carport', byg044: 'Indbygget udhus', byg045: 'Udnyttet tagetage',
  byg046: 'Samlet kælderareal', byg050: 'Åben overdækning', byg054: 'Antal etager',
  byg056: 'Varmeinstallation', byg057: 'Opvarmningsmiddel', byg058: 'Supplerende varme',
  enh020: 'Anvendelse', enh026: 'Enhedens samlede areal', enh027: 'Boligens areal', enh028: 'Erhvervsareal',
  enh031: 'Antal værelser', enh032: 'Toiletforhold', enh033: 'Badeforhold', enh034: 'Køkkenforhold',
  enh035: 'Energiforsyning', enh039: 'Andet areal', enh040: 'Andel af fælles adgangsareal',
  enh065: 'Antal toiletter', enh066: 'Antal badeværelser', enh067: 'Antal rum til erhverv',
  gru009: 'Vandforsyning', gru010: 'Afløbsforhold', tek007: 'Anlægsnummer', tek020: 'Anlæggets anvendelse',
  tek024: 'Etableringsår', tek025: 'Ombygningsår', tek028: 'Kapacitet',
};
function displayLabel(field) {
  const prefix = field.name.toLowerCase().slice(0, 6);
  if (labels[prefix]) return labels[prefix];
  const description = field.description?.replace(/\s+/g, ' ').trim();
  if (description) return description.split(/\.(?:\s|$)/)[0].slice(0, 180);
  return field.name.replace(/^(byg|enh|gru|tek|eta|opg)\d{3}/i, '').replace(/([a-zæøå])([A-ZÆØÅ])/g, '$1 $2');
}
function publicRecord(record, fields) {
  const metadata = /^(id_|registrering|virkning|forretnings|datafordeler|husnummer$|adresseidentificerer$|bygning$|grund$|opgang$|bestemtfastejendom$)/i;
  return {
    id: fieldValue(record, 'id_lokalid') ?? '',
    fields: fields.filter(field => !metadata.test(field.name) && record[field.name] !== null && record[field.name] !== undefined && record[field.name] !== '')
      .map(field => ({ key: field.name, label: displayLabel(field), value: typeof record[field.name] === 'object' ? JSON.stringify(record[field.name]) : String(record[field.name]) })),
  };
}

export async function getBbrProperty({ id, address }, { apiKey = process.env.DATAFORDELER_API_KEY, fetcher = fetch } = {}) {
  apiKey = apiKey?.trim();
  if (!apiKey) throw Object.assign(new Error('BBR-oplysninger er ikke tilgængelige endnu.'), { status: 503, code: 'BBR_NOT_CONFIGURED' });
  if (id && !uuid(id)) throw Object.assign(new Error('Ugyldigt adresse-id.'), { status: 400 });
  if (!id) {
    if (!address || address.length > 120) throw Object.assign(new Error('Vælg først en præcis adresse i Profil.'), { status: 400 });
    const matches = (await findAddressSuggestions(address, fetcher)).filter(item => item.kind === 'address' && item.text.trim().toLocaleLowerCase('da-DK') === address.trim().toLocaleLowerCase('da-DK'));
    if (matches.length !== 1) throw Object.assign(new Error('Vælg adressen igen i Profil, så den rigtige bolig kan findes.'), { status: 409 });
    id = matches[0].id;
  }
  const signal = AbortSignal.timeout(24000);
  const now = new Date().toISOString();
  const warnings = [];
  async function providerFetch(url, options) {
    let response;
    for (let attempt = 0; attempt < 3; attempt++) {
      response = await fetcher(url, options);
      if (response.status !== 401 || signal.aborted) return response;
      const problem = await response.clone().json().catch(() => ({}));
      // New keys propagate across provider nodes; retry only this explicit code.
      if (problem.errorCode !== 'DAF-AUTH-0005' || attempt === 2) return response;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    return response;
  }
  async function request(register, query) {
    const url = new URL(endpoint(register)); url.searchParams.set('apiKey', apiKey);
    let response;
    try { response = await providerFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/graphql-response+json, application/json' }, body: JSON.stringify({ query }), signal }); }
    catch { throw new Error('BBR kunne ikke kontaktes. Prøv igen senere.'); }
    if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'Adgangen til BBR skal kontrolleres af appens administrator.' : 'BBR kunne ikke hentes lige nu.');
    let result;
    try { result = await response.json(); } catch { throw new Error('BBR returnerede ikke et gyldigt svar.'); }
    if (result.errors?.length || !result.data) throw new Error('BBR-opslaget kunne ikke gennemføres.');
    return result.data;
  }
  async function schema(register) {
    const cached = schemas.get(register);
    if (cached && Date.now() - cached.at < 300000) return cached.value;
    const url = new URL(`${endpoint(register)}/schema`); url.searchParams.set('apiKey', apiKey);
    let response;
    try { response = await providerFetch(url, { headers: { Accept: 'application/graphql, text/plain' }, signal }); }
    catch { throw new Error('BBR-tjenestens datamodel kunne ikke hentes.'); }
    if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'Adgangen til BBR skal kontrolleres af appens administrator.' : 'BBR-tjenestens datamodel kunne ikke hentes.');
    let document;
    try { document = parse(await response.text()); } catch { throw new Error('BBR-tjenestens datamodel kunne ikke læses.'); }
    const kinds = { ObjectTypeDefinition: 'OBJECT', InputObjectTypeDefinition: 'INPUT_OBJECT', ScalarTypeDefinition: 'SCALAR', EnumTypeDefinition: 'ENUM', InterfaceTypeDefinition: 'INTERFACE', UnionTypeDefinition: 'UNION' };
    const value = new Map(['String', 'Int', 'Float', 'Boolean', 'ID'].map(name => [name, { name, kind: 'SCALAR' }]));
    for (const definition of document.definitions) if (kinds[definition.kind]) value.set(definition.name.value, { name: definition.name.value, kind: kinds[definition.kind] });
    const typeRef = node => node.kind === 'NamedType' ? { name: node.name.value, kind: value.get(node.name.value)?.kind } : { kind: node.kind === 'ListType' ? 'LIST' : 'NON_NULL', ofType: typeRef(node.type) };
    for (const definition of document.definitions) {
      const type = value.get(definition.name?.value);
      if (!type) continue;
      const fields = (definition.fields ?? []).map(field => ({ name: field.name.value, description: field.description?.value, type: typeRef(field.type), args: (field.arguments ?? []).map(arg => ({ name: arg.name.value, type: typeRef(arg.type) })) }));
      if (type.kind === 'INPUT_OBJECT') type.inputFields = fields;
      else type.fields = fields;
    }
    const queryName = document.definitions.find(definition => definition.kind === 'SchemaDefinition')?.operationTypes.find(operation => operation.operation === 'query')?.type.name.value ?? 'Query';
    value.query = value.get(queryName);
    if (!value.query?.fields?.length) throw new Error('BBR-tjenestens datamodel kunne ikke læses.');
    schemas.set(register, { at: Date.now(), value });
    return value;
  }
  // Read the service's actual field names/types instead of assuming REST casing.
  async function entity(register, name, filterName, value, optional = false) {
    if (!value) return { records: [], fields: [] };
    const types = await schema(register);
    const root = types.query.fields.find(field => normalize(field.name) === normalize(`${register}_${name}`));
    const where = root?.args.find(arg => arg.name === 'where');
    const filter = types.get(unwrap(where?.type)?.name)?.inputFields?.find(field => normalize(field.name) === normalize(filterName));
    if (!root || !filter) {
      if (optional) { warnings.push(`Supplerende oplysninger (${name}) kunne ikke slås op.`); return { records: [], fields: [] }; }
      throw new Error('BBR-tjenestens adresseopslag understøttes ikke endnu.');
    }
    const connection = types.get(unwrap(root.type).name);
    const nodes = connection.fields.find(field => field.name === 'nodes');
    const fields = types.get(unwrap(nodes?.type)?.name)?.fields.filter(field => ['SCALAR', 'ENUM'].includes(unwrap(field.type)?.kind) && !field.args.some(arg => arg.type.kind === 'NON_NULL'));
    if (!fields?.length) throw new Error('BBR returnerede en ukendt datamodel.');
    const comparator = types.get(unwrap(filter.type).name)?.inputFields?.find(field => field.name === 'eq');
    if (!comparator) throw new Error('BBR-tjenestens filter understøttes ikke endnu.');
    const match = unwrap(comparator.type).name === 'String' || unwrap(comparator.type).name === 'ID' || uuid(value) ? JSON.stringify(String(value)) : JSON.stringify(value);
    const args = [`first:100`, `where:{${filter.name}:{eq:${match}}}`];
    for (const temporal of ['registreringstid', 'virkningstid']) if (root.args.some(arg => arg.name === temporal)) args.push(`${temporal}:${JSON.stringify(now)}`);
    let after = '', records = [];
    for (let page = 0; page < 3; page++) {
      const query = `{ ${root.name}(${args.join(',')}${after ? `,after:${JSON.stringify(after)}` : ''}) { nodes { ${fields.map(field => field.name).join(' ')} } pageInfo { hasNextPage endCursor } } }`;
      const result = (await request(register, query))[root.name];
      if (!Array.isArray(result?.nodes)) throw new Error('BBR returnerede et ugyldigt svar.');
      records.push(...result.nodes);
      if (!result.pageInfo?.hasNextPage) return { records, fields };
      after = result.pageInfo.endCursor;
      if (!after) throw new Error('BBR returnerede et ugyldigt sideskift.');
    }
    warnings.push(`Listen over ${name} er afkortet.`);
    return { records, fields };
  }
  const dar = await entity('DAR', 'Adresse', 'id_lokalid', id);
  if (dar.records.length !== 1) throw Object.assign(new Error('Adressen kunne ikke findes entydigt i adresseregisteret.'), { status: 404 });
  const addressRecord = dar.records[0];
  const houseId = fieldValue(addressRecord, 'husnummer');
  const house = uuid(houseId) ? await entity('DAR', 'Husnummer', 'id_lokalid', houseId) : { records: [] };
  const units = await entity('BBR', 'Enhed', 'adresseIdentificerer', id);
  if (house.records.length > 1) throw new Error('Adgangsadressen kunne ikke matches entydigt.');
  const buildingIds = [...new Set(units.records.map(record => fieldValue(record, 'bygning')).filter(uuid))];
  if (!buildingIds.length && uuid(fieldValue(house.records[0], 'adgangTilBygning'))) buildingIds.push(fieldValue(house.records[0], 'adgangTilBygning'));
  let buildings = { records: [], fields: [] };
  if (buildingIds.length) {
    for (const buildingId of buildingIds.slice(0, 10)) {
      const result = await entity('BBR', 'Bygning', 'id_lokalid', buildingId);
      buildings = { fields: result.fields, records: [...buildings.records, ...result.records] };
    }
    if (buildingIds.length > 10) warnings.push('Listen over tilknyttede bygninger er afkortet.');
  } else if (uuid(houseId)) buildings = await entity('BBR', 'Bygning', 'husnummer', houseId);
  async function supplement(name, filter, value) {
    try { return await entity('BBR', name, filter, value, true); }
    catch { warnings.push(`Supplerende oplysninger (${name}) kunne ikke hentes.`); return { records: [], fields: [] }; }
  }
  const sections = [];
  const add = (title, result) => { if (result.records.length) sections.push({ title, records: result.records.map(record => publicRecord(record, result.fields)) }); };
  add('Din bolig / enhed', units); add('Bygningen', buildings);
  const groundIds = [...new Set(buildings.records.map(record => fieldValue(record, 'grund')).filter(uuid))].slice(0, 10);
  const propertyIds = new Set([...units.records, ...buildings.records].map(record => fieldValue(record, 'ejendomsrelation', 'bestemtFastEjendom')).filter(uuid));
  for (const groundId of groundIds) {
    const ground = await supplement('Grund', 'id_lokalid', groundId); add('Grunden', ground);
    for (const record of ground.records) { const relation = fieldValue(record, 'ejendomsrelation', 'bestemtFastEjendom'); if (uuid(relation)) propertyIds.add(relation); }
    const related = await supplement('Bygning', 'grund', groundId);
    add('Øvrige bygninger på grunden', { ...related, records: related.records.filter(record => !buildings.records.some(main => fieldValue(main, 'id_lokalid') === fieldValue(record, 'id_lokalid'))) });
    add('Tekniske anlæg', await supplement('Tekniskanlaeg', 'grund', groundId));
  }
  for (const building of buildings.records.slice(0, 10)) {
    const buildingKey = fieldValue(building, 'id_lokalid');
    add('Etager', await supplement('Etage', 'bygning', buildingKey));
    add('Opgange', await supplement('Opgang', 'bygning', buildingKey));
  }
  for (const relation of [...propertyIds].slice(0, 10)) add('Ejendomsoplysninger', await supplement('Ejendomsrelation', 'id_lokalid', relation));
  const unitRelations = units.records.map(record=>fieldValue(record,'ejendomsrelation','bestemtFastEjendom')).filter(uuid);
  const buildingRelations = buildings.records.map(record=>fieldValue(record,'ejendomsrelation','bestemtFastEjendom')).filter(uuid);
  const preferred = new Set(unitRelations.length ? unitRelations : buildingRelations.length ? buildingRelations : propertyIds);
  const valuationBfeNumbers = [...new Set(sections.filter(section=>section.title==='Ejendomsoplysninger').flatMap(section=>section.records).filter(record=>preferred.has(record.id)).flatMap(record=>record.fields.filter(field=>normalize(field.key)==='bfenummer').map(field=>field.value)))];
  return { addressId: id, address: fieldValue(addressRecord, 'adressebetegnelse') ?? address, fetchedAt: now, source: 'BBR · Datafordeleren', sections, valuationBfeNumbers, warnings: [...new Set(warnings)] };
}
