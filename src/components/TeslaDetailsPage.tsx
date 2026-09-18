import { Feather } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { TeslaVehicle } from "../types/app";
import { formatDuration, formatPrice } from "../utils/formatting";

const colors = {
  ink: "#18332F",
  muted: "#65736E",
  white: "#FFFEFA",
  green: "#0B694F",
  panel: "#E8F0EC",
  border: "#C7D9CD",
};

function rowValue(value: string | number | null | undefined, suffix = "") {
  if (value == null || value === "") return "-";
  if (typeof value === "number") return `${formatPrice(value, 1)}${suffix}`;
  return `${value}${suffix}`;
}

function chargingLabel(state: string | null) {
  if (!state) return "Ukendt";
  const labels: Record<string, string> = {
    Charging: "Lader",
    Complete: "Faerdig",
    Disconnected: "Ikke tilsluttet",
    NoPower: "Ingen stroem",
    Stopped: "Stoppet",
  };
  return labels[state] ?? state;
}

function boolLabel(value: boolean | null) {
  if (value == null) return "Ukendt";
  return value ? "Ja" : "Nej";
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue}>{value}</Text>
    </View>
  );
}

export function TeslaDetailsPage({ vehicle, refreshing, onRefresh }: {
  vehicle: TeslaVehicle | null;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  if (!vehicle) {
    return (
      <View style={styles.panel}>
        <Text style={styles.title}>Tesla detaljer</Text>
        <Text style={styles.description}>Ingen bildata tilgaengelig endnu. Forbind Tesla og opdater status.</Text>
      </View>
    );
  }

  const details = [
    { label: "Model", value: vehicle.model },
    { label: "Farve", value: vehicle.exteriorColor ?? "Ukendt" },
    { label: "Trim", value: vehicle.trim ?? "Ukendt" },
    { label: "Batteri", value: rowValue(vehicle.batteryLevel, "%") },
    { label: "Raekkevidde", value: rowValue(vehicle.batteryRangeKm, " km") },
    { label: "Estimeret raekkevidde", value: rowValue(vehicle.estimatedBatteryRangeKm, " km") },
    { label: "Ladegraense", value: rowValue(vehicle.chargeLimitSoc, "%") },
    { label: "Ladestatus", value: chargingLabel(vehicle.chargingState) },
    { label: "Ladeeffekt", value: rowValue(vehicle.chargerPowerKw, " kW") },
    { label: "Tid til fuld", value: vehicle.timeToFullChargeHours == null ? "-" : formatDuration(vehicle.timeToFullChargeHours) },
    { label: "Tilfoejet energi", value: rowValue(vehicle.chargeEnergyAddedKwh, " kWh") },
    { label: "Kilometer", value: rowValue(vehicle.odometerKm, " km") },
    { label: "Laast", value: boolLabel(vehicle.locked) },
    { label: "Sentry mode", value: boolLabel(vehicle.sentryMode) },
    { label: "Kabinetemperatur", value: rowValue(vehicle.insideTempC, " C") },
    { label: "Udetemperatur", value: rowValue(vehicle.outsideTempC, " C") },
  ];

  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>{vehicle.name}</Text>
          <Text style={styles.description}>{[vehicle.model, vehicle.exteriorColor, vehicle.trim].filter(Boolean).join(" · ")}</Text>
        </View>
        <Pressable onPress={onRefresh} style={styles.refreshButton}>
          <Feather name={refreshing ? "loader" : "refresh-cw"} size={15} color={colors.white} />
          <Text style={styles.refreshText}>{refreshing ? "Opdaterer" : "Opdater"}</Text>
        </Pressable>
      </View>

      <View style={styles.grid}>
        {details.map((detail) => (
          <Tile key={detail.label} label={detail.label} value={detail.value} />
        ))}
      </View>

      <Text style={styles.meta}>Senest hentet: {new Date(vehicle.fetchedAt).toLocaleString("da-DK")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginTop: 16,
    padding: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    gap: 12,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  title: { fontFamily: "Fraunces_600SemiBold", fontSize: 20, color: colors.ink },
  description: { marginTop: 2, fontFamily: "DMSans_400Regular", fontSize: 12, color: colors.muted },
  refreshButton: {
    minHeight: 34,
    paddingHorizontal: 11,
    borderRadius: 17,
    backgroundColor: colors.ink,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  refreshText: { fontFamily: "DMSans_700Bold", fontSize: 11, color: colors.white },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: {
    minWidth: 130,
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.white,
  },
  tileLabel: { fontFamily: "DMSans_700Bold", fontSize: 10, color: colors.muted },
  tileValue: { marginTop: 4, fontFamily: "DMSans_700Bold", fontSize: 13, color: colors.ink },
  meta: { fontFamily: "DMSans_400Regular", fontSize: 11, color: colors.muted },
});
