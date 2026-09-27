// Sønderborg Varme's published 2026 variable energy tariff. Fixed charges and
// subscriptions are deliberately excluded: they are not returned by eForsyning.
export const SONDERBORG_VARIABLE_PRICE_DKK_PER_MWH = 580;

export function estimateHeatingVariableCost(kwh: number | null | undefined): number | null {
  if (kwh == null || !Number.isFinite(kwh) || kwh < 0) return null;
  return kwh / 1000 * SONDERBORG_VARIABLE_PRICE_DKK_PER_MWH;
}

export function estimateHeatingVariableCostFromGj(gj: number | null | undefined): number | null {
  if (gj == null || !Number.isFinite(gj) || gj < 0) return null;
  return gj / 3.6 * SONDERBORG_VARIABLE_PRICE_DKK_PER_MWH;
}
