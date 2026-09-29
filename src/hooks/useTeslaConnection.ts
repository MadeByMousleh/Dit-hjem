import { Alert, Linking, Platform } from "react-native";
import { useCallback, useEffect, useState } from "react";
import { getTeslaAuthorizationUrl, getTeslaStatus, getTeslaVehicles, setTeslaCharging } from "../services/tesla";
import { updateProfile } from "../services/storage";
import { TeslaVehicle } from "../types/app";

export function useTeslaConnection(refreshKey: string) {
  const [connected, setConnected] = useState(false);
  const [vehicle, setVehicle] = useState<TeslaVehicle | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [chargingCommandPending, setChargingCommandPending] = useState(false);
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

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const complete = ({ url }: { url: string }) => {
      if (url.startsWith('stromblik://tesla/connected')) void refresh();
    };
    const subscription = Linking.addEventListener('url', complete);
    void Linking.getInitialURL().then(url => { if (url) complete({ url }); });
    return () => subscription.remove();
  }, [refresh]);

  const connect = useCallback(async () => {
    try {
      const authorizationUrl = await getTeslaAuthorizationUrl(Platform.OS !== 'web');
      if (Platform.OS === 'web') window.location.assign(authorizationUrl);
      else await Linking.openURL(authorizationUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Tesla-login kunne ikke startes.';
      Alert.alert('Tesla kunne ikke forbindes', message);
    }
  }, []);

  const setDashboardVisibility = useCallback((value: boolean) => {
    setShowOnDashboard(value);
    void updateProfile({ teslaShowOnDashboard: value });
  }, []);

  const setCharging = useCallback(async (action: 'start' | 'stop') => {
    if (!vehicle?.vin || chargingCommandPending) return;
    setChargingCommandPending(true);
    try {
      await setTeslaCharging(vehicle.vin, action);
      await refresh();
    } catch (error) {
      Alert.alert('Tesla-kommandoen mislykkedes', error instanceof Error ? error.message : 'Prøv igen.');
    } finally {
      setChargingCommandPending(false);
    }
  }, [chargingCommandPending, refresh, vehicle?.vin]);

  return { connected, vehicle, refreshing, chargingCommandPending, showOnDashboard, setShowOnDashboard, refresh, connect, setCharging, setDashboardVisibility };
}
