import { createHash, randomUUID } from "node:crypto";
import { createServer } from "node:http";

const port = Number(process.env.EFORSYNING_PORT ?? 8787);
const baseUrl = process.env.EFORSYNING_BASE_URL ?? "https://eforsyning.dk/";
let activeCredentials = null;
let gridBoundariesPromise;
let openEvModelsPromise;
const wasteProviderFeeds = JSON.parse(process.env.WASTE_PROVIDER_FEEDS_JSON ?? process.env.WASTE_FEEDS_JSON ?? "{}");
const wasteMunicipalities = {
  kredslob: new Set(["0751"]),
  affaldplus: new Set(["0320", "0370", "0329", "0330", "0340", "0390"]),
};
const openExperienceHosts = {
  "0661": "renomatic.nomi4s.dk/app/appservice/",
  "0665": "renomatic.nomi4s.dk/app/appservice/",
  "0671": "renomatic.nomi4s.dk/app/appservice/",
  "0779": "renomatic.nomi4s.dk/app/appservice/",
  "0480": "reno.nordfynskommune.dk/app/AppService/AppService/",
};
const perfectWasteMunicipalities = new Set(["0201", "0159", "0253", "0270", "0376", "0219", "0615", "0167", "0169", "0173", "0223", "0360", "0259", "0350", "0326", "0250", "0530", "0615", "0621", "0630", "0706", "0730", "0740", "0746", "0760", "0787", "0185"]);
const providerMunicipalities = {
  affaldonline: new Set(["0420", "0710", "0430", "0316", "0482", "0773", "0840", "0630", "0791", "0492"]),
  vestfor: new Set(["0151", "0190", "0183", "0187", "0163"]),
  provas: new Set(["0510"]),
  renodjurs: new Set(["0707", "0706"]),
  renosyd: new Set(["0727", "0746"]),
  wastewatch: new Set(["0550"]),
  herning: new Set(["0657"]),
  ikastbrande: new Set(["0756"]),
  kolding: new Set(["0621"]),
  openexplive: new Set(["0607", "0787"]),
  affaldonlineweb: new Set(["0410", "0740"]),
};
const providerStatusNames = { affaldonline: "AffaldOnline", vestfor: "Vestforbrænding", provas: "Provas / WasteHero", renodjurs: "RenoDjurs", renosyd: "RenoSyd", wastewatch: "WasteWatch", herning: "Herning", ikastbrande: "Ikast-Brande", kolding: "Infovision", openexplive: "Open Experience Live", affaldonlineweb: "AffaldOnlineWeb" };
const openLiveConfig = { "0607": "3YWh0MjlpbDh1djNiM25hZA==", "0787": "5NmkzUGpvZlRaMzdqZzBEQw==" };
const implementedProviderAdapters = new Set(["affaldonline", "vestfor", "provas", "renodjurs", "renosyd", "wastewatch", "herning", "ikastbrande", "kolding", "openexplive", "affaldonlineweb"]);

function requireConfig(credentials) {
  const missing = [
    ["username", credentials?.username],
    ["password", credentials?.password],
    ["supplierId", credentials?.supplierId],
  ].filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) throw new Error(`Missing login fields: ${missing.join(", ")}`);
}

function headers(sessionId) {
  return {
    Accept: "application/json",
    "X-Session-ID": sessionId,
    "X-Correlation-ID": randomUUID().slice(0, 8).toUpperCase(),
    "User-Agent": "Dit-hjem eForsyning proxy",
  };
}

async function jsonRequest(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok) throw new Error(`eForsyning returned ${response.status}`);
  return body;
}

async function getLatest(credentials = activeCredentials) {
  requireConfig(credentials);
  const { username, password, supplierId } = credentials;
  const sessionId = randomUUID().slice(0, 8).toUpperCase();
  const settings = await jsonRequest(`${baseUrl}umbraco/dff/dffapi/GetVaerkSettings?forsyningid=${encodeURIComponent(supplierId)}`, { headers: headers(sessionId) });
  const apiServer = settings.AppServerUri;
  if (!apiServer) throw new Error("eForsyning did not return an API server");

  const tokenResult = await jsonRequest(`${apiServer}system/getsecuritytoken/project/app/consumer/${encodeURIComponent(username)}`, { headers: headers(sessionId) });
  const hashedPassword = createHash("md5").update(password).digest("hex");
  const accessToken = createHash("md5").update(hashedPassword + tokenResult.Token).digest("hex");
  const login = await jsonRequest(`${apiServer}system/login/project/app/consumer/${encodeURIComponent(username)}/installation/1/id/${accessToken}`, { headers: headers(sessionId) });
  if (login.Result !== 1) throw new Error("eForsyning login failed");

  const user = await jsonRequest(`${apiServer}api/getebrugerinfo?id=${accessToken}`, { headers: headers(sessionId) });
  const installations = await jsonRequest(`${apiServer}api/FindInstallationer?id=${accessToken}`, {
    method: "POST",
    headers: { ...headers(sessionId), "Content-Type": "application/json" },
    body: JSON.stringify({ Soegetekst: "", Skip: "0", Take: "10000", EBrugerId: String(user.id), Huskeliste: "null", MedtagTilknyttede: "true" }),
  });
  const installation = installations.Installationer?.[0];
  if (!installation) throw new Error("No eForsyning installation found");

  const year = await jsonRequest(`${apiServer}api/getaktuelaarsmaerke?id=${accessToken}`, { headers: headers(sessionId) });
  const data = await jsonRequest(`${apiServer}api/getforbrug?id=${accessToken}&unr=${encodeURIComponent(username)}&anr=${installation.AktivNr}&inr=${installation.InstallationNr}`, {
    method: "POST",
    headers: { ...headers(sessionId), "Content-Type": "application/json" },
    body: JSON.stringify({
      Ejendomnr: username,
      AktivNr: String(installation.AktivNr),
      I_Nr: String(installation.InstallationNr),
      AarsMaerke: String(year.aarsmaerke),
      ForbrugsAfgraensning_FraDato: "0",
      ForbrugsAfgraensning_TilDato: "0",
      ForbrugsAfgraensning_FraAflaesning: "0",
      ForbrugsAfgraensning_TilAflaesning: "2",
      ForbrugsAfgraensning_MedtagMellemliggendeMellemaflas: "false",
      Optioner: "foBestemtBeboer, foSkabDetaljer, foMedtagWebAflaes",
      AHoejDetail: "false",
      Aflaesningsfilter: "afDagsvis",
      AflaesningsFilterDag: "ULTIMO",
      AflaesningsUdjaevning: "true",
      SletFiltreredeAflaesninger: "true",
      MedForventetForbrug: "true",
      OmregnForbrugTilAktuelleEnhed: "true",
    }),
  });

  const lines = data.ForbrugsLinjer?.TForbrugsLinje ?? [];
  const latest = lines.at(-1);
  const readings = latest?.TForbrugsTaellevaerk ?? [];
  const reading = (name) => readings.find((item) => item.IndexNavn === name);
  const number = (value) => value == null || value === "" ? null : Number(String(value).replace(",", "."));

  return {
    period: { from: latest?.FraDatoStr ?? null, to: latest?.TilDatoStr ?? null },
    heating: { usedKwh: number(reading("ENG1")?.Forbrug), expectedKwh: number(latest?.ForventetForbrugENG1) },
    water: { usedM3: number(reading("M3")?.Forbrug), expectedM3: number(latest?.ForventetForbrugM3) },
    temperatures: { forwardC: number(latest?.Tempfrem), returnC: number(latest?.TempRetur), coolingC: number(latest?.Afkoling) },
    fetchedAt: new Date().toISOString(),
  };
}

async function readJson(request) {
  let body = "";
  for await (const chunk of request) body += chunk;
  return JSON.parse(body || "{}");
}

function pointInRing(point, ring) {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [x, y] = ring[index];
    const [previousX, previousY] = ring[previous];
    const intersects = ((y > point.y) !== (previousY > point.y))
      && point.x < ((previousX - x) * (point.y - y)) / (previousY - y) + x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInGeometry(point, geometry) {
  if (geometry.type === "Polygon") return geometry.coordinates.some((ring) => pointInRing(point, ring));
  if (geometry.type === "MultiPolygon") return geometry.coordinates.some((polygon) => polygon.some((ring) => pointInRing(point, ring)));
  return false;
}

async function findGridSupplier(x, y) {
  gridBoundariesPromise ??= fetch("https://widget.elnet.danskenergi.dk/assets/elnetgranser_juni2024_40%20_50.json")
    .then((response) => response.text())
    .then((text) => JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)));
  const boundaries = await gridBoundariesPromise;
  const feature = boundaries.features.find((item) => pointInGeometry({ x, y }, item.geometry));
  const cvr = feature?.properties?.CVR;
  if (!cvr) throw new Error("Ingen netselskabsområde fundet for adressen");
  const filter = encodeURIComponent(`ExternalSupplierId eq ${cvr}`);
  const supplierResponse = await fetch(`https://api.elnet.greenpowerdenmark.dk/api/Suppliers?$filter=${filter}`);
  if (!supplierResponse.ok) throw new Error(`Netselskabsopslaget svarede med ${supplierResponse.status}`);
  const suppliers = await supplierResponse.json();
  const supplier = suppliers[0];
  if (!supplier) throw new Error("Netselskabet kunne ikke identificeres");
  return { name: supplier.name, cvr: String(cvr) };
}

async function getOpenEvModels() {
  openEvModelsPromise ??= fetch("https://github.com/open-ev-data/open-ev-data-dataset/releases/download/v1.24.0/open-ev-data-v1.24.0.json")
    .then((response) => response.json())
    .then((payload) => (payload.vehicles ?? []).map((record) => {
      const brand = record.make?.name ?? record.brand ?? "";
      const model = record.model?.name ?? record.model ?? "";
      const trim = record.trim?.name ?? record.trim ?? "";
      const batteryKwh = record.battery?.pack_capacity_kwh_net ?? record.battery?.pack_capacity_kwh_gross ?? record.battery_capacity_kwh;
      if (!brand || !model || !Number.isFinite(batteryKwh)) return null;
      return {
        id: `${brand}-${model}-${trim}-${record.year ?? ""}-${batteryKwh}`,
        name: [brand, model, trim].filter(Boolean).join(" "),
        modelName: `${brand} ${model}`.trim(),
        batteryKwh: Number(batteryKwh),
        chargerKw: record.charging?.ac?.max_power_kw ?? record.charging_speed_kw,
      };
    }).filter(Boolean));
  return openEvModelsPromise;
}

function parseIcalDate(value) {
  const match = value.match(/(\d{4})(\d{2})(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : undefined;
}

function parseWasteIcal(text) {
  return text.split(/BEGIN:VEVENT\r?\n/).slice(1).map((event) => {
    const title = event.match(/SUMMARY[^:]*:(.*)/)?.[1]?.trim();
    const date = parseIcalDate(event.match(/DTSTART[^:]*:(.*)/)?.[1] ?? "");
    if (!title || !date) return undefined;
    const lowerTitle = title.toLowerCase();
    const category = lowerTitle.includes("farlig") ? "farligt-affald" : lowerTitle.includes("mad") || lowerTitle.includes("bio") ? "madaffald" : lowerTitle.includes("plast") || lowerTitle.includes("papir") || lowerTitle.includes("pap") ? "plast-papir" : "andet";
    return { id: `${date}-${title}`, date, title, category };
  }).filter(Boolean);
}

function parseKredslobEvents(payload) {
  const rows = Array.isArray(payload) ? payload : payload?.value ?? payload?.plannedLoads ?? [];
  return rows.flatMap((row) => {
    const dateValue = row.date ?? row.Date ?? row.pickupDate ?? row.tømningsdato ?? row.collectionDate;
    const date = dateValue ? new Date(dateValue).toISOString().slice(0, 10) : undefined;
    const title = row.fraction ?? row.Fraction ?? row.description ?? row.wasteType ?? row.containerType ?? "Affald";
    if (!date || !title) return [];
    const lowerTitle = String(title).toLowerCase();
    const category = lowerTitle.includes("farlig") ? "farligt-affald" : lowerTitle.includes("mad") || lowerTitle.includes("bio") ? "madaffald" : lowerTitle.includes("plast") || lowerTitle.includes("papir") || lowerTitle.includes("pap") ? "plast-papir" : "andet";
    return [{ id: `${date}-${title}`, date, title: String(title), category }];
  });
}

function parseCopenhagenWasteHtml(html) {
  const events = [];
  const blocks = html.split(/calendar-waste-date/i).slice(1);
  for (const block of blocks) {
    const dateMatch = block.match(/date[^>]*>[\s\S]*?([0-3]?\d)\.\s*([a-zæøå]+)[\s\S]*?<\/div>/i);
    if (!dateMatch) continue;
    const months = { januar: 0, februar: 1, marts: 2, april: 3, maj: 4, juni: 5, juli: 6, august: 7, september: 8, oktober: 9, november: 10, december: 11 };
    const month = months[dateMatch[2].toLowerCase()];
    if (month === undefined) continue;
    const date = new Date(new Date().getFullYear(), month, Number(dateMatch[1]));
    if (date.getTime() < Date.now() - 86_400_000) date.setFullYear(date.getFullYear() + 1);
    const labels = [...block.matchAll(/(?:fraction|waste)[^>]*>([^<]+)/gi)].map((match) => match[1].trim()).filter(Boolean);
    for (const title of labels.length ? labels : ["Affald"]) {
      const lower = title.toLowerCase();
      const category = lower.includes("farlig") ? "farligt-affald" : lower.includes("mad") || lower.includes("bio") ? "madaffald" : lower.includes("plast") || lower.includes("papir") || lower.includes("pap") ? "plast-papir" : "andet";
      events.push({ id: `${date.toISOString()}-${title}`, date: date.toISOString().slice(0, 10), title, category });
    }
  }
  return events;
}

async function getCopenhagenWasteEvents(address) {
  const search = await fetch("https://datascience.kk.dk/affaldkbh/adresse/address", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ searchQuery: address }) });
  const result = await search.json();
  const selected = result.addresses?.find((item) => item.searchQuery?.toLowerCase() === address.toLowerCase()) ?? result.addresses?.[0];
  if (!selected?.searchQuery) throw new Error("Københavneradressen kunne ikke findes");
  const calendar = await fetch(`https://affald.kk.dk/din-kalender?address_id=${encodeURIComponent(selected.searchQuery)}`);
  if (!calendar.ok) throw new Error(`Københavns affaldsportal svarede med ${calendar.status}`);
  return parseCopenhagenWasteHtml(await calendar.text());
}

async function getOpenExperienceWasteEvents(municipality, address, postcode) {
  const host = openExperienceHosts[municipality];
  if (!host) throw new Error("Open Experience er ikke konfigureret for kommunen");
  const searchUrl = `https://${host}search/address/${encodeURIComponent(address)}/limit/200`;
  const searchResponse = await fetch(searchUrl);
  const results = await searchResponse.json();
  const match = (results.results ?? results).find((item) => String(item.displayName ?? item.name ?? "").includes(postcode)) ?? (results.results ?? results)[0];
  if (!match?.addressId && !match?.id) throw new Error("Adressen kunne ikke findes hos affaldsoperatøren");
  const id = match.addressId ?? match.id;
  const calendarResponse = await fetch(`https://${host}address/${encodeURIComponent(id)}/collections`);
  if (!calendarResponse.ok) throw new Error(`Open Experience svarede med ${calendarResponse.status}`);
  const payload = await calendarResponse.json();
  return (payload.collections ?? payload).flatMap((item) => (item.dates ?? item.upcoming_dates ?? []).map((date) => {
    const title = item.fraction?.name ?? item.fractionName ?? item.name ?? "Affald";
    const lower = title.toLowerCase();
    const category = lower.includes("farlig") ? "farligt-affald" : lower.includes("mad") || lower.includes("bio") ? "madaffald" : lower.includes("plast") || lower.includes("papir") || lower.includes("pap") ? "plast-papir" : "andet";
    return { id: `${date}-${title}`, date: new Date(date).toISOString().slice(0, 10), title, category };
  }));
}

async function getPerfectWasteEvents(municipality, address, postcode) {
  const base = "https://europe-west3-perfect-waste.cloudfunctions.net";
  const searchResponse = await fetch(`${base}/searchExternalAddresses`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: { query: address, municipality, page: 1, onlyManual: false } }) });
  const search = await searchResponse.json();
  const candidates = search.result ?? [];
  const match = candidates.find((item) => String(item.displayName ?? "").includes(postcode)) ?? candidates[0];
  if (!match?.addressID) throw new Error("Adressen kunne ikke findes hos Perfect Waste");
  const collectionsResponse = await fetch(`${base}/getAddressCollections`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: { addressID: match.addressID, municipality } }) });
  const collections = await collectionsResponse.json();
  return (collections.result ?? []).flatMap((row) => {
    const date = new Date(row.date).toISOString().slice(0, 10);
    return (row.fractions ?? []).map((fraction) => {
      const title = fraction.fractionName ?? fraction.name ?? "Affald";
      const lower = title.toLowerCase();
      const category = lower.includes("farlig") ? "farligt-affald" : lower.includes("mad") || lower.includes("bio") ? "madaffald" : lower.includes("plast") || lower.includes("papir") || lower.includes("pap") ? "plast-papir" : "andet";
      return { id: `${date}-${title}`, date, title, category };
    });
  });
}

function collectionEvents(rows, dateKey, titleKey) {
  return (rows ?? []).flatMap((row) => {
    const value = row[dateKey];
    const date = value ? new Date(value).toISOString().slice(0, 10) : undefined;
    const title = row[titleKey] ?? row.description ?? row.name ?? row.container ?? "Affald";
    if (!date) return [];
    const lower = String(title).toLowerCase();
    const category = lower.includes("farlig") ? "farligt-affald" : lower.includes("mad") || lower.includes("bio") ? "madaffald" : lower.includes("plast") || lower.includes("papir") || lower.includes("pap") ? "plast-papir" : "andet";
    return [{ id: `${date}-${title}`, date, title: String(title), category }];
  });
}

async function getAffaldOnlineEvents(municipality, address, postcode) {
  const headers = { "X-Client-Provider": "", "X-Client-Type": "Kunde app", "X-Client-Version": "22" };
  const search = await fetch(`https://www.affaldonline.dk/api/address/search?q=${encodeURIComponent(address)}&page=1`, { headers });
  const result = await search.json();
  const match = (result.results ?? []).find((item) => String(item.displayName ?? "").includes(postcode)) ?? result.results?.[0];
  if (!match?.addressId) throw new Error("AffaldOnline-adressen kunne ikke findes");
  const response = await fetch(`https://www.affaldonline.dk/api/address/collections?groupBy=date&addressId=${encodeURIComponent(match.addressId)}`, { headers });
  const rows = await response.json();
  return (rows ?? []).flatMap((row) => (row.collections ?? []).flatMap((collection) => collection.containers ?? []).map((container) => ({ date: row.date, description: container.description })));
}

async function getVestforEvents(address, postcode) {
  const search = await fetch(`https://selvbetjening.vestfor.dk/Adresse/AddressByName?term=${encodeURIComponent(address)}&numberOfResults=100`);
  const rows = await search.json();
  const match = rows.find((item) => String(item.Postnr).includes(postcode)) ?? rows[0];
  if (!match?.Id) throw new Error("Vestforbrænding-adressen kunne ikke findes");
  await fetch(`https://selvbetjening.vestfor.dk/Home/MinSide?address-selected-id=${encodeURIComponent(match.Id)}`);
  const response = await fetch(`https://selvbetjening.vestfor.dk/Adresse/ToemmeDates?start=${new Date().toISOString().slice(0, 10)}&end=${new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10)}`);
  return collectionEvents(await response.json(), "start", "title");
}

async function getKoldingEvents(address, postcode) {
  const base = "https://koldingivapi.infovision.dk/api/publiccitizen/";
  const headers = { Accept: "application/json, text/plain, */*", publicAccessToken: "__NetDialogCitizenPublicAccessToken__" };
  const roads = await (await fetch(`${base}road/roadName/${encodeURIComponent(address.split(/\s+\d/)[0])}`, { headers })).json();
  const road = roads.find((item) => String(item.postalCode).includes(postcode));
  if (!road?.guid) throw new Error("Kolding-adressen kunne ikke findes");
  const addresses = await (await fetch(`${base}address/info/road/${road.guid}`, { headers })).json();
  const match = addresses.find((item) => String(item.addressString).includes(address));
  if (!match?.addressGuid) throw new Error("Kolding-adressen kunne ikke identificeres");
  const rows = await (await fetch(`${base}container/address/active/${match.addressGuid}`, { headers })).json();
  return rows.flatMap((row) => collectionEvents(row.collectCalendar, "collectDate", "containerType"));
}

async function getRenoSydEvents(municipality, address) {
  const code = municipality === "0727" ? 727 : 746;
  const addressRows = await (await fetch(`https://api.dataforsyningen.dk/adresser?kommunekode=${code}&q=${encodeURIComponent(address)}&struktur=mini`)).json();
  const full = await (await fetch(`https://api.dataforsyningen.dk/adresser?kommunekode=${code}&id=${encodeURIComponent(addressRows[0]?.id)}`)).json();
  const kvhx = full[0]?.kvhx;
  if (!kvhx) throw new Error("RenoSyd-adressen kunne ikke identificeres");
  const stands = await (await fetch(`https://skoda-selvbetjeningsapi.renosyd.dk/api/v1/adresser/${kvhx}/standpladser`)).json();
  const number = stands[0]?.nummer;
  if (!number) throw new Error("RenoSyd fandt ingen standplads");
  const data = await (await fetch(`https://skoda-selvbetjeningsapi.renosyd.dk/api/v1/toemmekalender?nummer=${encodeURIComponent(number)}`)).json();
  return data[0]?.planlagtetømninger?.flatMap((row) => ({ date: row.dato, description: (row.fraktioner ?? []).join(" ") })) ?? [];
}

async function getRenoDjursEvents(address, postcode) {
  const response = await fetch("https://minside.renodjurs.dk/Default.aspx/GetAddress", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address: `${address}*, ${postcode}` }) });
  const data = await response.json();
  const match = data.d?.[0];
  if (!match?.value) throw new Error("RenoDjurs-adressen kunne ikke findes");
  const html = await (await fetch(`https://minside.renodjurs.dk/Ordninger.aspx?id=${encodeURIComponent(match.value)}`)).text();
  return [...html.matchAll(/<tr[\s\S]*?<td[^>]*>([^<]+)<\/td>[\s\S]*?<td[^>]*>([^<]+)<\/td>/gi)].flatMap((matchRow) => ({ date: matchRow[2].trim(), description: matchRow[1].trim() }));
}

async function getIkastEvents(address, postcode) {
  const base = "https://skrald.ikast-brande.dk/Adresse";
  const searchResponse = await fetch(`${base}/Typeahead`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: address, limit: 30000 }) });
  const candidates = await searchResponse.json();
  const match = candidates.find((item) => String(item.Beliggenhed).includes(postcode)) ?? candidates[0];
  if (!match?.AdresseId) throw new Error("Ikast-Brande-adressen kunne ikke findes");
  const html = await (await fetch(`${base}/SubmitAdresse`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ hiddenPrevController: "Tomningsinfo", hiddenPrevAction: "Index", hiddenSiteType: "R", hiddenId: match.AdresseId }) })).text();
  return [...html.matchAll(/<tr[\s\S]*?<td[^>]*>([^<]+)<\/td>[\s\S]*?<td[^>]*>([^<]+)<\/td>/gi)].flatMap((row) => ({ date: row[2].trim(), description: row[1].trim() }));
}

async function getWasteWatchEvents(address, postcode) {
  const rows = await (await fetch(`https://api.dataforsyningen.dk/adresser?kommunekode=550&q=${encodeURIComponent(address)}&struktur=mini`)).json();
  const item = rows.find((row) => String(row.postnr).includes(postcode)) ?? rows[0];
  if (!item?.id) throw new Error("WasteWatch-adressen kunne ikke findes");
  const data = await (await fetch(`https://wastewatch.forsyningonline.dk/prod/tonfor`)).json();
  const filtered = (data.wastewatch ?? []).filter((row) => String(row.postCode ?? row.postcode) === postcode && String(row.roadName ?? "").toLowerCase() === String(item.vejnavn).toLowerCase() && String(row.houseNumber) === String(item.husnr));
  return filtered.flatMap((row) => ({ date: row.dato, description: row.container }));
}

async function getProvasEvents(address, postcode) {
  const base = "https://platform-api.wastehero.io/api-crm-portal/v1/";
  const login = await (await fetch(`${base}company/provas-portal.wastehero.io/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "", password: "" }) })).json();
  if (!login.token) throw new Error("WasteHero kræver provider-token");
  const headers = { "X-API-Key": login.token };
  const properties = await (await fetch(`${base}property/?search=${encodeURIComponent(`${address}, ${postcode}`)}&limit=100`, { headers })).json();
  const match = properties.find((item) => String(item.location?.name ?? "").includes(postcode)) ?? properties[0];
  if (!match?.id) throw new Error("Provas-adressen kunne ikke findes");
  const rows = await (await fetch(`${base}property/${match.id}/collection_log?from_date=${new Date().toISOString().slice(0, 10)}&to_date=${new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10)}`, { headers })).json();
  return rows.map((row) => ({ date: row.date, description: row.container?.waste_fraction?.name ?? "Affald" }));
}

async function getHerningEvents(address) {
  const base = "https://affaldsweb.net/affaldweb";
  const encoded = encodeURIComponent(address);
  const search = await fetch(`https://affaldsweb.net/dagrenovation/find_veje.php?getCountriesByLetters=1&letters=${encoded}`, { method: "POST", headers: { "User-Agent": "Mozilla/5.0" } });
  const raw = await search.text();
  const first = raw.split("|").find(Boolean)?.split("###");
  if (!first?.[0]) throw new Error("Herning-adressen kunne ikke findes");
  const html = await (await fetch(`${base}/ruter.php?ejdnr=${encodeURIComponent(first[0])}`, { headers: { "User-Agent": "Mozilla/5.0" } })).text();
  return [...html.matchAll(/route-title[^>]*>([^<]+)[\s\S]*?day-name[^>]*>([^<]+)[\s\S]*?day-box[^>]*>[\s\S]*?([^<]+)</gi)].map((match) => ({ date: match[2].trim(), description: match[1].trim() }));
}

async function getOpenLiveEvents(municipality, address, postcode) {
  const encoded = openLiveConfig[municipality];
  const token = Buffer.from(encoded.slice(1), "base64").toString();
  const mid = encoded[0];
  const headers = { "X-Auth-Token": token };
  const search = await (await fetch(`https://live.affaldsapi.dk/address/v1/search/${mid}/${encodeURIComponent(address)}/100`, { headers })).json();
  const match = search.find((item) => String(item.name).includes(postcode)) ?? search[0];
  if (!match?.id) throw new Error("Open Experience-adressen kunne ikke findes");
  const rows = await (await fetch(`https://live.affaldsapi.dk/arrangements/v1/collections/calendar/${mid}/${match.id}`, { headers })).json();
  return rows.flatMap((row) => (row.upcoming_dates ?? []).map((item) => ({ date: item.date, description: row.fraction?.name ?? "Affald" })));
}

async function getAffaldOnlineWebEvents(municipality, address, postcode) {
  const base = `https://www.affaldonline.dk/kalender/${municipality === "0410" ? "middelfart" : "silkeborg"}`;
  const streets = await (await fetch(`${base}/acCal.php?term=${encodeURIComponent(address)}`)).json();
  const street = streets.find((item) => String(item.postnr).includes(postcode)) ?? streets[0];
  if (!street) throw new Error("AffaldOnlineWeb-adressen kunne ikke findes");
  const html = await (await fetch(`${base}/husnrCal.php?vejnavn=${encodeURIComponent(street.vejnavn)}&postnr=${encodeURIComponent(street.postnr)}`)).text();
  const id = html.match(/<option[^>]+value="([^"]+)"[^>]*>[^<]*/i)?.[1];
  if (!id) throw new Error("AffaldOnlineWeb kunne ikke finde husnummer");
  const info = await (await fetch(`${base}/showInfo.php`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ values: id }) })).text();
  return [...info.matchAll(/<tr[\s\S]*?<td[^>]*>([^<]+)<\/td>[\s\S]*?<td[^>]*>([^<]+)<\/td>/gi)].map((match) => ({ date: match[1].trim(), description: match[2].trim() }));
}

async function getAarhusWasteEvents(address) {
  const addressesResponse = await fetch(`https://api.dataforsyningen.dk/adresser?kommunekode=751&q=${encodeURIComponent(address)}&struktur=mini`);
  const addresses = await addressesResponse.json();
  const match = addresses.find((item) => item.postnr && address.includes(item.postnr)) ?? addresses[0];
  if (!match?.id) throw new Error("Aarhus-adressen kunne ikke findes");
  const fullResponse = await fetch(`https://api.dataforsyningen.dk/adresser?kommunekode=751&id=${encodeURIComponent(match.id)}`);
  const fullRows = await fullResponse.json();
  const kvhx = fullRows[0]?.kvhx;
  if (!kvhx) throw new Error("Aarhus-adressen mangler et affalds-ID");
  const pickupResponse = await fetch(`https://portal-api.kredslob.dk/api/calendar/address/${encodeURIComponent(kvhx)}`);
  if (!pickupResponse.ok) throw new Error(`Kredsløb svarede med ${pickupResponse.status}`);
  return parseKredslobEvents(await pickupResponse.json());
}

function providerForMunicipality(municipality) {
  return Object.entries(wasteMunicipalities).find(([, municipalities]) => municipalities.has(municipality))?.[0];
}

function wasteHealth(municipality) {
  if (municipality === "0751") return { status: "public-api", provider: "Kredsløb", supported: true, detail: "Aarhus' offentlige kalender-API" };
  if (municipality === "0101") return { status: "public-api", provider: "Københavns Kommune", supported: true, detail: "Københavns offentlige affaldskalender" };
  if (openExperienceHosts[municipality]) return { status: "public-api", provider: "Open Experience", supported: true, detail: "Offentlig Open Experience API" };
  if (perfectWasteMunicipalities.has(municipality)) return { status: "public-api", provider: "Perfect Waste", supported: true, detail: "Offentlig Perfect Waste API" };
  for (const [provider, municipalities] of Object.entries(providerMunicipalities)) if (municipalities.has(municipality)) return implementedProviderAdapters.has(provider)
    ? { status: "public-api", provider: providerStatusNames[provider], supported: true, detail: `Offentlig ${providerStatusNames[provider]} adapter` }
    : { status: "unsupported", provider: providerStatusNames[provider], supported: false, detail: `${providerStatusNames[provider]} er registreret, men adapteren er ikke testet endnu` };
  const provider = providerForMunicipality(municipality);
  const configured = provider ? Boolean(wasteProviderFeeds[provider]) : Boolean(wasteProviderFeeds[municipality]);
  if (configured) return { status: "ical", provider: provider ?? municipality, supported: true, detail: "Officiel iCal-feed" };
  return { status: "unsupported", provider: provider ?? null, supported: false, detail: "Ingen offentlig adapter eller iCal-feed er konfigureret" };
}

const server = createServer(async (request, response) => {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (request.method === "OPTIONS") { response.writeHead(204); response.end(); return; }
  if (request.method === "GET" && request.url?.startsWith("/api/grid/lookup")) {
    try {
      const url = new URL(request.url, `http://${request.headers.host}`);
      const x = Number(url.searchParams.get("x"));
      const y = Number(url.searchParams.get("y"));
      if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error("Ugyldige adressekoordinater");
      const result = await findGridSupplier(x, y);
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify(result));
    } catch (error) {
      response.writeHead(404, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Netselskabet kunne ikke findes" }));
    }
    return;
  }
  if (request.method === "GET" && request.url === "/api/ev/models") {
    try {
      const models = await getOpenEvModels();
      response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" });
      response.end(JSON.stringify(models));
    } catch (error) {
      response.writeHead(502, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : "OpenEV Data kunne ikke hentes" }));
    }
    return;
  }
  if (request.method === "GET" && request.url?.startsWith("/api/waste/calendar")) {
    try {
      const url = new URL(request.url, `http://${request.headers.host}`);
      const municipality = url.searchParams.get("municipality") ?? "";
      const address = url.searchParams.get("address") ?? "";
      if (municipality === "0751" && address) {
        const events = await getAarhusWasteEvents(address);
        response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" });
        response.end(JSON.stringify(events));
        return;
      }
      if (municipality === "0101" && address) {
        const events = await getCopenhagenWasteEvents(address);
        response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" });
        response.end(JSON.stringify(events));
        return;
      }
      if (openExperienceHosts[municipality] && address) {
        const events = await getOpenExperienceWasteEvents(municipality, address, url.searchParams.get("postcode") ?? "");
        response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" });
        response.end(JSON.stringify(events));
        return;
      }
      if (perfectWasteMunicipalities.has(municipality) && address) {
        const events = await getPerfectWasteEvents(municipality, address, url.searchParams.get("postcode") ?? "");
        response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" });
        response.end(JSON.stringify(events));
        return;
      }
      if (providerMunicipalities.affaldonline.has(municipality) && address) {
        const events = await getAffaldOnlineEvents(municipality, address, url.searchParams.get("postcode") ?? "");
        response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" }); response.end(JSON.stringify(events)); return;
      }
      if (providerMunicipalities.vestfor.has(municipality) && address) {
        const events = await getVestforEvents(address, url.searchParams.get("postcode") ?? "");
        response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" }); response.end(JSON.stringify(events)); return;
      }
      if (providerMunicipalities.kolding.has(municipality) && address) {
        const events = await getKoldingEvents(address, url.searchParams.get("postcode") ?? "");
        response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" }); response.end(JSON.stringify(events)); return;
      }
      if (providerMunicipalities.renosyd.has(municipality) && address) {
        const events = await getRenoSydEvents(municipality, address);
        response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" }); response.end(JSON.stringify(events)); return;
      }
      if (providerMunicipalities.renodjurs.has(municipality) && address) {
        const events = await getRenoDjursEvents(address, url.searchParams.get("postcode") ?? "");
        response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" }); response.end(JSON.stringify(events)); return;
      }
      const provider = providerForMunicipality(municipality);
      const suppliedFeedUrl = url.searchParams.get("feedUrl");
      const feedUrl = suppliedFeedUrl || (provider ? wasteProviderFeeds[provider] : wasteProviderFeeds[municipality]);
      if (suppliedFeedUrl && !suppliedFeedUrl.startsWith("https://")) throw new Error("Affaldskalenderen skal bruge en HTTPS-URL");
      if (!feedUrl) throw new Error("Ingen offentlig iCal-feed er konfigureret for denne kommune");
      const feedResponse = await fetch(feedUrl);
      if (!feedResponse.ok) throw new Error(`Affaldsfeed svarede med ${feedResponse.status}`);
      response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" });
      response.end(JSON.stringify(parseWasteIcal(await feedResponse.text())));
    } catch (error) {
      response.writeHead(404, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Affaldskalenderen kunne ikke hentes" }));
    }
    return;
  }
      if (providerMunicipalities.ikastbrande.has(municipality) && address) {
        const events = await getIkastEvents(address, url.searchParams.get("postcode") ?? "");
        response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" }); response.end(JSON.stringify(events)); return;
      }
      if (providerMunicipalities.wastewatch.has(municipality) && address) {
        const events = await getWasteWatchEvents(address, url.searchParams.get("postcode") ?? "");
        response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" }); response.end(JSON.stringify(events)); return;
      }
      if (providerMunicipalities.provas.has(municipality) && address) {
        const events = await getProvasEvents(address, url.searchParams.get("postcode") ?? "");
        response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" }); response.end(JSON.stringify(events)); return;
      }
      if (providerMunicipalities.herning.has(municipality) && address) {
        const events = await getHerningEvents(address);
        response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" }); response.end(JSON.stringify(events)); return;
      }
      if (providerMunicipalities.openexplive.has(municipality) && address) {
        const events = await getOpenLiveEvents(municipality, address, url.searchParams.get("postcode") ?? "");
        response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" }); response.end(JSON.stringify(events)); return;
      }
      if (providerMunicipalities.affaldonlineweb.has(municipality) && address) {
        const events = await getAffaldOnlineWebEvents(municipality, address, url.searchParams.get("postcode") ?? "");
        response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" }); response.end(JSON.stringify(events)); return;
      }
  if (request.method === "GET" && request.url?.startsWith("/api/waste/health")) {
    const url = new URL(request.url, `http://${request.headers.host}`);
    response.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    response.end(JSON.stringify(wasteHealth(url.searchParams.get("municipality") ?? "")));
    return;
  }
  if (request.method === "POST" && request.url === "/api/eforsyning/login") {
    try {
      const credentials = await readJson(request);
      const result = await getLatest(credentials);
      activeCredentials = {
        username: String(credentials.username),
        password: String(credentials.password),
        supplierId: String(credentials.supplierId),
      };
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify(result));
    } catch (error) {
      response.writeHead(401, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : "Login failed" }));
    }
    return;
  }
  if (request.method !== "GET" || request.url !== "/api/eforsyning/latest") { response.writeHead(404); response.end("Not found"); return; }
  if (!activeCredentials) {
    response.writeHead(401, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "Login required" }));
    return;
  }
  try {
    const result = await getLatest();
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify(result));
  } catch (error) {
    response.writeHead(502, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: error instanceof Error ? error.message : "eForsyning request failed" }));
  }
});

server.listen(port, () => console.log(`eForsyning server listening on http://localhost:${port}`));
