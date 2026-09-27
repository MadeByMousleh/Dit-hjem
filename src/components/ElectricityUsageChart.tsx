import { Feather } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useElectricityUsage } from '../hooks/useElectricityUsage';
import { fetchHistoricalPrices, type GridSupplier, type PricePoint } from '../prices';
import { UsageAggregation } from '../services/eloverblik';
import { colors } from '../styles/theme';
import { estimateEnergyCost } from '../utils/energyCost';
import { estimateUsageTotals } from '../utils/usageTotalCost';
import { advance, danishDate, midnight } from '../services/consumption-data.mjs';
import { moveUsagePeriod, usageToday } from '../utils/usagePeriods';
import { UsageDatePicker } from './UsageDatePicker';
import { useBarScrub } from '../hooks/useBarScrub';
import { tickSelection } from '../utils/barScrub';

const modes: [UsageAggregation, string][] = [['Year', 'År'], ['Month', 'Måned'], ['Day', 'Dag'], ['Hour', 'Timer']];
const number = (value: number, digits = 3) => new Intl.NumberFormat('da-DK', { maximumFractionDigits: digits }).format(value);
const kroner = (ore: number) => new Intl.NumberFormat('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 2 }).format(ore / 100);

type Props = ReturnType<typeof useElectricityUsage> & { prices: PricePoint[]; gridSupplierName: string; gridSupplier: GridSupplier };
export function ElectricityUsageChart({ usage, aggregation, anchor, loading, load, availableYears, agreements, prices, gridSupplier }: Props) {
  const [selectedAt, setSelectedAt] = useState('');
  const [picker, setPicker] = useState(false);
  const [chartWidth, setChartWidth] = useState(0);
  const [overview, setOverview] = useState(true);
  const [historical, setHistorical] = useState<PricePoint[]>([]);
  const [priceLoading, setPriceLoading] = useState(false);
  const today = usageToday();
  const yesterday = new Date(Date.parse(`${today}T12:00:00Z`) - 86400000).toISOString().slice(0, 10);
  const safeAnchor = anchor > yesterday ? yesterday : anchor;
  const periodAnchor = aggregation === 'Hour' ? safeAnchor : anchor;
  const from = usage?.from;
  const to = usage?.to && usage.to < today ? usage.to : today;
  const priceFrom = aggregation === 'Month' && selectedAt ? danishDate(new Date(selectedAt)).slice(0, 7) + '-01' : from;
  const monthEnd = priceFrom ? advance(priceFrom, 'month') : to;
  const priceTo = aggregation === 'Month' && selectedAt && monthEnd < to ? monthEnd : to;
  useEffect(() => {
    setHistorical([]);
    if (!priceFrom || priceFrom >= priceTo || aggregation === 'Year') { setPriceLoading(false); return; }
    let active = true;
    setPriceLoading(true);
    void (async () => {
      let accumulated: PricePoint[] = [];
      // Reuse the same monthly public-price cache as the summary card.
      for (let start = priceFrom; start < priceTo && active;) {
        const nextMonth = advance(start.slice(0, 7) + '-01', 'month');
        const end = nextMonth < priceTo ? nextMonth : priceTo;
        try {
          const result = await fetchHistoricalPrices(gridSupplier.area, gridSupplier.id, midnight(start), midnight(end));
          accumulated = accumulated.concat(result);
          if (active) setHistorical(accumulated);
        } catch { /* One unavailable month must not prevent pricing the others. */ }
        start = end;
      }
    })()
      .catch(() => { /* Keep any matching public prices already loaded. */ })
      .finally(() => { if (active) setPriceLoading(false); });
    return () => { active = false; };
  }, [priceFrom, priceTo, aggregation, gridSupplier.area, gridSupplier.id]);
  const currentYear = Number(usageToday().slice(0, 4));
  const years = availableYears.length ? availableYears : Array.from({ length: 6 }, (_, index) => currentYear - 5 + index);
  const points = useMemo(() => (usage?.points ?? []).filter(point => point.at < midnight(today)), [usage, today]);
  const selected = points.find(point => point.at === selectedAt);
  const selectedIndex = points.findIndex(point => point.at === selectedAt);
  const selectedIndexRef = useRef(selectedIndex);
  selectedIndexRef.current = selectedIndex;
  const visiblePoints = selected ? [selected] : points;
  const cost = useMemo(() => estimateEnergyCost(visiblePoints, aggregation, agreements.records, prices), [visiblePoints, aggregation, agreements.records, prices]);
  const dailyCosts = useMemo(() => estimateUsageTotals(points, aggregation, agreements.records, historical.length ? historical : prices), [points, aggregation, agreements.records, historical, prices]);
  const detailed = aggregation !== 'Year';
  const totalCost = selected ? dailyCosts.get(selected.at) : points.length && points.every(point => dailyCosts.has(point.at)) ? points.reduce((sum, point) => sum + dailyCosts.get(point.at)!, 0) : undefined;
  const slotWidth = overview && chartWidth ? Math.max(7, (chartWidth - 16) / Math.max(1, points.length)) : 21;
  const chartScrollRef = useRef<ScrollView>(null);
  const selectBar = (index: number, initial = false) => {
    const point = points[index];
    if (!point || (!initial && selectedIndexRef.current === index)) return;
    selectedIndexRef.current = index;
    setSelectedAt(point.at);
    tickSelection();
  };
  const barScrub = useBarScrub({ count: points.length, stride: slotWidth, inset: 8, viewportWidth: chartWidth,
    contentWidth: points.length * slotWidth + 16, scrollRef: chartScrollRef, onSelect: selectBar });
  const max = Math.max(1, ...points.map(point => point.kwh ?? 0));
  const earliest = `${Math.min(...years)}-01-01`;
  const previous = moveUsagePeriod(aggregation, periodAnchor, -1);
  const next = moveUsagePeriod(aggregation, periodAnchor, 1);
  const labelFormatters = useMemo(() => [false, true].map(short => new Intl.DateTimeFormat('da-DK', {
    timeZone: 'Europe/Copenhagen',
    ...(aggregation === 'Year' ? { year: 'numeric' } : aggregation === 'Month' ? { month: short ? 'short' : 'long' } : aggregation === 'Day' ? { day: 'numeric', ...(short ? {} : { month: 'long' }) } : { hour: '2-digit', ...(short ? {} : { minute: '2-digit' }) }),
  })), [aggregation]);
  const label = (at: string, short = false) => labelFormatters[short ? 1 : 0]!.format(new Date(at));
  const title = new Intl.DateTimeFormat('da-DK', {
    year: 'numeric',
    ...(aggregation === 'Day' || aggregation === 'Hour' ? { month: 'long' } : {}),
    ...(aggregation === 'Hour' ? { day: 'numeric' } : {}),
  }).format(new Date(periodAnchor + 'T12:00:00Z'));
  useEffect(() => { setSelectedAt(''); }, [from, usage?.to, aggregation]);

  return <View>
    <Text style={s.sectionLabel}>VÆLG VISNING</Text>
    <View style={s.tabs}>{modes.map(([mode, name]) => <Pressable key={mode} accessibilityRole="button" accessibilityState={{ selected: aggregation === mode }} onPress={() => { setSelectedAt(''); void load(mode, safeAnchor); }} style={[s.tab, aggregation === mode && s.activeTab]}><Text style={[s.tabText, aggregation === mode && s.activeTabText]}>{name}</Text></Pressable>)}</View>

    <View style={s.periodRow}>
      <Pressable accessibilityLabel="Forrige periode" disabled={previous < earliest} onPress={() => void load(aggregation, previous)} style={[s.arrow, previous < earliest && s.disabled]}><Feather name="chevron-left" size={21} color={colors.ink} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Vælg periode" onPress={() => setPicker(true)} style={s.periodButton}><Text style={s.periodText}>{title}</Text><Feather name="calendar" size={16} color={colors.primary} /></Pressable>
      <Pressable accessibilityLabel="Næste periode" disabled={next > yesterday} onPress={() => void load(aggregation, next)} style={[s.arrow, next > yesterday && s.disabled]}><Feather name="chevron-right" size={21} color={colors.ink} /></Pressable>
    </View>
    {picker ? <UsageDatePicker aggregation={aggregation} anchor={safeAnchor} maxDate={yesterday} years={years} onClose={() => setPicker(false)} onSelect={date => { setPicker(false); setSelectedAt(''); void load(aggregation, date); }} /> : null}

    {loading && !usage ? <View style={s.empty}><ActivityIndicator color={colors.primary} /><Text style={s.note}>Henter forbrug…</Text></View> : usage ? <>
      {loading ? <ActivityIndicator color={colors.primary} size="small" style={{ alignSelf: 'flex-start' }} /> : null}
      {usage.syncFailed ? <Text style={s.warning}>Eloverblik kunne ikke opdateres. Gemte målinger vises.</Text> : null}
      <View style={s.summary}>
        <View style={{ flex: 1 }}><Text style={s.summaryLabel}>{selected ? label(selected.at) : 'Forbrug i perioden'}{(selected ? selected.incomplete : points.some(point => point.incomplete)) ? ' · foreløbigt' : ''}</Text><Text style={s.value}>{selected?.kwh === null ? 'Mangler data' : `${number(selected ? selected.kwh! : points.reduce((sum, point) => sum + (point.kwh ?? 0), 0))} kWh`}</Text></View>
        {selected ? <Pressable accessibilityRole="button" onPress={() => setSelectedAt('')} style={s.detailButton}><Text style={s.detailButtonText}>Vis total</Text></Pressable> : null}
      </View>

      {detailed ? totalCost !== undefined ? <View style={s.costCard}>
        <View style={s.costHeading}><Text style={s.costTitle}>Estimeret pris</Text><Text style={s.costValue}>{kroner(totalCost)}</Text></View>
      </View> : selected ? <Text style={s.note}>{priceLoading ? 'Beregner pris…' : !agreements.records.length ? 'Tilføj din elaftale for at se prisen.' : 'Prisen kan ikke beregnes endnu. Prøv igen senere.'}</Text> : null : cost.hasEstimate ? <View style={s.costCard}>
        <View style={s.costHeading}><Text style={s.costTitle}>Estimeret elhandel</Text><Text style={s.costValue}>{kroner(cost.ore)}</Text></View>
        <Text style={s.costNote}>{cost.supplierName} · uden abonnement, nettariffer og afgifter{cost.partial ? ' · delvist estimat' : ''}</Text>
      </View> : null}

      {points.length ? <>
        <View style={s.chartHeader}><Text style={s.chartTitle}>Forbrug</Text><Text style={s.note}>0–{number(max)} kWh</Text></View>
        <View ref={barScrub.viewportRef} collapsable={false} {...barScrub.panHandlers} onTouchEnd={barScrub.end}
          onTouchCancel={barScrub.end} onLayout={event => setChartWidth(event.nativeEvent.layout.width)}>
        <ScrollView ref={chartScrollRef} horizontal scrollEnabled={!barScrub.isScrubbing} showsHorizontalScrollIndicator={false}
          onScroll={event => barScrub.setScrollX(event.nativeEvent.contentOffset.x)} scrollEventThrottle={16} contentContainerStyle={s.chart}>
          {points.map((point, index) => {
            const selectedPoint = point.at === selectedAt;
            const labelEvery = Math.max(1, Math.ceil(38 / slotWidth));
            const showLabel = selectedPoint || (index % labelEvery === 0 && (selectedIndex < 0 || Math.abs(index - selectedIndex) >= labelEvery));
            return <Pressable key={point.at} accessibilityRole="button" accessibilityState={{ selected: selectedPoint }} accessibilityLabel={`${label(point.at)}, ${point.kwh === null ? 'mangler data' : `${number(point.kwh)} kWh`}`}
              accessibilityHint="Hold og træk for at vælge andre søjler"
              delayLongPress={300} onLongPress={event => barScrub.begin(index, event.nativeEvent.pageX)}
              onPress={() => { if (!barScrub.shouldIgnorePress()) selectBar(index); }} style={[s.slot, { width: slotWidth }]}>
              <View style={s.barArea}><View style={[s.bar, { width: slotWidth - 2, height: point.kwh === null ? 3 : Math.max(point.kwh > 0 ? 4 : 0, point.kwh / max * 136), backgroundColor: selectedPoint ? colors.primary : point.kwh === null ? colors.line : '#B9D9BE' }]} /></View>
              <Text numberOfLines={1} style={[s.tick, selectedPoint && s.selectedTick]}>{showLabel ? label(point.at, true) : ''}</Text>
            </Pressable>;
          })}
        </ScrollView>
        </View>
        <Pressable accessibilityRole="button" onPress={() => setOverview(value => !value)} style={[s.detailButton, { alignSelf: 'flex-end', marginTop: 10 }]}><Text style={s.detailButtonText}>{overview ? 'Større søjler' : 'Vis hele perioden'}</Text></Pressable>
      </> : <Text style={s.empty}>Ingen målinger i denne periode. Prøv en tidligere periode.</Text>}
    </> : null}
  </View>;
}

const s = StyleSheet.create({
  sectionLabel: { fontFamily: 'DMSans_700Bold', fontSize: 10, letterSpacing: 0.7, color: colors.muted, marginTop: 18, marginBottom: 7 },
  tabs: { flexDirection: 'row', padding: 4, backgroundColor: colors.paper, borderRadius: 16 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 42, borderRadius: 12 },
  activeTab: { backgroundColor: colors.primary }, tabText: { color: colors.ink, fontFamily: 'DMSans_700Bold', fontSize: 12 }, activeTabText: { color: colors.white },
  periodRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 14 }, arrow: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' }, disabled: { opacity: 0.3 },
  periodButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 12, minHeight: 42 }, periodText: { color: colors.ink, fontFamily: 'DMSans_700Bold', fontSize: 15, textTransform: 'capitalize' },
  summary: { flexDirection: 'row', alignItems: 'flex-end', borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 14 }, summaryLabel: { fontFamily: 'DMSans_500Medium', fontSize: 12, color: colors.muted }, value: { fontFamily: 'Fraunces_600SemiBold', fontSize: 32, color: colors.ink, marginTop: 3 },
  detailButton: { backgroundColor: colors.primarySoft, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, marginBottom: 4 }, detailButtonText: { color: colors.primary, fontFamily: 'DMSans_700Bold', fontSize: 11 },
  costCard: { marginTop: 12, padding: 13, borderRadius: 14, backgroundColor: '#F1F7F1' }, costHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }, costTitle: { fontFamily: 'DMSans_700Bold', color: colors.ink, fontSize: 13 }, costValue: { fontFamily: 'Fraunces_600SemiBold', color: colors.ink, fontSize: 21 }, costNote: { fontFamily: 'DMSans_400Regular', color: colors.muted, lineHeight: 17, fontSize: 11, marginTop: 4 },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 19 }, chartTitle: { fontFamily: 'DMSans_700Bold', color: colors.ink, fontSize: 13 },
  chart: { alignItems: 'flex-end', paddingTop: 10, paddingBottom: 2, paddingHorizontal: 8 }, slot: { alignItems: 'center' }, barArea: { height: 142, justifyContent: 'flex-end', alignItems: 'center' }, bar: { borderRadius: 5 }, tick: { width: 38, textAlign: 'center', fontSize: 9, color: colors.muted, marginTop: 7 }, selectedTick: { color: colors.primary, fontFamily: 'DMSans_700Bold' },
  note: { fontFamily: 'DMSans_400Regular', fontSize: 11, lineHeight: 17, color: colors.muted }, warning: { fontFamily: 'DMSans_500Medium', fontSize: 11, lineHeight: 17, color: colors.coral, marginTop: 10 }, footer: { fontFamily: 'DMSans_400Regular', fontSize: 10, lineHeight: 15, color: colors.muted, marginTop: 14 },
  empty: { minHeight: 130, justifyContent: 'center', alignItems: 'center', color: colors.muted, fontFamily: 'DMSans_400Regular', fontSize: 12 },
});
