import type { ElectricityAgreement } from '../hooks/useElectricityAgreements';
import type { PricePoint } from '../prices';
import type { UsageAggregation } from '../services/eloverblik';

type UsagePoint = { at: string; kwh: number | null };
export type EnergyCostEstimate = { ore: number; supplierName: string | null; hasEstimate: boolean; partial: boolean };

const dateFormatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Copenhagen', year: 'numeric', month: '2-digit', day: '2-digit' });
const danishDate = (at: string) => dateFormatter.format(new Date(at));

const agreementFor = (agreements: ElectricityAgreement[], at: string) => {
  const date = danishDate(at);
  return agreements.find(agreement => agreement.date_from <= date && (!agreement.date_to || agreement.date_to > date)) ?? null;
};
const spotOreAt = (at: string, prices: PricePoint[]) => {
  const time = new Date(at).getTime();
  const matching = prices.filter(price => {
    const start = price.startsAt.getTime();
    return start <= time && time < start + 60 * 60 * 1000;
  });
  if (!matching.length) return null;
  return matching.reduce((sum, price) => sum + price.totalOrePerKwh - price.gridAndTaxOrePerKwh, 0) / matching.length;
};

export function estimateEnergyCost(points: UsagePoint[], aggregation: UsageAggregation, agreements: ElectricityAgreement[], prices: PricePoint[]): EnergyCostEstimate {
  let ore = 0;
  let included = 0;
  let missing = false;
  const suppliers = new Set<string>();
  for (const point of points) {
    if (point.kwh === null) { missing = true; continue; }
    const agreement = agreementFor(agreements, point.at);
    if (!agreement) { missing = true; continue; }
    const rate = agreement.price_type === 'fixed'
      ? Number(agreement.fixed_ore) + Number(agreement.markup_ore)
      : aggregation === 'Hour' ? (() => { const spot = spotOreAt(point.at, prices); return spot === null ? null : spot + Number(agreement.markup_ore); })()
      : null;
    if (rate === null || !Number.isFinite(rate)) { missing = true; continue; }
    ore += point.kwh * rate;
    included++;
    suppliers.add(agreement.supplier_name);
  }
  return { ore, supplierName: suppliers.size === 1 ? [...suppliers][0]! : suppliers.size ? 'Flere elselskaber' : null, hasEstimate: included > 0, partial: missing || included !== points.length };
}

// Include the public grid/tax tariff and the household's electricity agreement.
// A full day's hourly readings and matching historical tariff prices are required.
export function estimateDailyTotalCost(points: (UsagePoint & { incomplete: boolean })[], agreements: ElectricityAgreement[], prices: PricePoint[]): number | null {
  if (!points.length || points.some(point => point.kwh === null || point.incomplete)) return null;
  let ore = 0;
  for (const point of points) {
    const agreement = agreementFor(agreements, point.at);
    if (!agreement) return null;
    const time = Date.parse(point.at);
    const matching = prices.filter(price => time <= price.startsAt.getTime() && price.startsAt.getTime() < time + 3600000);
    if (!matching.length) return null;
    const quarterPrices = prices.some((price, index) => index > 0 && price.startsAt.getTime() - prices[index - 1]!.startsAt.getTime() === 900000);
    if (quarterPrices && matching.length !== 4) return null;
    const gridAndTax = matching.reduce((sum, price) => sum + price.gridAndTaxOrePerKwh, 0) / matching.length;
    const electricity = agreement.price_type === 'fixed'
      ? Number(agreement.fixed_ore)
      : matching.reduce((sum, price) => sum + price.totalOrePerKwh - price.gridAndTaxOrePerKwh, 0) / matching.length;
    const rate = gridAndTax + electricity + Number(agreement.markup_ore);
    if (!Number.isFinite(rate)) return null;
    ore += point.kwh! * rate;
  }
  return ore;
}
