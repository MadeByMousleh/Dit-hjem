import { Feather } from "@expo/vector-icons";
import { useFonts as useDMSans, DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from "@expo-google-fonts/dm-sans";
import { Fraunces_600SemiBold, useFonts as useFraunces } from "@expo-google-fonts/fraunces";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { createSamplePrices, fetchPrices, PricePoint } from "./src/prices";

const colors = {
  ink: "#18332F",
  muted: "#65736E",
  paper: "#F4F1E8",
  white: "#FFFEFA",
  mint: "#DCE9DC",
  green: "#0B694F",
  coral: "#E87555",
  yellow: "#F2CA6B",
  line: "#D8D9CF",
  navy: "#163B47",
};

const dkTime = new Intl.DateTimeFormat("da-DK", {
  timeZone: "Europe/Copenhagen",
  hour: "2-digit",
  minute: "2-digit",
});
const dkDay = new Intl.DateTimeFormat("da-DK", {
  timeZone: "Europe/Copenhagen",
  weekday: "long",
  day: "numeric",
  month: "short",
});

function formatPrice(value: number, digits = 0) {
  return value.toLocaleString("da-DK", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function dayKey(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Copenhagen",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getPriceTone(value: number, values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const low = sorted[Math.floor(sorted.length * 0.33)] ?? value;
  const high = sorted[Math.floor(sorted.length * 0.67)] ?? value;
  if (value <= low) return { label: "Lav pris", color: colors.green, soft: "#E2F0E6" };
  if (value >= high) return { label: "Høj pris", color: "#A4462E", soft: "#F8E1D8" };
  return { label: "Mellempris", color: "#745A13", soft: "#F8EDC8" };
}

function PriceChart({ points }: { points: PricePoint[] }) {
  const groups = new Map<string, PricePoint[]>();
  points.forEach((point) => {
    const key = `${dayKey(point.startsAt)}-${point.startsAt.getHours()}`;
    groups.set(key, [...(groups.get(key) ?? []), point]);
  });
  const allHours = [...groups.values()].map((group) => ({
    startsAt: group[0]!.startsAt,
    endsAt: new Date(group[group.length - 1]!.startsAt.getTime() + 15 * 60 * 1000),
    price: group.reduce((sum, point) => sum + point.totalOrePerKwh, 0) / group.length / 100,
  }));
  const now = Date.now();
  const currentHourIndex = Math.max(0, allHours.findIndex((item) => item.startsAt.getTime() <= now && item.endsAt.getTime() > now));
  const windowStart = Math.max(0, currentHourIndex - 2);
  const hourly = allHours.slice(windowStart, windowStart + 12);
  const currentBarIndex = currentHourIndex - windowStart;
  const [selectedIndex, setSelectedIndex] = useState(currentBarIndex);
  const selected = hourly[Math.min(selectedIndex, hourly.length - 1)];
  const maxPrice = Math.max(...hourly.map((item) => item.price), 2.25);
  const barColor = (price: number, selectedBar: boolean) => {
    if (price >= 2) return selectedBar ? "#B94F46" : "#E2B8B4";
    if (price >= 1.5) return selectedBar ? "#D9A62E" : "#F0DDA4";
    return selectedBar ? "#4E9B59" : "#B9D9BE";
  };

  return (
    <View style={styles.chartWrap}>
      <View style={styles.chartSelection}>
        <Text style={styles.chartSelectionTime}>{selected ? `kl. ${dkTime.format(selected.startsAt)}` : ""}</Text>
        <View style={styles.chartSelectionValue}>
          <Text style={styles.chartSelectionPrice}>{selected ? formatPrice(selected.price, 2) : ""}</Text>
          <Text style={styles.chartSelectionUnit}>kr/kWh</Text>
        </View>
      </View>
      <View style={styles.barChart}>
        {hourly.map((item, index) => {
          const selectedBar = index === selectedIndex;
          const currentBar = index === currentBarIndex;
          const height = Math.max(30, (item.price / maxPrice) * 112);
          return (
            <Pressable
              key={item.startsAt.toISOString()}
              accessibilityLabel={`${dkTime.format(item.startsAt)}, ${formatPrice(item.price, 2)} kroner per kilowatttime`}
              onPress={() => setSelectedIndex(index)}
              onPressIn={() => setSelectedIndex(index)}
              onHoverIn={() => setSelectedIndex(index)}
              style={styles.barSlot}
            >
              {currentBar ? <View style={[styles.currentMarker, { bottom: height + 5 }]}><Text style={styles.currentMarkerText}>NU</Text></View> : null}
              <View style={[styles.bar, { height, backgroundColor: barColor(item.price, selectedBar || currentBar) }, currentBar && styles.currentBar]} />
              {selectedBar ? <View style={styles.barSelector}><View style={styles.barSelectorInner} /></View> : null}
            </Pressable>
          );
        })}
      </View>
      <View style={styles.chartLabels}>
        <Text style={styles.chartLabel}>−2t</Text>
        <Text style={styles.chartLabel}>+4t</Text>
        <Text style={styles.chartLabel}>+9t</Text>
      </View>
    </View>
  );
}

function Dashboard() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 760;
  const area = "DK1" as const;
  const [prices, setPrices] = useState<PricePoint[]>(() => createSamplePrices("DK1"));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isSample, setIsSample] = useState(false);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      setPrices(await fetchPrices("DK1", "n1_c"));
      setIsSample(false);
    } catch {
      setPrices(createSamplePrices("DK1"));
      setIsSample(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const now = Date.now();
  const current = [...prices].reverse().find((point) => point.startsAt.getTime() <= now) ?? prices[0];
  const future = prices.filter((point) => point.startsAt.getTime() >= now).slice(0, 49);
  const displayPoints = future.length > 1 ? future : prices.slice(0, 49);
  const pointPrice = (point: PricePoint) => point.totalOrePerKwh;
  const oreValues = displayPoints.map(pointPrice);
  const currentOre = current ? pointPrice(current) : 0;
  const tone = getPriceTone(currentOre, oreValues);
  const cheapest = displayPoints.reduce<PricePoint | undefined>((best, point) =>
    !best || pointPrice(point) < pointPrice(best) ? point : best, undefined);

  const days = useMemo(() => {
    const grouped = new Map<string, PricePoint[]>();
    prices.forEach((point) => {
      const key = dayKey(point.startsAt);
      grouped.set(key, [...(grouped.get(key) ?? []), point]);
    });
    return [...grouped.values()].filter((group) => group.some((point) => point.startsAt.getTime() >= now - 900000)).slice(0, 3);
  }, [prices, now]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.green} />}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <View>
              <Text style={styles.brand}>STRØMBLIK</Text>
              <Text style={styles.date}>{dkDay.format(new Date())}</Text>
            </View>
            <Pressable accessibilityLabel="Opdater priser" onPress={() => void load(true)} style={styles.iconButton}>
              <Feather name="refresh-cw" size={19} color={colors.ink} />
            </Pressable>
          </View>

          {isSample ? (
            <View style={styles.notice}>
              <Feather name="wifi-off" size={16} color="#8A492F" />
              <Text style={styles.noticeText}>Offlinevisning: eksempelpriser vises</Text>
            </View>
          ) : null}

          <View style={[styles.topGrid, isTablet && styles.topGridTablet]}>
            <LinearGradient colors={["#DCE9DC", "#EEF1DB"]} style={[styles.hero, isTablet && styles.halfPanel]}>
              <View style={styles.heroTopline}>
                <Text style={styles.eyebrow}>LIGE NU · N1 · {area}</Text>
                {loading ? <ActivityIndicator color={colors.green} size="small" /> : null}
              </View>
              <View style={styles.priceLine}>
                <Text adjustsFontSizeToFit numberOfLines={1} style={styles.price}>{formatPrice(currentOre / 100, 2)}</Text>
                <View style={styles.unitWrap}>
                  <Text style={styles.unit}>kr</Text>
                  <Text style={styles.unitSmall}>pr. kWh</Text>
                </View>
              </View>
              <View style={[styles.statusPill, { backgroundColor: tone.soft }]}>
                <View style={[styles.statusDot, { backgroundColor: tone.color }]} />
                <Text style={[styles.statusText, { color: tone.color }]}>{tone.label}</Text>
              </View>
              <Text style={styles.vatNote}>Inkl. moms, elafgift og transport</Text>
            </LinearGradient>

            <View style={[styles.trendPanel, isTablet && styles.halfPanel]}>
              <View style={styles.sectionHeadingRow}>
                <View>
                  <Text style={styles.eyebrow}>12 TIMER · NU I FOKUS</Text>
                  <Text style={styles.sectionTitle}>Prisens bevægelse</Text>
                </View>
                <Feather name="trending-up" size={22} color={colors.coral} />
              </View>
              <PriceChart points={prices} />
            </View>
          </View>

          <View style={styles.insightBand}>
            <View style={styles.insightIcon}><Feather name="zap" size={20} color={colors.white} /></View>
            <View style={styles.insightCopy}>
              <Text style={styles.insightLabel}>BEDSTE TIDSPUNKT</Text>
              <Text style={styles.insightTitle}>
                {cheapest ? `${dkTime.format(cheapest.startsAt)} · ${formatPrice(pointPrice(cheapest) / 100, 2)} kr/kWh` : "Afventer priser"}
              </Text>
            </View>
            <Feather name="arrow-down-right" size={24} color={colors.yellow} />
          </View>

          <View style={styles.sectionHeadingRow}>
            <View>
              <Text style={styles.eyebrow}>KVARTER FOR KVARTER</Text>
              <Text style={styles.sectionTitle}>Kommende priser</Text>
            </View>
            <Text style={styles.smallMeta}>inkl. moms</Text>
          </View>
          <View style={[styles.hourGrid, isTablet && styles.hourGridTablet]}>
            {displayPoints.slice(0, isTablet ? 8 : 6).map((point, index) => {
              const value = pointPrice(point);
              const itemTone = getPriceTone(value, oreValues);
              return (
                <View key={point.startsAt.toISOString()} style={[styles.hourRow, isTablet && styles.hourRowTablet, index === 0 && styles.hourRowCurrent]}>
                  <View style={styles.hourTimeWrap}>
                    <Text style={styles.hourTime}>{dkTime.format(point.startsAt)}</Text>
                    <Text style={styles.hourRelative}>{index === 0 ? "Næste interval" : `+${index * 15} min`}</Text>
                  </View>
                  <View style={styles.hourPriceWrap}>
                    <Text style={styles.hourPrice}>{formatPrice(value / 100, 2)}</Text>
                    <Text style={styles.hourUnit}>kr</Text>
                  </View>
                  <View style={[styles.miniDot, { backgroundColor: itemTone.color }]} />
                </View>
              );
            })}
          </View>

          <View style={[styles.sectionHeadingRow, styles.daysHeading]}>
            <View>
              <Text style={styles.eyebrow}>DAGSPRISER</Text>
              <Text style={styles.sectionTitle}>I dag og frem</Text>
            </View>
            <Feather name="calendar" size={21} color={colors.ink} />
          </View>
          <View style={[styles.dayGrid, isTablet && styles.dayGridTablet]}>
            {days.map((group) => {
              const values = group.map(pointPrice);
              const average = values.reduce((sum, value) => sum + value, 0) / values.length;
              return (
                <View key={dayKey(group[0]!.startsAt)} style={styles.dayItem}>
                  <Text style={styles.dayName}>{dkDay.format(group[0]!.startsAt)}</Text>
                  <Text style={styles.dayPrice}>{formatPrice(average / 100, 2)} <Text style={styles.dayUnit}>kr</Text></Text>
                  <View style={styles.rangeLine}>
                    <Text style={styles.rangeText}>Lav {formatPrice(Math.min(...values) / 100, 2)}</Text>
                    <Text style={styles.rangeText}>Høj {formatPrice(Math.max(...values) / 100, 2)}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={styles.disclosure}>
            <Feather name="info" size={17} color={colors.muted} />
            <Text style={styles.disclosureText}>
              Samlet pris inkluderer spotpris, moms, elafgift samt lokale og nationale tariffer. Elselskabets og netselskabets abonnementer er ikke medregnet. Data: Strømligning og Nord Pool.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function App() {
  const [dmLoaded] = useDMSans({ DMSans_400Regular, DMSans_500Medium, DMSans_700Bold });
  const [frauncesLoaded] = useFraunces({ Fraunces_600SemiBold });

  if (!dmLoaded || !frauncesLoaded) {
    return <View style={styles.loadingScreen}><ActivityIndicator color={colors.green} /></View>;
  }

  return <SafeAreaProvider><Dashboard /></SafeAreaProvider>;
}

const styles = StyleSheet.create({
  loadingScreen: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.paper },
  safeArea: { flex: 1, backgroundColor: colors.paper },
  scrollContent: { paddingBottom: 44 },
  container: { width: "100%", maxWidth: 1120, alignSelf: "center", paddingHorizontal: 20 },
  header: { minHeight: 96, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { fontFamily: "DMSans_700Bold", fontSize: 18, color: colors.ink, letterSpacing: 0 },
  date: { fontFamily: "DMSans_400Regular", fontSize: 13, color: colors.muted, marginTop: 3, textTransform: "capitalize" },
  iconButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center", backgroundColor: colors.white },
  notice: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: "#F8E1D8", borderRadius: 6, marginBottom: 16 },
  noticeText: { fontFamily: "DMSans_500Medium", fontSize: 13, color: "#8A492F" },
  topGrid: { gap: 14 },
  topGridTablet: { flexDirection: "row" },
  halfPanel: { flex: 1 },
  hero: { minHeight: 315, borderRadius: 8, padding: 24, justifyContent: "space-between", overflow: "hidden" },
  heroTopline: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  eyebrow: { fontFamily: "DMSans_700Bold", fontSize: 11, color: colors.muted, letterSpacing: 0 },
  priceLine: { flexDirection: "row", alignItems: "flex-end", gap: 10, marginVertical: 12 },
  price: { fontFamily: "Fraunces_600SemiBold", fontSize: 94, lineHeight: 102, color: colors.ink, maxWidth: "74%" },
  unitWrap: { paddingBottom: 14 },
  unit: { fontFamily: "DMSans_700Bold", color: colors.ink, fontSize: 22 },
  unitSmall: { fontFamily: "DMSans_400Regular", color: colors.muted, fontSize: 12 },
  statusPill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 18, paddingVertical: 7, paddingHorizontal: 11 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontFamily: "DMSans_700Bold", fontSize: 12 },
  vatNote: { fontFamily: "DMSans_400Regular", fontSize: 12, color: colors.muted, marginTop: 9 },
  trendPanel: { minHeight: 315, backgroundColor: colors.white, borderRadius: 8, padding: 22, borderWidth: 1, borderColor: "#E8E6DC" },
  sectionHeadingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontFamily: "Fraunces_600SemiBold", fontSize: 24, color: colors.ink, marginTop: 4 },
  chartWrap: { flex: 1, justifyContent: "flex-end", marginTop: 8 },
  chartSelection: { minHeight: 58, justifyContent: "flex-end" },
  chartSelectionTime: { fontFamily: "DMSans_700Bold", color: colors.ink, fontSize: 13 },
  chartSelectionValue: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  chartSelectionPrice: { fontFamily: "Fraunces_600SemiBold", color: colors.ink, fontSize: 38, lineHeight: 43 },
  chartSelectionUnit: { fontFamily: "DMSans_500Medium", color: colors.muted, fontSize: 13 },
  barChart: { height: 150, flexDirection: "row", alignItems: "flex-end", gap: 4, paddingTop: 15, paddingBottom: 25 },
  barSlot: { flex: 1, height: "100%", justifyContent: "flex-end", alignItems: "center", position: "relative" },
  bar: { width: "100%", maxWidth: 42, minHeight: 30, borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  currentBar: { borderWidth: 2, borderColor: colors.ink },
  currentMarker: { position: "absolute", backgroundColor: colors.ink, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 2, zIndex: 2 },
  currentMarkerText: { fontFamily: "DMSans_700Bold", fontSize: 8, color: colors.white },
  barSelector: { position: "absolute", bottom: -20, width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: colors.white, shadowColor: colors.ink, shadowOpacity: 0.2, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  barSelectorInner: { width: 19, height: 19, borderRadius: 10, backgroundColor: colors.ink },
  chartLabels: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 7 },
  chartLabel: { fontFamily: "DMSans_400Regular", color: colors.muted, fontSize: 10 },
  insightBand: { backgroundColor: colors.navy, minHeight: 92, marginVertical: 20, borderRadius: 8, padding: 18, flexDirection: "row", alignItems: "center", gap: 14 },
  insightIcon: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: colors.green },
  insightCopy: { flex: 1 },
  insightLabel: { fontFamily: "DMSans_700Bold", color: "#9FB7B8", fontSize: 10 },
  insightTitle: { fontFamily: "DMSans_700Bold", color: colors.white, fontSize: 17, marginTop: 4 },
  smallMeta: { fontFamily: "DMSans_400Regular", fontSize: 12, color: colors.muted },
  hourGrid: { marginTop: 12, borderTopWidth: 1, borderTopColor: colors.line },
  hourGridTablet: { flexDirection: "row", flexWrap: "wrap" },
  hourRow: { minHeight: 68, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: colors.line, paddingHorizontal: 8 },
  hourRowTablet: { flexBasis: "50%", flexGrow: 0, flexShrink: 0 },
  hourRowCurrent: { backgroundColor: "#ECEFE5" },
  hourTimeWrap: { flex: 1 },
  hourTime: { fontFamily: "DMSans_700Bold", fontSize: 16, color: colors.ink },
  hourRelative: { fontFamily: "DMSans_400Regular", fontSize: 10, color: colors.muted, marginTop: 2 },
  hourPriceWrap: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  hourPrice: { fontFamily: "Fraunces_600SemiBold", fontSize: 25, color: colors.ink },
  hourUnit: { fontFamily: "DMSans_400Regular", fontSize: 11, color: colors.muted },
  miniDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 14 },
  daysHeading: { marginTop: 34 },
  dayGrid: { marginTop: 13, gap: 10 },
  dayGridTablet: { flexDirection: "row" },
  dayItem: { flex: 1, minHeight: 132, paddingVertical: 18, borderTopWidth: 3, borderTopColor: colors.coral, borderBottomWidth: 1, borderBottomColor: colors.line },
  dayName: { fontFamily: "DMSans_700Bold", fontSize: 13, color: colors.muted, textTransform: "capitalize" },
  dayPrice: { fontFamily: "Fraunces_600SemiBold", fontSize: 31, color: colors.ink, marginTop: 10 },
  dayUnit: { fontFamily: "DMSans_400Regular", fontSize: 12, color: colors.muted },
  rangeLine: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  rangeText: { fontFamily: "DMSans_400Regular", fontSize: 11, color: colors.muted },
  disclosure: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 28, paddingTop: 18, borderTopWidth: 1, borderTopColor: colors.line },
  disclosureText: { flex: 1, fontFamily: "DMSans_400Regular", fontSize: 12, lineHeight: 18, color: colors.muted },
});