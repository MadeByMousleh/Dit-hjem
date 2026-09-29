import { useCallback, useEffect, useState } from 'react';
import type { PricePoint } from '../prices';
import { cancelChargingWindowAlerts, localPriceAlertsSupported, requestPriceAlertPermission, scheduleChargingWindowAlert, type ChargingWindowAlertSchedule } from '../services/low-price-alert';

export type ChargingWindowAlertStatus = 'off' | 'scheduled' | 'no-window' | 'sample-prices' | 'unsupported' | 'development-build-required' | 'error';

export function useChargingWindowAlert({ enabled, points, samplePrices, durationHours, readyByHour }: { enabled: boolean; points: PricePoint[]; samplePrices: boolean; durationHours: number; readyByHour: number }) {
  const [status, setStatus] = useState<ChargingWindowAlertStatus>(enabled ? 'no-window' : 'off');

  const requestPermission = useCallback(async () => {
    if (!localPriceAlertsSupported()) { setStatus('development-build-required'); return false; }
    try {
      const allowed = await requestPriceAlertPermission();
      if (!allowed) setStatus('error');
      return allowed;
    } catch { setStatus('error'); return false; }
  }, []);

  useEffect(() => {
    let active = true;
    if (!enabled) { setStatus('off'); void cancelChargingWindowAlerts().catch(() => undefined); return; }
    if (samplePrices) { setStatus('sample-prices'); return; }
    void scheduleChargingWindowAlert(points, durationHours, readyByHour).then((next: ChargingWindowAlertSchedule) => {
      if (active) setStatus(next);
    }).catch(() => { if (active) setStatus('error'); });
    return () => { active = false; };
  }, [durationHours, enabled, points, readyByHour, samplePrices]);

  return { chargingWindowAlertStatus: status, requestChargingWindowAlertPermission: requestPermission };
}
