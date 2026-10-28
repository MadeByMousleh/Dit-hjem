import { Alert, Linking, Platform } from "react-native";
import { useCallback, useEffect, useRef, useState } from "react";
import { getTeslaAuthorizationUrl, getTeslaStatus, getTeslaVehicles, setTeslaCharging } from "../services/tesla";
import { updateProfile } from "../services/storage";
import { TeslaVehicle } from "../types/app";

export function useTeslaConnection(refreshKey: string, enabled = true) {
  const [connected, setConnected] = useState(false);
  const [vehicle, setVehicle] = useState<TeslaVehicle | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [chargingCommandPending, setChargingCommandPending] = useState(false);
  const [virtualKeyPairingUrl, setVirtualKeyPairingUrl] = useState<string | null>(null);
  const [showOnDashboard, setShowOnDashboard] = useState(false);
  const lastRefresh = useRef<number | null>(null);
  const pendingRefresh = useRef<Promise<void> | null>(null);

  const refresh = useCallback((force = true): Promise<void> => {
    if (!enabled) return Promise.resolve();
    if (pendingRefresh.current) return pendingRefresh.current;
    if (!force && lastRefresh.current !== null && Date.now() - lastRefresh.current < 60_000) return Promise.resolve();
    setRefreshing(true);
    const request = (async () => {
      try {
        const status = await getTeslaStatus();
        setConnected(Boolean(status.connected));
        setVirtualKeyPairingUrl(status.virtualKeyPairingUrl ?? null);
        if (!status.connected) {
          setVehicle(null);
          lastRefresh.current = Date.now();
          return;
        }
        const vehicles = await getTeslaVehicles();
        setVehicle(vehicles[0] ?? null);
        lastRefresh.current = Date.now();
      } catch {
        // A temporary network failure does not mean the account was disconnected.
      } finally {
        setRefreshing(false);
        pendingRefresh.current = null;
      }
    })();
    pendingRefresh.current = request;
    return request;
  }, [enabled]);

  useEffect(() => {
    if (refreshKey === 'home' || refreshKey === 'car') void refresh(false);
  }, [refreshKey, refresh]);

  useEffect(() => {
    if (!enabled || Platform.OS === 'web') return;
    const complete = ({ url }: { url: string }) => {
      if (url.startsWith('stromblik://tesla/connected')) void refresh();
    };
    const subscription = Linking.addEventListener('url', complete);
    void Linking.getInitialURL().then(url => { if (url) complete({ url }); });
    return () => subscription.remove();
  }, [refresh, enabled]);

  const connect = useCallback(async () => {
    if (!enabled) return;
    try {
      const authorizationUrl = await getTeslaAuthorizationUrl(Platform.OS !== 'web');
      if (Platform.OS === 'web') window.location.assign(authorizationUrl);
      else await Linking.openURL(authorizationUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Tesla-login kunne ikke startes.';
      Alert.alert('Tesla kunne ikke forbindes', message);
    }
  }, [enabled]);

  const setDashboardVisibility = useCallback((value: boolean) => {
    if (!enabled) return;
    setShowOnDashboard(value);
    void updateProfile({ teslaShowOnDashboard: value });
  }, [enabled]);

  const pairVirtualKey = useCallback(async () => {
    if (!enabled) return;
    if (!vehicle?.vin || !virtualKeyPairingUrl) {
      Alert.alert('Virtuel nøgle er ikke klar', 'Opdatér Tesla-forbindelsen og prøv igen.');
      return;
    }
    const url = `${virtualKeyPairingUrl}?vin=${encodeURIComponent(vehicle.vin)}`;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Tesla-appen kunne ikke åbnes', 'Installér eller opdatér Tesla-appen, og prøv igen.');
    }
  }, [vehicle?.vin, virtualKeyPairingUrl, enabled]);

  const setCharging = useCallback(async (action: 'start' | 'stop') => {
    if (!enabled || !vehicle?.vin || chargingCommandPending) return;
    setChargingCommandPending(true);
    try {
      await setTeslaCharging(vehicle.vin, action);
      await refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Prøv igen.';
      const keyPairingRequired = /vehicle command protocol required|missing[_ ]key|virtual key|signed command|end-to-end command/i.test(message);
      if (keyPairingRequired && virtualKeyPairingUrl) {
        Alert.alert('Forbind virtuel Tesla-nøgle', 'Tesla kræver, at du godkender Strømblik som en virtuel nøgle for denne bil. Vi åbner Tesla-appen, hvor du kan logge ind og godkende.', [
          { text: 'Annuller', style: 'cancel' },
          { text: 'Åbn Tesla-appen', onPress: () => { void pairVirtualKey(); } },
        ]);
      } else {
        Alert.alert('Tesla-kommandoen mislykkedes', message);
      }
    } finally {
      setChargingCommandPending(false);
    }
  }, [chargingCommandPending, pairVirtualKey, refresh, vehicle?.vin, virtualKeyPairingUrl, enabled]);

  return { connected, vehicle, refreshing, chargingCommandPending, showOnDashboard, setShowOnDashboard, refresh, connect, setCharging, pairVirtualKey, setDashboardVisibility };
}
