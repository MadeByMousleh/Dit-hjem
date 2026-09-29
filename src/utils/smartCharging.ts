import type { PricePoint } from '../prices';

export type SmartChargingPlan = {
  startsAt: Date;
  endsAt: Date;
  durationHours: number;
  averageOrePerKwh: number;
  requiredKwh: number;
  estimatedCostDkk: number;
};

function validPoints(points: PricePoint[]) {
  return points
    .filter(point => Number.isFinite(point.startsAt.getTime()) && Number.isFinite(point.totalOrePerKwh))
    .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime());
}

function intervalMs(points: PricePoint[]) {
  const intervals = points.slice(1).map((point, index) => point.startsAt.getTime() - points[index]!.startsAt.getTime())
    .filter(interval => interval > 0 && interval <= 2 * 60 * 60 * 1000)
    .sort((left, right) => left - right);
  return intervals[Math.floor(intervals.length / 2)] ?? 60 * 60 * 1000;
}

function nextDeadline(now: number, readyByHour: number) {
  const deadline = new Date(now);
  deadline.setHours(readyByHour, 0, 0, 0);
  if (deadline.getTime() <= now) deadline.setDate(deadline.getDate() + 1);
  return deadline;
}

export function findSmartChargingPlan({ points, now = Date.now(), currentLevel, targetLevel, batteryKwh, chargerKw, readyByHour = 7, maxPriceOre }: {
  points: PricePoint[];
  now?: number;
  currentLevel: number;
  targetLevel: number;
  batteryKwh: number;
  chargerKw: number | null;
  readyByHour?: number;
  maxPriceOre?: number;
}): SmartChargingPlan | null {
  if (!Number.isFinite(currentLevel) || !Number.isFinite(targetLevel) || !Number.isFinite(batteryKwh) || currentLevel >= targetLevel || batteryKwh <= 0 || !Number.isInteger(readyByHour) || readyByHour < 0 || readyByHour > 23) return null;
  const requiredKwh = batteryKwh * (targetLevel - currentLevel) / 100 / 0.9;
  const effectiveChargerKw = chargerKw && chargerKw > 0 ? chargerKw : 3.7;
  const durationHours = Math.max(1, Math.min(6, Math.ceil(requiredKwh / effectiveChargerKw * 4) / 4));
  const durationMs = durationHours * 60 * 60 * 1000;
  const deadline = nextDeadline(now, readyByHour);
  const leadMs = 15 * 60 * 1000;
  const ordered = validPoints(points).filter(point => point.startsAt.getTime() >= now + leadMs && point.startsAt.getTime() < deadline.getTime());
  const step = intervalMs(ordered);
  let best: SmartChargingPlan | null = null;

  for (let index = 0; index < ordered.length; index++) {
    const startsAt = ordered[index]!.startsAt;
    const endsAt = new Date(startsAt.getTime() + durationMs);
    if (endsAt.getTime() > deadline.getTime()) continue;
    const window = ordered.filter(point => point.startsAt.getTime() >= startsAt.getTime() && point.startsAt.getTime() < endsAt.getTime());
    if (!window.length || window[window.length - 1]!.startsAt.getTime() + step < endsAt.getTime()
      || window.some((point, pointIndex) => pointIndex > 0 && point.startsAt.getTime() - window[pointIndex - 1]!.startsAt.getTime() > step * 1.1)) continue;
    const averageOrePerKwh = window.reduce((sum, point) => sum + point.totalOrePerKwh, 0) / window.length;
    if (maxPriceOre !== undefined && averageOrePerKwh > maxPriceOre) continue;
    const plan = { startsAt, endsAt, durationHours, averageOrePerKwh, requiredKwh, estimatedCostDkk: requiredKwh * averageOrePerKwh / 100 };
    if (!best || plan.averageOrePerKwh < best.averageOrePerKwh) best = plan;
  }
  return best;
}
