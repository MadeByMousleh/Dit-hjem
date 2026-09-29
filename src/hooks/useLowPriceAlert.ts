import { useCallback, useEffect, useState } from 'react';
import type { PricePoint } from '../prices';
import { cancelLowPriceAlerts, localPriceAlertsSupported, requestLowPriceAlertPermission, scheduleLowPriceAlert, type LowPriceAlertSchedule } from '../services/low-price-alert';

export type LowPriceAlertStatus = 'off' | 'scheduled' | 'no-window' | 'sample-prices' | 'unsupported' | 'development-build-required' | 'error';

export function useLowPriceAlert({ enabled, points, samplePrices, thresholdOrePerKwh }: { enabled: boolean; points: PricePoint[]; samplePrices: boolean; thresholdOrePerKwh: number }) {
  const [status, setStatus] = useState<LowPriceAlertStatus>(enabled ? 'no-window' : 'off');

  const requestPermission = useCallback(async () => {
    if (!localPriceAlertsSupported()) {
      setStatus('development-build-required');
      return false;
    }
    try {
      const allowed = await requestLowPriceAlertPermission();
      if (!allowed) setStatus('error');
      return allowed;
    } catch {
      setStatus('error');
      return false;
    }
  }, []);

  useEffect(() => {
    let active = true;
    if (!enabled) {
      setStatus('off');
      void cancelLowPriceAlerts().catch(() => undefined);
      return;
    }
    if (samplePrices) {
      setStatus('sample-prices');
      return;
    }
    void scheduleLowPriceAlert(points, thresholdOrePerKwh).then((next: LowPriceAlertSchedule) => {
      if (active) setStatus(next);
    }).catch(() => { if (active) setStatus('error'); });
    return () => { active = false; };
  }, [enabled, points, samplePrices, thresholdOrePerKwh]);

  return { lowPriceAlertStatus: status, requestLowPriceAlertPermission: requestPermission };
}
