export type PriceArea = "DK1" | "DK2";

export type GridSupplier = {
  id: string;
  name: string;
  area: PriceArea;
};

export const GRID_SUPPLIERS: GridSupplier[] = [
  { id: "n1_c", name: "N1", area: "DK1" },
  { id: "trefor_el-net_c", name: "TREFOR", area: "DK1" },
  { id: "radius_c", name: "Radius", area: "DK2" },
  { id: "cerius_c", name: "Cerius", area: "DK2" },
  { id: "trefor_el-net_oest_c", name: "TREFOR Øst", area: "DK2" },
];

export type PricePoint = {
  startsAt: Date;
  priceDkkMwh: number;
  totalOrePerKwh: number;
  gridAndTaxOrePerKwh: number;
};

type PriceComponent = {
  total: number;
};

type CompletePrice = {
  date: string;
  price: PriceComponent;
  details: {
    electricity: PriceComponent;
  };
};

type CompletePriceResponse = {
  prices?: CompletePrice[];
};

const API_URL = "https://stromligning.dk/api/prices";

export async function fetchPrices(area: PriceArea, supplierId: string): Promise<PricePoint[]> {
  const query = new URLSearchParams({
    from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    to: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    supplierId,
    customerGroupId: "c",
    priceArea: area,
  });
  const url = `${API_URL}?${query.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Prisserveren svarede med ${response.status}`);
  }

  const payload = (await response.json()) as CompletePriceResponse;
  const prices = (payload.prices ?? [])
    .filter((record) => Number.isFinite(record.price.total))
    .map((record) => ({
      startsAt: new Date(record.date),
      priceDkkMwh: record.details.electricity.total * 800,
      totalOrePerKwh: record.price.total * 100,
      gridAndTaxOrePerKwh: (record.price.total - record.details.electricity.total) * 100,
    }))
    .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime());

  if (!prices.length) {
    throw new Error("Ingen priser blev fundet for området");
  }

  return prices;
}

export function createSamplePrices(area: PriceArea): PricePoint[] {
  const now = new Date();
  now.setMinutes(Math.floor(now.getMinutes() / 15) * 15, 0, 0);
  const offset = area === "DK1" ? 0 : 70;

  return Array.from({ length: 160 }, (_, index) => {
    const startsAt = new Date(now.getTime() + (index - 8) * 15 * 60 * 1000);
    const hour = startsAt.getHours() + startsAt.getMinutes() / 60;
    const morningPeak = 620 * Math.exp(-Math.pow((hour - 8) / 2.2, 2));
    const eveningPeak = 980 * Math.exp(-Math.pow((hour - 19) / 2.7, 2));
    const middayDip = -260 * Math.exp(-Math.pow((hour - 13) / 3.2, 2));
    const variation = Math.sin(index * 0.72) * 85;

    const priceDkkMwh = Math.max(-120, 380 + morningPeak + eveningPeak + middayDip + variation + offset);
    const localGrid = hour < 6 ? 11 : hour < 17 || hour >= 21 ? 16 : 43;
    const gridAndTaxOrePerKwh = localGrid + 15.375;

    return {
      startsAt,
      priceDkkMwh,
      totalOrePerKwh: toOrePerKwh(priceDkkMwh) + gridAndTaxOrePerKwh,
      gridAndTaxOrePerKwh,
    };
  });
}

export function toOrePerKwh(priceDkkMwh: number): number {
  return priceDkkMwh / 8;
}