import { createHash } from "node:crypto";
const base = "https://api.eloverblik.dk/customerapi/api";
const accessTokens = new Map();

export async function accessFor(token) {
  const key = createHash("sha256").update(token).digest("hex");
  const cached = accessTokens.get(key);
  if (cached && cached.expires > Date.now()) return cached.promise;
  if (accessTokens.size > 50) accessTokens.clear();
  const promise = requestJson("/token", token).catch((error) => { accessTokens.delete(key); throw error; });
  accessTokens.set(key, { promise, expires: Date.now() + 23 * 60 * 60 * 1000 });
  return promise;
}

export function consumptionPoints(payload) {
  if (!Array.isArray(payload?.result)) throw new Error("Eloverblik returnerede et ukendt dataformat.");
  const values = new Map();
  for (const result of payload.result) {
    if (!result.success) continue;
    for (const series of result.MyEnergyData_MarketDocument?.TimeSeries ?? []) {
      if (series.businessType !== "A04" || (series["measurement_Unit.name"] && series["measurement_Unit.name"] !== "KWH")) continue;
      for (const period of series.Period ?? []) {
        const resolution = period.resolution?.replace(/^PT1([DMY])$/, "P1$1");
        const start = new Date(period.timeInterval?.start);
        if (!Number.isFinite(start.getTime())) continue;
        const calendarStart = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Copenhagen", year: "numeric", month: "2-digit", day: "2-digit" }).format(start);
        for (const point of period.Point ?? []) {
          const position = Number(point.position) - 1;
          if (!Number.isInteger(position) || position < 0) continue;
          let at;
          if (resolution === "PT1H" || resolution === "PT15M") {
            at = new Date(start.getTime() + position * (resolution === "PT1H" ? 60 : 15) * 60000).toISOString();
          } else if (["P1D", "P1M", "P1Y"].includes(resolution)) {
            const date = new Date(calendarStart + "T12:00:00Z");
            if (resolution === "P1D") date.setUTCDate(date.getUTCDate() + position);
            if (resolution === "P1M") date.setUTCMonth(date.getUTCMonth() + position);
            if (resolution === "P1Y") date.setUTCFullYear(date.getUTCFullYear() + position);
            at = date.toISOString();
          } else continue;
          const raw = point["out_Quantity.quantity"];
          const quantity = raw == null || String(raw).trim() === "" ? NaN : Number(String(raw).replace(",", "."));
          const valid = point["out_Quantity.quality"] !== "A02" && Number.isFinite(quantity) && quantity >= 0;
          const previous = values.get(at);
          values.set(at, { at, kwh: valid ? (previous?.kwh ?? 0) + quantity : previous?.kwh ?? null, incomplete: Boolean(previous?.incomplete) || !valid });
        }
      }
    }
  }
  return [...values.values()].sort((a, b) => a.at.localeCompare(b.at)).map((p) => ({ ...p, kwh: p.kwh === null ? null : Math.round(p.kwh * 1000) / 1000 }));
}

export async function requestJson(path, token, options = {}) {
  const response = await fetch(base + path, {
    ...options,
    headers: { Authorization: "Bearer " + token, Accept: "application/json", "Content-Type": "application/json", "api-version": "1.0" },
    signal: AbortSignal.timeout(15000),
  });
  if (response.status === 401 || response.status === 403) throw new Error("Token er ugyldig eller udløbet. Opret en ny hos Eloverblik.");
  if (response.status === 429) throw new Error("Eloverblik har for mange forespørgsler. Prøv igen om et minut.");
  if (!response.ok) throw new Error("Eloverblik kunne ikke hente data lige nu.");
  return response.json();
}

function dateInDenmark(daysAgo) {
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Copenhagen", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const date = new Date(today + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

export function sumConsumption(payload) {
  const results = payload?.result;
  if (!Array.isArray(results)) throw new Error("Eloverblik returnerede et ukendt dataformat.");
  let totalKwh = 0;
  let validReadings = 0;
  for (const result of results) {
    if (!result.success) continue;
    for (const series of result.MyEnergyData_MarketDocument?.TimeSeries ?? []) {
      // A04 is consumption. A01 is production and must not be added to usage.
      if (series.businessType !== "A04") continue;
      if (series["measurement_Unit.name"] && series["measurement_Unit.name"] !== "KWH") continue;
      for (const period of series.Period ?? []) {
        for (const point of period.Point ?? []) {
          const raw = point["out_Quantity.quantity"];
          if (raw == null || point["out_Quantity.quality"] === "A02") continue;
          const quantity = Number(String(raw).replace(",", "."));
          if (!Number.isFinite(quantity) || quantity < 0) continue;
          totalKwh += quantity;
          validReadings++;
        }
      }
    }
  }
  if (!validReadings) throw new Error("Ingen forbrugsdata er klar for de seneste 30 dage.");
  return Math.round(totalKwh * 1000) / 1000;
}

export async function getElectricityUsage(refreshToken, selection = {}) {
  const from = selection.from ?? dateInDenmark(30);
  const to = selection.to ?? dateInDenmark(0);
  const aggregation = selection.aggregation ?? "Day";
  const validDate = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  if (!validDate(from) || !validDate(to) || from >= to || (Date.parse(to) - Date.parse(from)) / 86400000 > 730 || !["Year", "Month", "Day", "Hour"].includes(aggregation)) throw new Error("Vælg en gyldig periode på højst 730 dage.");
  if (typeof refreshToken !== "string" || refreshToken.length < 20 || refreshToken.length > 10000) throw new Error("Indsæt en gyldig opdateringstoken fra Eloverblik.");
  const access = await accessFor(refreshToken.trim());
  if (typeof access?.result !== "string" || !access.result) throw new Error("Eloverblik afviste token. Opret en ny hos Eloverblik.");

  const linked = await requestJson("/meteringpoints/meteringpoints", access.result);
  const consumptionTypes = new Set(["D07", "D10", "D12", "D15", "D17", "E17"]);
  if (!Array.isArray(linked?.result)) throw new Error("Eloverblik returnerede et ukendt målepunktsformat.");
  const ids = linked.result
    .filter((point) => point.hasRelation && !point.isMovedOut && consumptionTypes.has(point.typeOfMP) && /^\d{18}$/.test(point.meteringPointId))
    .map((point) => point.meteringPointId);
  if (!ids.length) throw new Error("Ingen tilknyttede målepunkter. Tilknyt dit målepunkt hos Eloverblik først.");
  if (ids.length > 10) throw new Error("Der er flere end 10 målepunkter; denne enkle visning understøtter højst 10.");

  const availableTo = to < dateInDenmark(0) ? to : dateInDenmark(0);
  if (from >= availableTo) return { totalKwh: 0, meterCount: ids.length, from, to, aggregation, points: [], incomplete: true };
  const data = await requestJson("/meterdata/gettimeseries/" + from + "/" + availableTo + "/" + aggregation, access.result, { method: "POST", body: JSON.stringify({ meteringPoints: { meteringPoint: ids } }) });
  const points = consumptionPoints(data);
  return { totalKwh: selection.aggregation ? points.reduce((sum, p) => sum + (p.kwh ?? 0), 0) : sumConsumption(data), meterCount: ids.length, from, to, aggregation, points, incomplete: data.result.some((r) => !r.success) || points.some((p) => p.incomplete) };
}
