import assert from "node:assert/strict";
import { test } from "node:test";
import { consumptionPoints, getElectricityUsage, sumConsumption } from "../src/services/eloverblik-server.mjs";

test("keeps Danish calendar dates and missing readings across meters", () => {
  const result = (quantity, quality = "A01") => ({ success: true, MyEnergyData_MarketDocument: { TimeSeries: [{ businessType: "A04", Period: [{ resolution: "PT1D", timeInterval: { start: "2026-03-28T23:00:00Z" }, Point: [{ position: "1", "out_Quantity.quantity": quantity, "out_Quantity.quality": quality }] }] }] } });
  const points = consumptionPoints({ result: [result("2,5"), result("1.5"), result(null, "A02")] });
  assert.deepEqual(points, [{ at: "2026-03-29T12:00:00.000Z", kwh: 4, incomplete: true }]);
});

test("preserves both repeated hours at the autumn clock change", () => {
  const points = consumptionPoints({ result: [{ success: true, MyEnergyData_MarketDocument: { TimeSeries: [{ businessType: "A04", Period: [{ resolution: "PT1H", timeInterval: { start: "2026-10-25T00:00:00Z" }, Point: [1, 2].map(position => ({ position, "out_Quantity.quantity": "0" })) }] }] } }] });
  assert.equal(points.length, 2);
  assert.equal(points[0].kwh, 0);
  assert.notEqual(points[0].at, points[1].at);
});

test("rejects invalid ranges before contacting Eloverblik", async () => {
  await assert.rejects(getElectricityUsage("x".repeat(40), { from: "2026-02-30", to: "2026-03-05", aggregation: "Hour" }), /gyldig periode/);
});

test("counts consumption but not production", () => {
  const series = (businessType, quantity) => ({
    businessType,
    "measurement_Unit.name": "KWH",
    Period: [{ Point: [{ "out_Quantity.quantity": quantity }] }],
  });
  const payload = {
    result: [{ success: true, MyEnergyData_MarketDocument: { TimeSeries: [
      series("A04", "2.5"),
      series("A04", "1,25"),
      series("A01", "99"),
    ] } }],
  };
  assert.equal(sumConsumption(payload), 3.75);
});

test("exchanges token and requests daily data for linked consumption meters", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/token")) return Response.json({ result: "access-token" });
    if (url.endsWith("/meteringpoints/meteringpoints")) return Response.json({ result: [
      { hasRelation: true, isMovedOut: false, typeOfMP: "D07", meteringPointId: "123456789012345678" },
      { hasRelation: true, isMovedOut: false, typeOfMP: "D01", meteringPointId: "223456789012345678" },
    ] });
    return Response.json({ result: [{ success: true, MyEnergyData_MarketDocument: { TimeSeries: [
      { businessType: "A04", Period: [{ Point: [{ "out_Quantity.quantity": "4" }] }] },
    ] } }] });
  };
  try {
    const usage = await getElectricityUsage("x".repeat(40));
    assert.equal(usage.totalKwh, 4);
    assert.equal(usage.meterCount, 1);
    assert.equal(calls.length, 3);
    assert.match(calls[2].url, /\/meterdata\/gettimeseries\/\d{4}-\d{2}-\d{2}\/\d{4}-\d{2}-\d{2}\/Day$/);
    assert.deepEqual(JSON.parse(calls[2].options.body), { meteringPoints: { meteringPoint: ["123456789012345678"] } });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
