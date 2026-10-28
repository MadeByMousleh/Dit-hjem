import { useCallback, useEffect, useState } from 'react';
import {useNotificationOwner} from './useNotificationOwner';
import type { PricePoint } from '../prices';
import { cancelHighPriceAlerts, localPriceAlertsSupported, requestPriceAlertPermission, scheduleHighPriceAlert, type HighPriceAlertSchedule } from '../services/low-price-alert';

export type HighPriceAlertStatus = 'off' | 'scheduled' | 'no-rise' | 'sample-prices' | 'unsupported' | 'development-build-required' | 'error';

export function useHighPriceAlert({ enabled, points, samplePrices, thresholdOrePerKwh }: { enabled: boolean; points: PricePoint[]; samplePrices: boolean; thresholdOrePerKwh: number }) {
  const owner = useNotificationOwner();
  const [status, setStatus] = useState<HighPriceAlertStatus>(enabled ? 'no-rise' : 'off');

  const requestPermission = useCallback(async () => {
    if (!localPriceAlertsSupported()) {
      setStatus('development-build-required');
      return false;
    }
    try {
      const allowed = await requestPriceAlertPermission();
      if (!allowed) setStatus('error');
      return allowed;
    } catch {
      setStatus('error');
      return false;
    }
  }, []);

  useEffect(() => {
    let active = true;
    if (!owner) { setStatus('off'); return; }
    if (!enabled) {
      setStatus('off');
      void cancelHighPriceAlerts(owner).catch(() => { if (active) setStatus('error'); });
      return () => { active = false; };
    }
    if (samplePrices) {
      setStatus('sample-prices');
      return;
    }
    void scheduleHighPriceAlert(owner, points, thresholdOrePerKwh).then((next: HighPriceAlertSchedule) => {
      if (active) setStatus(next);
    }).catch(() => { if (active) setStatus('error'); });
    return () => { active = false; };
  }, [owner, enabled, points, samplePrices, thresholdOrePerKwh]);

  return { highPriceAlertStatus: status, requestHighPriceAlertPermission: requestPermission };
}
