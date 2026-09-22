import { Feather } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { EvModel } from "../evData";
import { PricePoint } from "../prices";
import { TeslaVehicle } from "../types/app";
import { formatDuration, formatPrice } from "../utils/formatting";

type Page = "overview" | "battery" | "charging" | "climate" | "vehicle";
type DetailPage = Exclude<Page, "overview">;

const c = { blue: "#5A78FF", type: "#504678", ink: "#3C3246", beige: "#F5F5F2", white: "#FFFFFF", violet: "#897AFF", soft: "#CBD8FF", coral: "#FF645A" } as const;

export type TeslaDetailsPageProps = {
  vehicle: TeslaVehicle | null;
  refreshing: boolean;
  onRefresh: () => void;
  connected?: boolean;
  onConnect?: () => void;
  points?: PricePoint[];
  now?: number;
  evModels?: EvModel[];
};

function chargingLabel(state: string | null) {
  return ({ Charging: "Oplader nu", Complete: "Fuldt opladet", Disconnected: "Ikke tilsluttet", NoPower: "Ingen strøm på lader", Stopped: "Opladning stoppet", Starting: "Starter opladning" } as Record<string, string>)[state ?? ""] ?? "Ikke tilsluttet";
}

function Battery({ level }: { level: number }) {
  const value = Math.max(0, Math.min(100, level));
  return <View style={styles.batteryWrap} accessibilityLabel={`Batteri ${Math.round(value)} procent`}><View style={styles.batteryCap} /><View style={styles.battery}><View style={[styles.batteryFill, { height: `${value}%` }]} /><View style={styles.batteryNumber}><Text style={styles.batteryDigits}>{Math.round(value)}</Text><Text style={styles.batteryPercent}>%</Text></View></View></View>;
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return <View style={[styles.row, last && styles.rowLast]}><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowValue}>{value}</Text></View>;
}

function MenuCard({ icon, title, text, onPress }: { icon: keyof typeof Feather.glyphMap; title: string; text: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.menuCard}><View style={styles.menuIcon}><Feather name={icon} size={20} color={c.blue} /></View><View style={styles.menuCopy}><Text style={styles.menuTitle}>{title}</Text><Text style={styles.menuText}>{text}</Text></View><Feather name="chevron-right" size={20} color={c.type} /></Pressable>;
}

export function TeslaDetailsPage({ vehicle, refreshing, onRefresh, onConnect, points = [], now = Date.now(), evModels = [] }: TeslaDetailsPageProps) {
  const [page, setPage] = useState<Page>("overview");
  if (!vehicle) return <View style={styles.empty}><View style={styles.emptyIcon}><Feather name="zap" size={26} color={c.blue} /></View><Text style={styles.emptyTitle}>Forbind din Tesla</Text><Text style={styles.emptyText}>Se batteri, opladning og bilstatus samlet ét sted.</Text>{onConnect ? <Pressable onPress={onConnect} style={styles.primary}><Feather name="external-link" size={16} color={c.white} /><Text style={styles.primaryText}>Forbind Tesla</Text></Pressable> : null}</View>;

  const level = vehicle.batteryLevel ?? 0;
  const limit = vehicle.chargeLimitSoc ?? 80;
  const model = evModels.find((item) => `${item.modelName} ${item.name}`.toLowerCase().includes((vehicle.model || vehicle.name).toLowerCase()));
  const capacity = model?.batteryKwh ?? 75;
  const missing = capacity * Math.max(0, limit - level) / 100 / 0.9;
  const price = [...points].reverse().find((point) => point.startsAt.getTime() <= now)?.totalOrePerKwh ?? 0;
  const cost = missing * price / 100;
  const charging = chargingLabel(vehicle.chargingState);
  const title: Record<DetailPage, string> = { battery: "Batteri", charging: "Opladning", climate: "Klima", vehicle: "Bil" };

  const overview = <>
    <View style={styles.batteryCard}><Battery level={level} /><View style={styles.batteryCopy}><Text style={styles.smallLabel}>BATTERI</Text><Text style={styles.range}>{vehicle.batteryRangeKm != null ? `${Math.round(vehicle.batteryRangeKm)} km` : "Rækkevidde ukendt"}</Text><Text style={styles.subtle}>Estimeret rækkevidde</Text><View style={styles.limit}><Feather name="target" size={13} color={c.blue} /><Text style={styles.limitText}>Ladegrænse {limit}%</Text></View></View></View>
    <View style={styles.glanceGrid}><View style={styles.glance}><Feather name="zap" size={16} color={c.violet} /><Text style={styles.smallLabel}>OPLADNING</Text><Text style={styles.glanceValue}>{charging}</Text></View><View style={styles.glance}><Feather name={vehicle.locked ? "lock" : "unlock"} size={16} color={vehicle.locked ? c.blue : c.coral} /><Text style={styles.smallLabel}>BIL</Text><Text style={styles.glanceValue}>{vehicle.locked ? "Låst" : "Ulåst"}</Text></View></View>
    <Text style={styles.heading}>DETALJER</Text><View style={styles.menuList}>
      <MenuCard icon="battery-charging" title="Batteri" text={`${Math.round(level)}% · ${formatPrice(capacity, 0)} kWh kapacitet`} onPress={() => setPage("battery")} />
      <MenuCard icon="zap" title="Opladning" text={vehicle.chargerPowerKw ? `${formatPrice(vehicle.chargerPowerKw, 1)} kW · ${charging}` : charging} onPress={() => setPage("charging")} />
      <MenuCard icon="thermometer" title="Klima" text={vehicle.insideTempC != null ? `${vehicle.insideTempC.toFixed(1).replace(".", ",")} °C i kabinen` : "Temperatur og forkonditionering"} onPress={() => setPage("climate")} />
      <MenuCard icon="shield" title="Bil" text="Lås, vagtfunktion og køretøjsoplysninger" onPress={() => setPage("vehicle")} />
    </View>
  </>;

  const content = page === "battery" ? <><View style={styles.detailBattery}><Battery level={level} /><Text style={styles.detailCaption}>Ladegrænse {limit}%</Text></View><View style={styles.details}><Row label="Rækkevidde" value={vehicle.batteryRangeKm != null ? `${Math.round(vehicle.batteryRangeKm)} km` : "–"} /><Row label="Estimeret rækkevidde" value={vehicle.estimatedBatteryRangeKm != null ? `${Math.round(vehicle.estimatedBatteryRangeKm)} km` : "–"} /><Row label="Batterikapacitet" value={`${formatPrice(capacity, 1)} kWh`} /><Row label="Mangler til grænse" value={`${formatPrice(missing, 1)} kWh`} last /></View></> : page === "charging" ? <><View style={styles.status}><View style={styles.statusIcon}><Feather name="zap" size={20} color={c.blue} /></View><View><Text style={styles.statusTitle}>{charging}</Text><Text style={styles.statusText}>{vehicle.chargePortDoorOpen ? "Ladeporten er åben" : "Ladeporten er lukket"}</Text></View></View><View style={styles.details}><Row label="Ladeeffekt" value={vehicle.chargerPowerKw != null ? `${formatPrice(vehicle.chargerPowerKw, 1)} kW` : "–"} /><Row label="Resterende ladetid" value={vehicle.timeToFullChargeHours != null ? formatDuration(vehicle.timeToFullChargeHours) : "–"} /><Row label="Tilført energi" value={vehicle.chargeEnergyAddedKwh != null ? `${formatPrice(vehicle.chargeEnergyAddedKwh, 1)} kWh` : "–"} /><Row label="Pris til grænse" value={price > 0 ? `${formatPrice(cost, 2)} kr.` : "–"} last /></View></> : page === "climate" ? <View style={styles.details}><Row label="Temperatur i kabinen" value={vehicle.insideTempC != null ? `${vehicle.insideTempC.toFixed(1).replace(".", ",")} °C` : "–"} /><Row label="Temperatur udenfor" value={vehicle.outsideTempC != null ? `${vehicle.outsideTempC.toFixed(1).replace(".", ",")} °C` : "–"} /><Row label="Forkonditionering" value={vehicle.isPreconditioning ? "Aktiv" : "Ikke aktiv"} last /></View> : <View style={styles.details}><Row label="Låsestatus" value={vehicle.locked ? "Bilen er låst" : "Bilen er ulåst"} /><Row label="Vagtfunktion" value={vehicle.sentryMode ? "Aktiv" : "Ikke aktiv"} /><Row label="Kilometerstand" value={vehicle.odometerKm != null ? `${formatPrice(vehicle.odometerKm, 0)} km` : "–"} /><Row label="Køretøj" value={[vehicle.model, vehicle.trim].filter(Boolean).join(" · ") || "Tesla"} last /></View>;

  return <View style={styles.wrapper}>{page === "overview" ? <View style={styles.top}><View><Text style={styles.smallLabel}>DIN TESLA</Text><Text style={styles.name}>{vehicle.name || "Tesla"}</Text><Text style={styles.subtle}>{[vehicle.model, vehicle.trim].filter(Boolean).join(" · ") || "Forbundet bil"}</Text></View><Pressable onPress={onRefresh} disabled={refreshing} style={styles.refresh}><Feather name={refreshing ? "loader" : "refresh-cw"} size={17} color={c.blue} /></Pressable></View> : <View style={styles.detailHeader}><Pressable onPress={() => setPage("overview")} style={styles.back}><Feather name="arrow-left" size={18} color={c.blue} /></Pressable><View><Text style={styles.smallLabel}>DIN TESLA</Text><Text style={styles.detailTitle}>{title[page]}</Text></View></View>}{page === "overview" ? overview : content}<Text style={styles.updated}>Senest opdateret {new Date(vehicle.fetchedAt).toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" })}</Text></View>;
}

const styles = StyleSheet.create({
  wrapper: { marginTop: 14, marginBottom: 28, gap: 14 }, top: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }, smallLabel: { fontFamily: "DMSans_700Bold", fontSize: 10, letterSpacing: 0.8, color: c.type }, name: { fontFamily: "Fraunces_600SemiBold", fontSize: 28, color: c.ink, marginTop: 4 }, subtle: { fontFamily: "DMSans_400Regular", fontSize: 13, color: c.type, marginTop: 2 }, refresh: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center", backgroundColor: c.soft },
  batteryCard: { flexDirection: "row", alignItems: "center", gap: 24, padding: 20, borderRadius: 24, backgroundColor: c.white, borderWidth: 1, borderColor: c.soft }, batteryWrap: { width: 94, height: 164, alignItems: "center", justifyContent: "flex-end" }, batteryCap: { width: 30, height: 8, borderTopLeftRadius: 5, borderTopRightRadius: 5, backgroundColor: c.ink }, battery: { width: 84, height: 148, overflow: "hidden", justifyContent: "center", alignItems: "center", borderRadius: 16, borderWidth: 5, borderColor: c.ink, backgroundColor: c.beige }, batteryFill: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: c.blue }, batteryNumber: { flexDirection: "row", alignItems: "baseline", zIndex: 1 }, batteryDigits: { fontFamily: "Fraunces_600SemiBold", fontSize: 34, color: c.ink }, batteryPercent: { fontFamily: "DMSans_700Bold", fontSize: 16, color: c.ink }, batteryCopy: { flex: 1 }, range: { fontFamily: "Fraunces_600SemiBold", fontSize: 26, color: c.ink, marginTop: 4 }, limit: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 6, paddingHorizontal: 9, borderRadius: 14, backgroundColor: c.soft, marginTop: 12 }, limitText: { fontFamily: "DMSans_700Bold", fontSize: 11, color: c.ink },
  glanceGrid: { flexDirection: "row", gap: 10 }, glance: { flex: 1, minHeight: 90, padding: 13, borderRadius: 18, backgroundColor: c.white, borderWidth: 1, borderColor: c.soft }, glanceValue: { fontFamily: "DMSans_700Bold", fontSize: 13, color: c.ink, marginTop: 3 }, heading: { fontFamily: "DMSans_700Bold", fontSize: 10, letterSpacing: 0.8, color: c.type, marginTop: 8, marginLeft: 4 }, menuList: { gap: 8 }, menuCard: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 18, backgroundColor: c.white, borderWidth: 1, borderColor: c.soft }, menuIcon: { width: 42, height: 42, borderRadius: 14, justifyContent: "center", alignItems: "center", backgroundColor: c.soft }, menuCopy: { flex: 1 }, menuTitle: { fontFamily: "DMSans_700Bold", fontSize: 14, color: c.ink }, menuText: { fontFamily: "DMSans_400Regular", fontSize: 11, color: c.type, marginTop: 2 },
  detailHeader: { flexDirection: "row", alignItems: "center", gap: 12 }, back: { width: 42, height: 42, borderRadius: 21, justifyContent: "center", alignItems: "center", backgroundColor: c.soft }, detailTitle: { fontFamily: "Fraunces_600SemiBold", fontSize: 25, color: c.ink, marginTop: 2 }, detailBattery: { alignItems: "center", padding: 20, borderRadius: 24, backgroundColor: c.white, borderWidth: 1, borderColor: c.soft }, detailCaption: { fontFamily: "DMSans_700Bold", fontSize: 13, color: c.type, marginTop: 12 }, details: { borderRadius: 20, overflow: "hidden", backgroundColor: c.white, borderWidth: 1, borderColor: c.soft }, row: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 18, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: c.soft }, rowLast: { borderBottomWidth: 0 }, rowLabel: { flex: 1, fontFamily: "DMSans_500Medium", fontSize: 13, color: c.type }, rowValue: { maxWidth: "55%", fontFamily: "DMSans_700Bold", fontSize: 13, color: c.ink, textAlign: "right" }, status: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 20, backgroundColor: c.soft }, statusIcon: { width: 42, height: 42, borderRadius: 14, justifyContent: "center", alignItems: "center", backgroundColor: c.white }, statusTitle: { fontFamily: "DMSans_700Bold", fontSize: 15, color: c.ink }, statusText: { fontFamily: "DMSans_400Regular", fontSize: 12, color: c.type, marginTop: 2 }, updated: { fontFamily: "DMSans_400Regular", fontSize: 11, textAlign: "center", color: c.type, marginTop: 2 },
  empty: { alignItems: "center", padding: 28, borderRadius: 24, backgroundColor: c.white, borderWidth: 1, borderColor: c.soft }, emptyIcon: { width: 58, height: 58, borderRadius: 20, justifyContent: "center", alignItems: "center", backgroundColor: c.soft }, emptyTitle: { fontFamily: "Fraunces_600SemiBold", fontSize: 24, color: c.ink, marginTop: 16 }, emptyText: { fontFamily: "DMSans_400Regular", fontSize: 13, lineHeight: 19, textAlign: "center", color: c.type, marginTop: 6 }, primary: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 18, minHeight: 44, borderRadius: 22, backgroundColor: c.blue, marginTop: 18 }, primaryText: { fontFamily: "DMSans_700Bold", fontSize: 13, color: c.white },
});
