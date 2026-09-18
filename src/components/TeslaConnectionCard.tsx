import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { EvModel } from "../evData";
import { PricePoint } from "../prices";
import { TeslaVehicle } from "../types/app";
import { formatDuration, formatPrice } from "../utils/formatting";

const colors = { ink: "#18332F", muted: "#65736E", white: "#FFFEFA", green: "#0B694F" };

export function TeslaConnectionCard({ connected, vehicle, points, now, evModels, refreshing, showOnDashboard, onConnect, onRefresh, onToggleDashboard }: {
  connected: boolean;
  vehicle: TeslaVehicle | null;
  points: PricePoint[];
  now: number;
  evModels: EvModel[];
  refreshing: boolean;
  showOnDashboard: boolean;
  onConnect: () => void;
  onRefresh: () => void;
  onToggleDashboard: () => void;
}) {
  const vehicleQuery = (vehicle?.model ?? vehicle?.name ?? "").toLowerCase();
  const matchedModel = evModels.find((model) => `${model.modelName} ${model.name}`.toLowerCase().includes(vehicleQuery) || vehicleQuery.includes(model.modelName.toLowerCase()));
  const batteryKwh = matchedModel?.batteryKwh ?? 60;
  const batteryLevel = vehicle?.batteryLevel ?? 0;
  const neededKwh = batteryKwh * Math.max(0, 100 - batteryLevel) / 100 / 0.9;
  const currentPrice = [...points].reverse().find((point) => point.startsAt.getTime() <= now)?.totalOrePerKwh ?? 0;
  const chargeCost = neededKwh * currentPrice / 100;
  const estimatedHours = vehicle?.timeToFullChargeHours ?? (vehicle?.chargerPowerKw && vehicle.chargerPowerKw > 0 ? neededKwh / vehicle.chargerPowerKw : null);
  const chargingLabels: Record<string, string> = { Charging: "Lader", Complete: "Færdig", Disconnected: "Ikke tilsluttet", NoPower: "Ingen strøm", Stopped: "Stoppet" };
  const chargingLabel = vehicle?.chargingState ? chargingLabels[vehicle.chargingState] ?? vehicle.chargingState : "Status ikke tilgængelig";

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.icon}><Feather name="zap" size={20} color={colors.ink} /></View>
        <View style={styles.copy}>
          <Text style={styles.title}>{connected ? vehicle?.name ?? "Tesla er forbundet" : "Tilføj din Tesla"}</Text>
          <Text style={styles.description}>{connected ? vehicle?.model ?? "Live bilstatus" : "Forbind din bil for at bruge det aktuelle batteriniveau i ladeplanen."}</Text>
        </View>
        <View style={styles.actions}>
          <Pressable accessibilityLabel={showOnDashboard ? "Skjul Tesla fra overblik" : "Vis Tesla på overblik"} onPress={onToggleDashboard} style={[styles.visibilityButton, showOnDashboard && styles.visibilityButtonActive]}>
            <Feather name="eye" size={15} color={showOnDashboard ? colors.green : colors.muted} />
          </Pressable>
          <View style={[styles.statusDot, connected && styles.statusDotConnected]} />
        </View>
      </View>
      {connected && vehicle ? (
        <View style={styles.stats}>
          <View style={styles.primaryStat}><Text style={styles.batteryNumber}>{vehicle.batteryLevel == null ? "–" : `${Math.round(vehicle.batteryLevel)}%`}</Text><Text style={styles.label}>BATTERI</Text></View>
          <View style={styles.stat}><Text style={styles.value}>{matchedModel ? `${formatPrice(batteryKwh, 1)} kWh` : "Estimat"}</Text><Text style={styles.label}>BATTERISTØRRELSE</Text></View>
          <View style={styles.stat}><Text style={styles.value}>{chargingLabel}</Text><Text style={styles.label}>STATUS</Text></View>
          <View style={styles.stat}><Text style={styles.value}>{formatPrice(chargeCost, 2)} kr</Text><Text style={styles.label}>TIL FULD VED NU-PRIS</Text></View>
          <View style={styles.stat}><Text style={styles.value}>{estimatedHours == null ? "–" : formatDuration(estimatedHours)}</Text><Text style={styles.label}>EST. LADETID</Text></View>
        </View>
      ) : null}
      <Pressable accessibilityLabel={connected ? "Opdater Tesla-status" : "Forbind Tesla"} onPress={connected ? onRefresh : onConnect} style={styles.connectButton}>
        <Feather name={connected ? "refresh-cw" : "external-link"} size={15} color={colors.white} />
        <Text style={styles.connectButtonText}>{connected ? (refreshing ? "Henter status..." : "Opdater status") : "Forbind Tesla"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 18, padding: 15, borderRadius: 8, backgroundColor: "#E8F0EC", borderWidth: 1, borderColor: "#C7D9CD" },
  header: { flexDirection: "row", alignItems: "center", gap: 11 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.white },
  copy: { flex: 1 },
  title: { fontFamily: "DMSans_700Bold", fontSize: 14, color: colors.ink },
  description: { fontFamily: "DMSans_400Regular", fontSize: 11, lineHeight: 16, color: colors.muted, marginTop: 3 },
  actions: { alignItems: "center", gap: 8 },
  visibilityButton: { width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "rgba(255,254,250,0.7)" },
  visibilityButtonActive: { backgroundColor: colors.white },
  statusDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#B6C0BA" },
  statusDotConnected: { backgroundColor: colors.green },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 15, paddingTop: 13, borderTopWidth: 1, borderTopColor: "#C7D9CD" },
  primaryStat: { minWidth: 92, flex: 1, paddingRight: 8 },
  stat: { minWidth: 92, flex: 1, paddingRight: 8 },
  batteryNumber: { fontFamily: "Fraunces_600SemiBold", fontSize: 28, color: colors.ink },
  value: { minHeight: 34, fontFamily: "DMSans_700Bold", fontSize: 13, color: colors.ink },
  label: { fontFamily: "DMSans_700Bold", fontSize: 8, color: colors.muted, marginTop: 3 },
  connectButton: { minHeight: 36, marginTop: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 18, backgroundColor: colors.ink },
  connectButtonText: { fontFamily: "DMSans_700Bold", fontSize: 11, color: colors.white },
});
