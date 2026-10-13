import { AppIcon } from './AppIcon';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { useEforsyning } from '../hooks/useEforsyning';
import { useDashboardViewState } from '../hooks/useDashboardViewState';
import { colors } from '../styles/theme';
import { dailyHeatPoints, heatChartPoints, type HeatPeriod } from '../utils/heatingChart';
import { estimateHeatingVariableCostFromGj, SONDERBORG_VARIABLE_PRICE_DKK_PER_MWH } from '../utils/heatingCost';
import { UsageDatePicker } from './UsageDatePicker';
import { useBarScrub } from '../hooks/useBarScrub';
import { tickSelection } from '../utils/barScrub';

const modes: [HeatPeriod, string][] = [['year', 'År'], ['month', 'Måned'], ['day', 'Dag']];
const format = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 3 });
const kr = new Intl.NumberFormat('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 });
const valueText = (value: number | null) => value === null ? 'Ingen data' : `${format.format(value)} GJ`;
const priceText = (value: number | null) => value === null ? 'Ingen data' : kr.format(value);
const chartHeight = 142;
const barScale = 136;

export function HeatingUsageCard({ heat }: { heat: ReturnType<typeof useEforsyning> }) {
  const { heatPeriod: period, setHeatPeriod: setPeriod, heatDate: date, setHeatDate: setDate } = useDashboardViewState();
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState('');
  const [width, setWidth] = useState(0);
  const [picker, setPicker] = useState(false);
  const [overview, setOverview] = useState(true);
  const history = useMemo(() => [...heat.histories].sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt))[0], [heat.histories]);
  const readings = useMemo(() => heat.histories.filter(item => item.installation === history?.installation && item.supplier === history?.supplier)
    .sort((a, b) => a.fetchedAt.localeCompare(b.fetchedAt)).flatMap(item => item.readings), [heat.histories, history]);
  const merged = useMemo(() => [...new Map(readings.map(row => [`${row.from}/${row.to}`, row])).values()], [readings]);
  const daily = useMemo(() => dailyHeatPoints(merged), [merged]);
  const measuredDays = useMemo(() => daily.filter(point => point.actual !== null), [daily]);
  const earliest = measuredDays[0]?.date ?? daily[0]?.date;
  const latest = measuredDays[measuredDays.length - 1]?.date ?? daily[daily.length - 1]?.date;
  const anchor = date || latest || new Date().toISOString().slice(0, 10);
  const years = useMemo(() => {
    if (!earliest || !latest) return [Number(anchor.slice(0, 4))];
    return Array.from({ length: Number(latest.slice(0, 4)) - Number(earliest.slice(0, 4)) + 1 }, (_, index) => Number(earliest.slice(0, 4)) + index);
  }, [earliest, latest, anchor]);
  const points = useMemo(() => heatChartPoints(merged, period, anchor), [merged, period, anchor]);
  const chosen = points.find(point => point.date === selected);
  const measured = points.filter(point => point.actual !== null);
  const total = chosen ? chosen.actual : measured.length ? measured.reduce((sum, point) => sum + point.actual!, 0) : null;
  const expected = chosen ? chosen.expected : measured.length && measured.every(point => point.expected !== null) ? measured.reduce((sum, point) => sum + point.expected!, 0) : null;
  const cost = estimateHeatingVariableCostFromGj(total);
  const expectedCost = estimateHeatingVariableCostFromGj(expected);
  const max = Math.max(0.001, ...points.flatMap(point => [point.actual ?? 0, point.expected ?? 0]));
  const slotWidth = overview && width ? Math.max(7, (width - 16) / Math.max(1, points.length)) : 21;
  const chartWidth = slotWidth * points.length;
  const barWidth = Math.max(2, Math.min(32, slotWidth - 2));
  const selectedIndex = points.findIndex(point => point.date === selected);
  const selectedIndexRef = useRef(selectedIndex);
  selectedIndexRef.current = selectedIndex;
  const chartScrollRef = useRef<ScrollView>(null);
  const selectBar = (index: number, initial = false) => {
    const point = points[index];
    if (!point || (!initial && selectedIndexRef.current === index)) return;
    selectedIndexRef.current = index;
    setSelected(point.date);
    tickSelection();
  };
  const barScrub = useBarScrub({ count: points.length, stride: slotWidth, inset: 8, viewportWidth: width,
    contentWidth: chartWidth + 16, scrollRef: chartScrollRef, onSelect: selectBar });
  const labelEvery = Math.max(1, Math.ceil(38 / slotWidth));
  const y = (value: number) => chartHeight - value / max * barScale;
  let connected = false;
  const path = points.map((point, index) => {
    if (point.expected === null) { connected = false; return ''; }
    const segment = `${connected ? 'L' : 'M'} ${slotWidth * (index + 0.5)} ${y(point.expected)}`;
    connected = true;
    return segment;
  }).join(' ');
  const moveDate = (direction: number) => {
    const current = new Date(`${anchor}T12:00:00Z`);
    current.setUTCDate(1);
    if (period === 'month') current.setUTCFullYear(current.getUTCFullYear() + direction);
    else current.setUTCMonth(current.getUTCMonth() + direction);
    setDate(current.toISOString().slice(0, 10));
    setSelected('');
  };
  const previous = period === 'month' ? !!earliest && Number(anchor.slice(0, 4)) - 1 >= Number(earliest.slice(0, 4))
    : period === 'day' && !!earliest && anchor.slice(0, 7) > earliest.slice(0, 7);
  const next = period === 'month' ? !!latest && Number(anchor.slice(0, 4)) + 1 <= Number(latest.slice(0, 4))
    : period === 'day' && !!latest && anchor.slice(0, 7) < latest.slice(0, 7);
  const title = period === 'year' ? 'Gemte år' : period === 'month' ? anchor.slice(0, 4) : new Date(`${anchor}T12:00:00Z`).toLocaleDateString('da-DK', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const selectedLabel = selected ? period === 'year' ? selected : period === 'month' ? new Date(`${selected}-01T12:00:00Z`).toLocaleDateString('da-DK', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : new Date(`${selected}T12:00:00Z`).toLocaleDateString('da-DK', { day: 'numeric', month: 'long', timeZone: 'UTC' }) : 'Forbrug i perioden';

  return <View style={s.card}>
    <Text style={s.title}>Dit varmeforbrug</Text>
    {history ? <>
      <View style={s.tabs}>{modes.map(([mode, name]) => <Pressable key={mode} accessibilityRole="button" accessibilityState={{ selected: period === mode }} onPress={() => { setPeriod(mode); setSelected(''); }} style={[s.tab, period === mode && s.activeTab]}><Text style={[s.tabText, period === mode && s.activeTabText]}>{name}</Text></Pressable>)}</View>

      <View style={s.periodRow}>
        <Pressable accessibilityRole="button" accessibilityLabel="Forrige periode" disabled={!previous} onPress={() => moveDate(-1)} style={[s.arrow, !previous && s.disabled]}><AppIcon name="chevron-left" size={21} color={colors.ink} /></Pressable>
        {period === 'year' ? <Text style={s.periodText}>{title}</Text> : <Pressable accessibilityRole="button" accessibilityLabel="Vælg periode" onPress={() => setPicker(true)} style={s.periodButton}><Text style={s.periodText}>{title}</Text><AppIcon name="calendar" size={16} color={colors.primary} /></Pressable>}
        <Pressable accessibilityRole="button" accessibilityLabel="Næste periode" disabled={!next} onPress={() => moveDate(1)} style={[s.arrow, !next && s.disabled]}><AppIcon name="chevron-right" size={21} color={colors.ink} /></Pressable>
      </View>
      {picker && period !== 'year' ? <UsageDatePicker aggregation={period === 'month' ? 'Month' : 'Day'} anchor={anchor} years={years} maxDate={latest ?? anchor} onClose={() => setPicker(false)} onSelect={value => { setPicker(false); setDate(value); setSelected(''); }} /> : null}

      <View style={s.summary}>
        <View style={{ flex: 1 }}><Text style={s.summaryLabel}>{selectedLabel}</Text><Text style={s.total}>{valueText(total)}</Text></View>
        {chosen ? <Pressable accessibilityRole="button" onPress={() => setSelected('')} style={s.detailButton}><Text style={s.detailButtonText}>Vis total</Text></Pressable> : null}
      </View>
      <Text style={s.note}>Forventet: {valueText(expected)}</Text>
      <View style={s.costCard}>
        <View style={s.costHeading}><Text style={s.costTitle}>{chosen ? 'Variabel pris for valgte periode' : 'Samlet variabel pris'}</Text><Text style={s.costRate}>{SONDERBORG_VARIABLE_PRICE_DKK_PER_MWH} kr./MWh</Text></View>
        <View style={s.costRow}>
          <View style={s.costMetric}><Text style={s.costLabel}>Brugt</Text><Text style={s.costValue}>{priceText(cost)}</Text></View>
          <View style={s.costMetric}><Text style={s.costLabel}>Forventet</Text><Text style={s.costValue}>{priceText(expectedCost)}</Text></View>
        </View>
        <Text style={s.costNote}>Ekskl. abonnement og faste bidrag</Text>
      </View>

      <Text style={s.chartScale}>0–{format.format(max)} GJ</Text>
      <View style={s.legend}><View style={s.legendItem}><View style={s.actualKey} /><Text style={s.legendText}>Brugt</Text></View><View style={s.legendItem}><View style={s.expectedKey} /><Text style={s.legendText}>Forventet</Text></View></View>
      <View ref={barScrub.viewportRef} collapsable={false} {...barScrub.panHandlers} onTouchEnd={barScrub.end}
        onTouchCancel={barScrub.end} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
        <ScrollView ref={chartScrollRef} horizontal scrollEnabled={!barScrub.isScrubbing} showsHorizontalScrollIndicator={false}
          onScroll={event => barScrub.setScrollX(event.nativeEvent.contentOffset.x)} scrollEventThrottle={16} contentContainerStyle={s.chart}>
        <View style={{ width: chartWidth, height: 166 }}>
          <Svg width={chartWidth} height={chartHeight} accessible={false}>
            <Line x1={0} x2={chartWidth} y1={chartHeight} y2={chartHeight} stroke={colors.line} />
            {points.map((point, index) => point.actual === null
              ? <Rect key={point.date} x={slotWidth * (index + 0.5) - barWidth / 2} y={chartHeight - 3} width={barWidth} height={3} rx={1.5} fill={colors.line} />
              : <Rect key={point.date} x={slotWidth * (index + 0.5) - barWidth / 2} y={point.actual > 0 ? y(point.actual) : chartHeight} width={barWidth} height={point.actual > 0 ? chartHeight - y(point.actual) : 0} rx={5} fill={point.date === selected ? colors.primary : '#B9D9BE'} />)}
            <Path d={path} stroke="#C2410C" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            {points.map((point, index) => point.expected === null ? null : <Circle key={point.date} cx={slotWidth * (index + 0.5)} cy={y(point.expected)} r={overview ? 2.5 : 3.5} fill="#C2410C" stroke={colors.white} strokeWidth={1} />)}
          </Svg>
          <View style={s.slotRow}>{points.map((point, index) => {
            const selectedPoint = point.date === selected;
            const showLabel = selectedPoint || (index % labelEvery === 0 && (selectedIndex < 0 || Math.abs(index - selectedIndex) >= labelEvery));
            return <Pressable key={point.date} accessibilityRole="button" accessibilityLabel={`${point.date}: brugt ${valueText(point.actual)}, forventet ${valueText(point.expected)}`} accessibilityState={{ selected: selectedPoint }}
              accessibilityHint="Hold og træk for at vælge andre søjler"
              delayLongPress={300} onLongPress={event => barScrub.begin(index, event.nativeEvent.pageX)}
              onPress={() => { if (!barScrub.shouldIgnorePress()) { if (selectedPoint) setSelected(''); else selectBar(index); } }}
              style={[s.slot, { width: slotWidth }]}><Text numberOfLines={1} style={[s.tick, selectedPoint && s.selectedTick]}>{showLabel ? period === 'year' ? point.date : period === 'month' ? point.date.slice(5, 7) : point.date.slice(8) : ''}</Text></Pressable>;
          })}</View>
        </View>
      </ScrollView></View>
      {points.length > 12 ? <Pressable accessibilityRole="button" onPress={() => setOverview(value => !value)} style={[s.detailButton, s.zoom]}><Text style={s.detailButtonText}>{overview ? 'Større søjler' : 'Vis hele perioden'}</Text></Pressable> : null}

      <View style={s.actions}><Pressable disabled={heat.loading} onPress={() => void heat.refresh()}><Text style={s.link}>Opdater</Text></Pressable><Pressable disabled={heat.loading} onPress={() => { heat.setPassword(''); setEditing(value => !value); }}><Text style={s.link}>{editing ? 'Annuller' : 'Forbind igen'}</Text></Pressable></View>
    </> : null}
    {(!history || heat.connected === false || editing) ? <>
      {Platform.OS === 'web' ? <Text style={s.note}>Forbindelsen huskes kun, indtil du genindlæser eller forlader siden.</Text> : null}
      <Text style={s.connectIntro}>Forbind din konto hos Sønderborg Varme for at hente dit varmeforbrug. Oplysningerne finder du på din varmeregning.</Text>
      <Text style={s.inputLabel}>Kundenummer</Text>
      <TextInput accessibilityLabel="Kundenummer" placeholder="Indtast dit kundenummer" keyboardType="number-pad" autoCapitalize="none" autoCorrect={false} value={heat.username} onChangeText={heat.setUsername} editable={!heat.loading} style={s.input} />
      <Text style={s.inputLabel}>Kode fra varmeregningen</Text>
      <TextInput accessibilityLabel="Kode fra varmeregningen" placeholder="Indtast koden fra regningen" secureTextEntry autoCapitalize="none" autoCorrect={false} value={heat.password} onChangeText={heat.setPassword} editable={!heat.loading} style={s.input} />
      <Pressable accessibilityRole="button" disabled={heat.loading || !heat.username || !heat.password} onPress={() => { void heat.login().then(success => { if (success) { setEditing(false); setSelected(''); } }); }} style={[s.button, (heat.loading || !heat.username || !heat.password) && { opacity: 0.5 }]}><Text style={s.buttonText}>Forbind varme</Text></Pressable>
    </> : null}
    {heat.loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 12 }} /> : null}
    {heat.error ? <Text accessibilityRole="alert" style={s.error}>{heat.error}</Text> : null}
  </View>;
}

const s = StyleSheet.create({
  card: { padding: 24, marginBottom: 24, borderRadius: 24, backgroundColor: colors.white },
  title: { fontFamily: 'Nunito_700Bold', fontSize: 17, color: colors.ink, letterSpacing: -0.2 },
  total: { fontFamily: 'Nunito_700Bold', fontSize: 31, color: colors.ink, marginTop: 3, letterSpacing: -0.8 },
  note: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: colors.muted, marginTop: 8, lineHeight: 16 },
  costCard: { marginTop: 14, borderRadius: 24, backgroundColor: colors.primarySoft, padding: 13 },
  costHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  costTitle: { flex: 1, fontFamily: 'Nunito_700Bold', fontSize: 12, color: colors.ink },
  costRate: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: colors.primary },
  costRow: { flexDirection: 'row', gap: 10, marginTop: 11 },
  costMetric: { flex: 1 },
  costLabel: { fontFamily: 'Nunito_500Medium', fontSize: 10, color: colors.muted },
  costValue: { fontFamily: 'Nunito_700Bold', fontSize: 20, color: colors.ink, marginTop: 2, letterSpacing: -0.4 },
  costNote: { fontFamily: 'Nunito_400Regular', fontSize: 10, color: colors.muted, marginTop: 8 },
  connectIntro: { fontFamily: 'Nunito_400Regular', fontSize: 12, lineHeight: 18, color: colors.muted, marginTop: 10 },
  inputLabel: { fontFamily: 'Nunito_700Bold', fontSize: 11, color: colors.ink, marginTop: 16 },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12, color: colors.ink, marginTop: 12 },
  button: { backgroundColor: colors.primary, borderRadius: 22, alignItems: 'center', padding: 13, marginVertical: 12 },
  buttonText: { color: colors.white, fontFamily: 'Nunito_700Bold' },
  tabs: { flexDirection: 'row', padding: 4, backgroundColor: colors.paper, borderRadius: 16, marginTop: 18 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 42, borderRadius: 12 },
  activeTab: { backgroundColor: colors.primary },
  tabText: { color: colors.ink, fontFamily: 'Nunito_700Bold', fontSize: 12 },
  activeTabText: { color: colors.white },
  periodRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 14 },
  arrow: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.3 },
  periodButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 12, minHeight: 48 },
  periodText: { color: colors.ink, fontFamily: 'Nunito_700Bold', fontSize: 15, textTransform: 'capitalize' },
  summary: { flexDirection: 'row', alignItems: 'flex-end', borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 14 },
  summaryLabel: { fontFamily: 'Nunito_500Medium', fontSize: 12, color: colors.muted },
  detailButton: { backgroundColor: colors.primarySoft, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, marginBottom: 4 },
  detailButtonText: { color: colors.primary, fontFamily: 'Nunito_700Bold', fontSize: 11 },
  chartScale: { fontFamily: 'Nunito_400Regular', fontSize: 11, lineHeight: 17, color: colors.muted, textAlign: 'right', marginTop: 19 },
  chart: { alignItems: 'flex-end', paddingTop: 10, paddingBottom: 2, paddingHorizontal: 8 },
  slotRow: { flexDirection: 'row', position: 'absolute', top: 0, left: 0 },
  slot: { height: 166, justifyContent: 'flex-end', alignItems: 'center' },
  tick: { width: 38, textAlign: 'center', fontSize: 9, color: colors.muted, marginTop: 7 },
  selectedTick: { color: colors.primary, fontFamily: 'Nunito_700Bold' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendText: { fontFamily: 'Nunito_500Medium', fontSize: 11, color: colors.muted },
  actualKey: { width: 12, height: 12, borderRadius: 3, backgroundColor: '#B9D9BE' },
  expectedKey: { width: 16, borderTopWidth: 3, borderColor: '#C2410C', borderRadius: 2 },
  zoom: { alignSelf: 'flex-end', marginTop: 10 },
  actions: { flexDirection: 'row', gap: 20, marginTop: 14 },
  link: { color: colors.primary, fontFamily: 'Nunito_700Bold', fontSize: 12 },
  error: { color: colors.coral, marginTop: 12, fontSize: 12 },
});
