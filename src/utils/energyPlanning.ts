import { PricePoint } from "../prices";
import { EnergyClass, PriceWindow, WashTemperature } from "../types/app";

export const ENERGY_CLASSES: EnergyClass[] = ["A", "B", "C", "D", "E", "F", "G"];
export const WASH_TEMPERATURES: WashTemperature[] = [30, 40, 60, 90];
export const WASH_TEMPERATURE_MULTIPLIERS: Record<WashTemperature, number> = { 30: 0.65, 40: 1, 60: 1.45, 90: 2.1 };
export const DURATIONS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4];
export const CLASS_ENERGY_KWH: Record<"dishwasher" | "laundry" | "dryer", Record<EnergyClass, number>> = {
  dishwasher: { A: 0.55, B: 0.64, C: 0.72, D: 0.82, E: 0.93, F: 1.04, G: 1.16 },
  laundry: { A: 0.49, B: 0.55, C: 0.61, D: 0.69, E: 0.76, F: 0.84, G: 0.95 },
  dryer: { A: 0.8, B: 0.95, C: 1.1, D: 1.3, E: 1.6, F: 2, G: 2.5 },
};

export function isEnergyClass(value: unknown): value is EnergyClass {
  return typeof value === "string" && ENERGY_CLASSES.includes(value as EnergyClass);
}

export function findBestEnergyWindow(points: PricePoint[], energyKwh: number, durationHours: number, now: number): PriceWindow | undefined {
  const horizon = now + 48 * 60 * 60 * 1000;
  const averagePowerKw = energyKwh / durationHours;
  const calculateCost = (startsAt: number) => {
    const endsAt = startsAt + durationHours * 3_600_000;
    let coveredHours = 0;
    let cost = 0;
    points.forEach((point, index) => {
      const intervalStart = point.startsAt.getTime();
      const intervalEnd = points[index + 1]?.startsAt.getTime() ?? intervalStart + 3_600_000;
      const overlapStart = Math.max(startsAt, intervalStart);
      const overlapEnd = Math.min(endsAt, intervalEnd);
      if (overlapEnd <= overlapStart) return;
      const overlapHours = (overlapEnd - overlapStart) / 3_600_000;
      cost += (point.totalOrePerKwh / 100) * averagePowerKw * overlapHours;
      coveredHours += overlapHours;
    });
    return coveredHours >= durationHours - 0.001 ? cost : undefined;
  };
  const candidates = points.map((startPoint) => {
    if (startPoint.startsAt.getTime() < now || startPoint.startsAt.getTime() >= horizon) return undefined;
    const cost = calculateCost(startPoint.startsAt.getTime());
    return cost === undefined ? undefined : { startsAt: startPoint.startsAt, cost };
  }).filter((item): item is { startsAt: Date; cost: number } => Boolean(item));
  if (!candidates.length) return undefined;
  const cheapest = candidates.reduce((best, item) => item.cost < best.cost ? item : best);
  const nowCost = calculateCost(now);
  if (nowCost === undefined) return undefined;
  return { cheapest, nowCost, savings: Math.max(0, nowCost - cheapest.cost) };
}
