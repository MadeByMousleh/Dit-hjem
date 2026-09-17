export type EvModel = {
  id: string;
  name: string;
  modelName: string;
  batteryKwh: number;
  chargerKw?: number;
};

type OpenEvRecord = {
  make?: { name?: string } | string;
  brand?: string;
  model?: { name?: string } | string;
  trim?: { name?: string } | string;
  variant?: { name?: string } | string;
  battery?: { pack_capacity_kwh_net?: number; pack_capacity_kwh_gross?: number; capacity_kwh?: number };
  charging?: { ac?: { max_power_kw?: number } };
  battery_capacity_kwh?: number;
  charging_speed_kw?: number;
  year?: number;
};

type OpenEvPayload = { vehicles?: OpenEvRecord[] } | OpenEvRecord[];

function text(value: OpenEvRecord["make"]): string {
  return typeof value === "string" ? value : value?.name ?? "";
}

export async function fetchOpenEvModels(): Promise<EvModel[]> {
  const response = await fetch("http://localhost:8787/api/ev/models");
  if (!response.ok) throw new Error(`OpenEV Data svarede med ${response.status}`);
  const payload = await response.json() as OpenEvPayload;
  if (Array.isArray(payload) && payload.every((record) => "name" in record && "batteryKwh" in record)) {
    return payload as unknown as EvModel[];
  }
  const records = Array.isArray(payload) ? payload : payload.vehicles ?? [];
  const models = records
    .map((record): EvModel | undefined => {
      const brand = text(record.make) || record.brand || "";
      const model = text(record.model);
      const modelName = `${brand} ${model}`.trim();
      const trim = text(record.trim);
      const variant = text(record.variant);
      const batteryKwh = record.battery?.pack_capacity_kwh_net
        ?? record.battery?.pack_capacity_kwh_gross
        ?? record.battery?.capacity_kwh
        ?? record.battery_capacity_kwh;
      if (!brand || !model || !Number.isFinite(batteryKwh)) return undefined;
      const name = [brand, model, trim || variant].filter(Boolean).join(" ");
      return {
        id: `${name}-${record.year ?? ""}-${batteryKwh}`,
        name,
        modelName,
        batteryKwh: Number(batteryKwh),
        chargerKw: record.charging?.ac?.max_power_kw ?? record.charging_speed_kw,
      };
    })
    .filter((model): model is EvModel => model !== undefined);
  return [...new Map(models.map((model) => [model.id, model])).values()]
    .sort((left, right) => left.name.localeCompare(right.name, "da"));
}
