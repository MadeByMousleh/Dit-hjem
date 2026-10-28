import {AppText as Text} from './AppText';
import {LoadingState} from './LoadingState';
import {cardStyles} from '../styles/cards';
import {AnimatedMetric} from './Motion';
import { AppIcon } from './AppIcon';
import {InteractiveEnergyChart} from './InteractiveEnergyChart';
import {HapticPressable as Pressable} from './HapticPressable';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useElectricityUsage } from '../hooks/useElectricityUsage';
import { fetchHistoricalPrices, type GridSupplier, type PricePoint } from '../prices';
import { UsageAggregation } from '../services/eloverblik';
import { colors } from '../styles/theme';
import { estimateUsageTotals } from '../utils/usageTotalCost';
import { advance, danishDate, midnight } from '../services/consumption-data.mjs';
import { moveUsagePeriod, usageToday } from '../utils/usagePeriods';
import { UsageDatePicker } from './UsageDatePicker';
import { tickSelection } from '../utils/barScrub';

const modes: [UsageAggregation, string][] = [['Hour', 'Dag'], ['Day', 'Måned'], ['Month', 'År'], ['Year', 'Alle år']];
const numbers = [0, 1, 2, 3].map(digits => new Intl.NumberFormat('da-DK', { maximumFractionDigits: digits }));
const currency = new Intl.NumberFormat('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 2 });
const number = (value: number, digits = 3) => numbers[digits]!.format(value);
const kroner = (ore: number) => currency.format(ore / 100);

type Props = ReturnType<typeof useElectricityUsage> & { prices: PricePoint[]; gridSupplierName: string; gridSupplier: GridSupplier; widget?: boolean; onScrubChange?: (active: boolean) => void };
export function ElectricityUsageChart({ usage, aggregation, anchor, loading, load, availableYears, agreements, prices, gridSupplier, widget = false, onScrubChange }: Props) {
  const [selectedAt, setSelectedAt] = useState('');
  const [picker, setPicker] = useState(false);
  const [historical, setHistorical] = useState<PricePoint[]>([]);
  const [historicalSupplier,setHistoricalSupplier]=useState('');
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
    setHistoricalSupplier(`${gridSupplier.area}:${gridSupplier.id}`);
    if (!gridSupplier.id || !agreements.records.length || !priceFrom || priceFrom >= priceTo || aggregation === 'Year') { setPriceLoading(false); return; }
    let active = true;
    setPriceLoading(true);
    void (async () => {
      let accumulated: PricePoint[] = [];
      const ranges: {start: string; end: string}[] = [];
      for (let start = priceFrom; start < priceTo;) {
        const nextMonth = advance(start.slice(0, 7) + '-01', 'month');
        const end = nextMonth < priceTo ? nextMonth : priceTo;
        ranges.push({start, end});
        start = end;
      }
      // Three bounded reads per wave instead of a year-long serial waterfall.
      // Shared monthly requests still deduplicate with the summary card.
      for (let offset = 0; offset < ranges.length && active; offset += 3) {
        const results = await Promise.allSettled(ranges.slice(offset, offset + 3).map(({start, end}) =>
          fetchHistoricalPrices(gridSupplier.area, gridSupplier.id, midnight(start), midnight(end))));
        if (!active) return;
        for (const result of results) if (result.status === 'fulfilled') accumulated = accumulated.concat(result.value);
        setHistorical(accumulated);
      }
    })()
      .catch(() => { /* Keep any matching public prices already loaded. */ })
      .finally(() => { if (active) setPriceLoading(false); });
    return () => { active = false; };
  }, [priceFrom, priceTo, aggregation, gridSupplier.area, gridSupplier.id, agreements.records.length]);
  const currentYear = Number(usageToday().slice(0, 4));
  const years = availableYears.length ? availableYears : Array.from({ length: 6 }, (_, index) => currentYear - 5 + index);
  const points = useMemo(() => (usage?.points ?? []).filter(point => point.at < midnight(today)), [usage, today]);
  const selected = points.find(point => point.at === selectedAt);
  const selectedIndex = points.findIndex(point => point.at === selectedAt);
  const selectedIndexRef = useRef(selectedIndex);
  selectedIndexRef.current = selectedIndex;
  const dailyCosts = useMemo(() => estimateUsageTotals(points, aggregation, agreements.records, historicalSupplier===`${gridSupplier.area}:${gridSupplier.id}`&&historical.length ? historical : prices), [points, aggregation, agreements.records, historical, historicalSupplier,gridSupplier.area,gridSupplier.id,prices]);
  const detailed = aggregation !== 'Year';
  const totalCost = selected ? dailyCosts.get(selected.at) : points.length && points.every(point => dailyCosts.has(point.at)) ? points.reduce((sum, point) => sum + dailyCosts.get(point.at)!, 0) : undefined;
  const selectBar = (index: number, initial = false) => {
    const point = points[index];
    if (!point || (!initial && selectedIndexRef.current === index)) return;
    selectedIndexRef.current = index;
    setSelectedAt(point.at);
    // InteractiveEnergyChart owns selection feedback.
  };
  const earliest = `${Math.min(...years)}-01-01`;
  const previous = moveUsagePeriod(aggregation, periodAnchor, -1);
  const next = moveUsagePeriod(aggregation, periodAnchor, 1);
  const labelFormatters = useMemo(() => [false, true].map(short => new Intl.DateTimeFormat('da-DK', {
    timeZone: 'Europe/Copenhagen',
    ...(aggregation === 'Year' ? { year: 'numeric' } : aggregation === 'Month' ? { month: short ? 'short' : 'long' } : aggregation === 'Day' ? { day: 'numeric', ...(short ? {} : { month: 'long' }) } : { hour: '2-digit', minute: '2-digit' }),
  })), [aggregation]);
  const label = (at: string, short = false) => labelFormatters[short ? 1 : 0]!.format(new Date(at)).replace('.', aggregation === 'Hour' ? ':' : '.');
  const chartPoints = useMemo(() => points.map(p => ({label: label(p.at, true), value: p.kwh})), [points, labelFormatters, aggregation]);
  const title = useMemo(() => new Intl.DateTimeFormat('da-DK', {
    year: 'numeric',
    ...(aggregation === 'Day' || aggregation === 'Hour' ? { month: 'long' } : {}),
    ...(aggregation === 'Hour' ? { day: 'numeric' } : {}),
  }).format(new Date(periodAnchor + 'T12:00:00Z')), [aggregation, periodAnchor]);
  useEffect(() => { setSelectedAt(''); }, [from, usage?.to, aggregation]);

  return <View>
    <View style={[s.tabs,widget&&{marginTop:0,padding:2}]}>{modes.map(([mode,name])=><Pressable key={mode} accessibilityRole="button" accessibilityState={{selected:aggregation===mode}} onPress={()=>{setSelectedAt('');void load(mode,safeAnchor);}} style={[s.tab,widget&&{minHeight:36},aggregation===mode&&s.activeTab]}><Text style={[s.tabText,aggregation===mode&&s.activeTabText]}>{name}</Text></Pressable>)}</View>
    {aggregation === 'Year' ? <View style={s.periodRow}><Text style={[s.periodText,{textAlign:'center',flex:1,paddingVertical:10}]}>{usage ? `${usage.from.slice(0,4)} – ${Math.min(Number(usage.to.slice(0,4))-1,currentYear)}` : 'Alle år'}</Text></View> : <View style={s.periodRow}>
      <Pressable accessibilityLabel="Forrige periode" disabled={previous < earliest} onPress={() => void load(aggregation, previous)} style={[s.arrow, previous < earliest && s.disabled]}><AppIcon name="chevron-left" size={21} color={colors.ink} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Vælg periode: ${title}`} onPress={() => setPicker(true)} style={s.periodButton}><AppIcon name="calendar" size={14} color={colors.muted}/><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={s.periodText}>{title}</Text></Pressable>
      <Pressable accessibilityLabel="Næste periode" disabled={next > yesterday} onPress={() => void load(aggregation, next)} style={[s.arrow, next > yesterday && s.disabled]}><AppIcon name="chevron-right" size={21} color={colors.ink} /></Pressable>
    </View>}

    {picker && aggregation !== 'Year' ? <UsageDatePicker aggregation={aggregation} anchor={safeAnchor} maxDate={yesterday} years={years} onClose={() => setPicker(false)} onSelect={date => { setPicker(false); setSelectedAt(''); void load(aggregation, date); }} /> : null}

    {loading && !usage ? <LoadingState label="Henter forbrug…" variant="chart" compact={widget}/> : usage ? <>
      {loading ? <ActivityIndicator color={colors.primary} size="small" style={{ alignSelf: 'flex-start' }} /> : null}
      {usage.syncFailed ? <Text style={s.warning}>Eloverblik kunne ikke opdateres. Gemte målinger vises.</Text> : null}
      <View style={[s.summary, widget && { paddingTop: 2 }]}>
        <View style={{ flex: 1, minWidth: 0 }}><Text style={s.summaryLabel}>{selected ? label(selected.at) : 'Forbrug i perioden'}{(selected ? selected.incomplete : points.some(point => point.incomplete)) ? ' · foreløbigt' : ''}</Text><AnimatedMetric fast style={[s.value, widget && {fontSize:26}]} value={selected?.kwh === null ? 'Mangler data' : `${number(selected ? selected.kwh! : points.reduce((sum, point) => sum + (point.kwh ?? 0), 0), 2)} kWh`}/></View>
        {selected ? <Pressable accessibilityRole="button" onPress={() => setSelectedAt('')} style={s.detailButton}><Text style={s.detailButtonText}>Vis total</Text></Pressable> : null}
      </View>

      {detailed ? totalCost !== undefined ? <View style={[s.costCard, widget && { marginTop: 2, padding: 0 }]}>
        <View style={[s.costHeading, widget && { flexWrap: 'wrap', gap: 4 }]}><Text style={s.costTitle}>Estimeret pris</Text><Text style={s.costValue}>{kroner(totalCost)}</Text></View>
      </View> : selected ? <Text style={s.note}>{priceLoading ? 'Beregner pris…' : !agreements.records.length ? 'Tilføj din elaftale for at se prisen.' : 'Prisen kan ikke beregnes endnu. Prøv igen senere.'}</Text> : null : null}

      {points.length ? <>
        <View style={{height:12}} />
        <InteractiveEnergyChart hideYAxis compact={widget} points={chartPoints} selected={selectedIndex} onSelect={i=>selectBar(i)} kind="bars" onScrubChange={onScrubChange}/>
      </> : <Text style={s.empty}>Ingen målinger i denne periode. Prøv en tidligere periode.</Text>}
      {totalCost!==undefined?<Text style={[s.note,{marginTop:4}]}>Inkl. moms, elafgift, nettariffer og din elaftale. Estimat, ikke en regning.</Text>:null}
    </> : null}
  </View>;
}

const s = StyleSheet.create({
  modeButton: {flexDirection:'row',alignItems:'center',gap:4,paddingHorizontal:10,minHeight:48,borderRadius:12,backgroundColor:colors.primarySoft},modeText:{fontFamily:'Nunito_700Bold',fontSize:12,color:colors.primary},
  tabs: { flexDirection: 'row', padding: 4, backgroundColor: '#F1F3F0', borderRadius: 14, marginTop:14 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight:48, borderRadius: 10 },
  activeTab: { backgroundColor: colors.white, shadowColor:'#1C3424',shadowOpacity:0,shadowRadius:0,shadowOffset:{width:0,height:0},elevation:0 }, tabText: { color: colors.ink, fontFamily: 'Nunito_700Bold', fontSize: 12 }, activeTabText: { color: colors.primary },
  periodRow: { flexDirection: 'row', alignItems: 'center', gap:2, marginTop:4,marginBottom:4 }, arrow: { width:48, height:48, alignItems: 'center', justifyContent: 'center' }, disabled: { opacity: 0.3 },
  periodButton: { flex:1,minWidth:0,flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap:6, paddingHorizontal: 2, minHeight:48 }, periodText: { flexShrink:1,color: colors.ink, fontFamily: 'Nunito_700Bold', fontSize: 13, textTransform: 'capitalize' },
  summary: { flexDirection: 'row', alignItems: 'flex-end', paddingTop: 6 }, summaryLabel: { fontFamily: 'Nunito_500Medium', fontSize: 12, color: colors.muted }, value: { fontFamily: 'Nunito_600SemiBold', fontSize: 28, color: colors.ink, marginTop: 2 },
  detailButton: { backgroundColor: colors.primarySoft, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, marginBottom: 4 }, detailButtonText: { color: colors.primary, fontFamily: 'Nunito_700Bold', fontSize:12 },
  costCard: { marginTop: 4 }, costHeading: { flexDirection: 'row', flexWrap:'wrap', alignItems: 'baseline', gap: 6 }, costTitle: { fontFamily: 'Nunito_500Medium', color: colors.muted, fontSize: 12 }, costValue: { fontFamily: 'Nunito_700Bold', color: colors.ink, fontSize: 14 }, costNote: { fontFamily: 'Nunito_400Regular', color: colors.muted, lineHeight:18, fontSize: 12, marginTop: 4 },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }, chartTitle: { fontFamily: 'Nunito_700Bold', color: colors.ink, fontSize: 13 },
  chart: { height: 166, alignItems: 'flex-end', paddingTop: 10, paddingBottom: 2, paddingHorizontal: 8 }, slot: { alignItems: 'center' }, barArea: { height: 142, justifyContent: 'flex-end', alignItems: 'center' }, bar: { borderRadius: 5 }, tick: { width: 38, height: 14, lineHeight: 11, textAlign: 'center', fontSize: 9, color: colors.muted, marginTop: 7 }, selectedTick: { color: colors.primary, fontFamily: 'Nunito_700Bold' },
  note: { fontFamily: 'Nunito_400Regular', fontSize: 12, lineHeight: 18, color: colors.muted }, warning: { fontFamily: 'Nunito_500Medium', fontSize:12, lineHeight:18, color: colors.coral, marginTop: 10 }, footer: { fontFamily: 'Nunito_400Regular', fontSize:12, lineHeight:18, color: colors.muted, marginTop: 14 },
  empty: { minHeight: 130, justifyContent: 'center', alignItems: 'center', color: colors.muted, fontFamily: 'Nunito_400Regular', fontSize: 12 },
});
