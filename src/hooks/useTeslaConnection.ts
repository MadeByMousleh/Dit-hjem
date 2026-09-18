import { Linking } from "react-native";
import { useCallback, useEffect, useState } from "react";
import { getTeslaAuthorizationUrl, getTeslaStatus, getTeslaVehicles } from "../services/tesla";
import { updateProfile } from "../services/storage";
import { TeslaVehicle } from "../types/app";

export function useTeslaConnection(refreshKey: string) {
  const [connected, setConnected] = useState(false);
  const [vehicle, setVehicle] = useState<TeslaVehicle | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showOnDashboard, setShowOnDashboard] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const status = await getTeslaStatus();
      setConnected(Boolean(status.connected));
      if (!status.connected) {
        setVehicle(null);
        return;
      }
      const vehicles = await getTeslaVehicles();
      setVehicle(vehicles[0] ?? null);
    } catch {
      setConnected(false);
      setVehicle(null);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refreshKey, refresh]);

  const connect = useCallback(() => {
    const authorizationUrl = getTeslaAuthorizationUrl();
    if (typeof window !== "undefined") window.location.assign(authorizationUrl);
    else void Linking.openURL(authorizationUrl);
  }, []);

  const setDashboardVisibility = useCallback((value: boolean) => {
    setShowOnDashboard(value);
    void updateProfile({ teslaShowOnDashboard: value });
  }, []);

  return { connected, vehicle, refreshing, showOnDashboard, setShowOnDashboard, refresh, connect, setDashboardVisibility };
}
