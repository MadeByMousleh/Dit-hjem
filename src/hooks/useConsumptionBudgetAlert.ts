import { useEffect, useMemo, useState } from 'react';
import type { PricePoint } from '../prices';
import type { ElectricityUsage } from '../services/eloverblik';
import { consumptionBudgetProgress, localPriceAlertsSupported, requestPriceAlertPermission, sendConsumptionBudgetAlert, type ConsumptionBudgetUnit } from '../services/low-price-alert';
import { usageToday } from '../utils/usagePeriods';

export type ConsumptionBudgetAlertStatus = 'off' | 'watching' | 'no-data' | 'near-limit' | 'sent' | 'unsupported' | 'development-build-required' | 'error';

function localMonth(now: number) { return usageToday(now).slice(0, 7); }
function daysInMonth(month: string) { return new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).getUTCDate(); }

export function useConsumptionBudgetAlert({ enabled, unit, limit, usage, prices, now = Date.now() }: {
  enabled: boolean; unit: ConsumptionBudgetUnit; limit: number; usage: ElectricityUsage | null; prices: PricePoint[]; now?: number;
}) {
  const [status, setStatus] = useState<ConsumptionBudgetAlertStatus>(enabled ? 'watching' : 'off');
  const month = localMonth(now);
  const progress = useMemo(() => {
    const elapsed = Math.max(0, Number(usageToday(now).slice(-2)) - 1);
    if (!usage?.meterCount || elapsed < 1) return null;
    const byDate = new Map(usage.points.map(point => [point.at.slice(0, 10), point]));
    const values: number[] = [];
    for (let day = 1; day <= elapsed; day++) {
      const point = byDate.get(`${month}-${String(day).padStart(2, '0')}`);
      if (!point || point.kwh === null || point.incomplete) return null;
      values.push(point.kwh);
    }
    const currentPrices = prices.filter(point => Number.isFinite(point.totalOrePerKwh));
    const averageOrePerKwh = currentPrices.length ? currentPrices.reduce((sum, point) => sum + point.totalOrePerKwh, 0) / currentPrices.length : NaN;
    return consumptionBudgetProgress({ dailyKwh: values, daysElapsed: elapsed, daysInMonth: daysInMonth(month), unit, limit, estimatedOrePerKwh: averageOrePerKwh });
  }, [limit, month, now, prices, unit, usage]);

  useEffect(() => {
    if (!enabled) { setStatus('off'); return; }
    if (!localPriceAlertsSupported()) { setStatus('development-build-required'); return; }
    if (!progress) { setStatus('no-data'); return; }
    let active = true;
    setStatus(progress.level ? 'near-limit' : 'watching');
    void sendConsumptionBudgetAlert({ progress, unit, limit, monthKey: month }).then(result => {
      if (!active) return;
      setStatus(result === 'sent' ? 'sent' : result === 'unsupported' ? 'unsupported' : progress.level ? 'near-limit' : 'watching');
    }).catch(() => { if (active) setStatus('error'); });
    return () => { active = false; };
  }, [enabled, limit, month, progress, unit]);

  const requestConsumptionBudgetAlertPermission = async () => {
    if (!localPriceAlertsSupported()) { setStatus('development-build-required'); return false; }
    const allowed = await requestPriceAlertPermission();
    if (!allowed) setStatus('error');
    return allowed;
  };

  return { consumptionBudgetAlertStatus: status, requestConsumptionBudgetAlertPermission };
}
