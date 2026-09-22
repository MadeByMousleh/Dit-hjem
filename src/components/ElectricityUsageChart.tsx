import { Feather } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useElectricityUsage } from "../hooks/useElectricityUsage";
import { UsageAggregation } from "../services/eloverblik";
import { colors } from "../styles/theme";
import { moveUsagePeriod, usageToday } from "../utils/usagePeriods";
import { UsageDatePicker } from './UsageDatePicker';

const modes: [UsageAggregation, string][] = [["Year", "År"], ["Month", "Måned"], ["Day", "Dag"], ["Hour", "Time"]];
const number = (value: number) => new Intl.NumberFormat("da-DK", { maximumFractionDigits: 3 }).format(value);
export function ElectricityUsageChart({ usage, aggregation, anchor, loading, load, availableYears, agreements }: ReturnType<typeof useElectricityUsage>) {
  const [selectedAt, setSelectedAt] = useState("");
  const [picker, setPicker] = useState(false);
  const currentYear = Number(usageToday().slice(0,4));
  const years = availableYears.length ? availableYears : Array.from({length:6},(_,i)=>currentYear-5+i);
  const points = usage?.points ?? [];
  const selected = points.find((p) => p.at === selectedAt);
  const dateKey = (at: string) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Copenhagen', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(at));
  const rangeFrom = selected ? dateKey(selected.at) : usage?.from ?? anchor;
  const end = new Date(rangeFrom + 'T12:00:00Z');
  if (aggregation === 'Year') end.setUTCFullYear(end.getUTCFullYear() + 1);
  else if (aggregation === 'Month') end.setUTCMonth(end.getUTCMonth() + 1);
  else end.setUTCDate(end.getUTCDate() + 1);
  const rangeTo = selected ? end.toISOString().slice(0, 10) : usage?.to ?? rangeFrom;
  const relevantAgreements = agreements.records.filter(record => record.date_from < rangeTo && (!record.date_to || record.date_to > rangeFrom));
  const max = Math.max(1, ...points.map((p) => p.kwh ?? 0));
  const label = (at: string, short = false) => new Intl.DateTimeFormat("da-DK", {
    timeZone: "Europe/Copenhagen",
    ...(aggregation === "Year" ? { year: "numeric" } : aggregation === "Month" ? { month: short ? "short" : "long" } : aggregation === "Day" ? { day: "numeric", ...(short ? {} : { month: "long" }) } : { hour: "2-digit", minute: "2-digit", ...(short ? {} : { timeZoneName: "short" }) }),
  }).format(new Date(at));
  const title = new Intl.DateTimeFormat("da-DK", { year: "numeric", ...(aggregation === "Day" || aggregation === "Hour" ? { month: "long" } : {}), ...(aggregation === "Hour" ? { day: "numeric" } : {}) }).format(new Date(anchor + "T12:00:00Z"));
  const next = moveUsagePeriod(aggregation, anchor, 1);
  const previous = moveUsagePeriod(aggregation, anchor, -1);
  const earliest = `${Math.min(...years)}-01-01`;
  return <View>
    <View style={s.tabs}>{modes.map(([mode, name]) => <Pressable key={mode} accessibilityRole="button" accessibilityState={{ selected: aggregation === mode }} onPress={() => { setSelectedAt(""); void load(mode, anchor); }} style={[s.tab, aggregation === mode && s.active]}><Text style={[s.text, aggregation === mode && s.activeText]}>{name}</Text></Pressable>)}</View>
    {aggregation === 'Year' ? <Text style={[s.title, {marginVertical:16}]}>{Math.min(...years)}–{Math.max(...years)}</Text> : <View style={s.nav}>
      <Pressable accessibilityLabel="Forrige periode" disabled={previous < earliest} onPress={() => void load(aggregation, previous)} style={[s.arrow, previous < earliest && s.disabled]}><Feather name="chevron-left" size={22} color={colors.ink} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Vælg periode" onPress={() => setPicker(true)}><Text style={s.title}>{title} <Feather name="calendar" size={16} /></Text></Pressable>
      <Pressable accessibilityLabel="Næste periode" disabled={next > usageToday()} onPress={() => void load(aggregation, next)} style={[s.arrow, next > usageToday() && s.disabled]}><Feather name="chevron-right" size={22} color={colors.ink} /></Pressable>
    </View>}
    {picker ? <UsageDatePicker aggregation={aggregation} anchor={anchor} years={years} onClose={() => setPicker(false)} onSelect={date => { setPicker(false); setSelectedAt(''); void load(aggregation, date); }} /> : null}
    {loading ? <View style={s.empty}><ActivityIndicator color={colors.primary} /><Text style={s.note}>Henter forbrug…</Text></View> : usage ? <>
      {usage.syncFailed ? <Text style={s.note}>Eloverblik kunne ikke opdateres. Gemte målinger vises; prøv igen senere.</Text> : null}
      <Text style={s.note}>{selected ? label(selected.at) : "Samlet registreret forbrug i perioden"}</Text>
      <Text style={s.value}>{selected?.kwh === null ? "Mangler data" : `${number(selected ? selected.kwh! : usage.totalKwh)} kWh`}</Text>
      {agreements.error ? <Text style={s.note}>{agreements.error}</Text> : agreements.loading ? <Text style={s.note}>Henter elaftaler…</Text> : <>
        {relevantAgreements.map(record => <View key={record.id} style={{ marginVertical: 6, padding: 12, backgroundColor: colors.paper, borderRadius: 12 }}>
          <Text style={[s.note, { fontFamily: 'DMSans_700Bold', color: colors.ink }]}>{record.date_to ? 'Tidligere leverandør' : 'Nuværende leverandør'} · {record.supplier_name}</Text>
          <Text style={s.note}>{record.price_type === 'fixed' ? `Fast pris ${number(Number(record.fixed_ore) + Number(record.markup_ore))} øre/kWh` : `Spotpris + ${number(record.markup_ore)} øre/kWh`} · {number(record.subscription_dkk)} kr./md.</Text>
          <Text style={s.note}>Fra {record.date_from}{record.date_to ? ` til ${new Date(Date.parse(record.date_to + 'T12:00:00Z') - 86400000).toISOString().slice(0, 10)}` : ''}</Text>
        </View>)}
        {(!agreements.records.length || rangeFrom < agreements.records[0]!.date_from) ? <Text style={s.note}>Ingen gemt elaftale for hele perioden. Historisk gennemsnitspris er endnu ikke tilgængelig.</Text> : null}
        {relevantAgreements.length ? <Text style={s.note}>Aftalepriser inkl. moms, uden nettariffer og afgifter. Grafen viser forbrug i kWh; samlet pris er endnu ikke beregnet.</Text> : null}
      </>}
      {usage.incomplete || selected?.incomplete ? <Text style={s.note}>Nogle målinger mangler. Summen kan være ufuldstændig.</Text> : null}
      {points.length ? <>
        <Text style={s.note}>kWh · skala 0–{number(max)}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={s.chart}>
          {points.map((point) => <Pressable key={point.at} accessibilityRole="button" accessibilityLabel={`${label(point.at)}, ${point.kwh === null ? "mangler data" : number(point.kwh) + " kWh"}`} onPress={() => setSelectedAt(point.at)} style={s.slot}>
            <View style={s.barArea}><View style={{ width: 24, height: point.kwh === null ? 3 : Math.max(point.kwh > 0 ? 2 : 0, point.kwh / max * 130), borderRadius: 5, backgroundColor: point.at === selectedAt ? colors.primary : point.kwh === null ? colors.line : "#B9D9BE" }} /></View>
            <Text style={s.tick}>{point.kwh === null ? "–" : label(point.at, true)}</Text>
          </Pressable>)}
        </ScrollView>
        <Pressable onPress={() => setSelectedAt("")}><Text style={s.note}>Tryk på en søjle for detaljer · tryk her for total</Text></Pressable>
      </> : <Text style={s.empty}>Ingen målinger i denne periode. Prøv en tidligere periode.</Text>}
      <Text style={s.note}>Målerdata kan være forsinket. {usage.meterCount} målepunkt{usage.meterCount === 1 ? "" : "er"}.</Text>
    </> : null}
  </View>;
}
const s = StyleSheet.create({
  tabs: { flexDirection: "row", padding: 4, backgroundColor: colors.paper, borderRadius: 14, marginTop: 18 }, tab: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 11 }, active: { backgroundColor: colors.primary }, text: { color: colors.ink, fontFamily: "DMSans_700Bold" }, activeText: { color: colors.white }, nav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginVertical: 16 }, arrow: { padding: 10 }, disabled: { opacity: 0.25 }, title: { color: colors.ink, fontFamily: "DMSans_700Bold", fontSize: 16 }, value: { fontFamily: "Fraunces_600SemiBold", fontSize: 30, color: colors.ink, marginVertical: 6 }, note: { fontFamily: "DMSans_400Regular", fontSize: 12, color: colors.muted, marginVertical: 5 }, chart: { flexGrow: 1, alignItems: "flex-end", paddingVertical: 12 }, slot: { minWidth: 43, flex: 1, alignItems: "center" }, barArea: { height: 140, justifyContent: "flex-end" }, tick: { fontSize: 10, color: colors.muted, marginTop: 8 }, empty: { paddingVertical: 45, alignItems: "center", color: colors.muted },
});
