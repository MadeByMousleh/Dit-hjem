import { AppIcon } from './AppIcon';
import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { useEforsyning } from '../hooks/useEforsyning';
import { useDashboardViewState } from '../hooks/useDashboardViewState';
import type { HeatCustomer, HeatReading } from '../services/private-heating';
import { colors } from '../styles/theme';
import { dailyHeatPoints } from '../utils/heatingChart';
import { dailyTemperaturePoints, temperatureChartPoints, type TemperaturePeriod } from '../utils/heatingTemperature';
import { HeatingUsageCard } from './HeatingUsageCard';
import { UsageDatePicker } from './UsageDatePicker';

const number = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 2 });
const gj = (kwh: number | null | undefined) => kwh == null ? '–' : `${number.format(kwh * 0.0036)} GJ`;
const degrees = (value: number | null | undefined) => value == null ? '–' : `${number.format(value)} °C`;
const flowColor = colors.primary;
const returnColor = '#C2410C';
const chartHeight = 136;

export function HeatingPage() {
  const heat = useEforsyning();
  const history = useMemo(() => [...heat.histories].sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt))[0], [heat.histories]);
  const readings = useMemo(() => {
    const rows = heat.histories.filter(item => item.installation === history?.installation && item.supplier === history?.supplier)
      .sort((a, b) => a.fetchedAt.localeCompare(b.fetchedAt)).flatMap(item => item.readings);
    return [...new Map(rows.map(row => [`${row.from}/${row.to}`, row])).values()];
  }, [heat.histories, history]);
  const measured = useMemo(() => dailyHeatPoints(history?.readings ?? []).filter(point => point.actual !== null), [history]);
  const expectedToDate = measured.length && measured.every(point => point.expected !== null)
    ? measured.reduce((sum, point) => sum + point.expected!, 0) / 0.0036 : null;
  const used = history?.summary?.actualKwh ?? (measured.length ? measured.reduce((sum, point) => sum + point.actual!, 0) / 0.0036 : null);
  const expectedYear = history?.summary?.expectedYearKwh ?? null;
  const annualShare = history?.summary?.actualKwh != null && expectedYear !== null && expectedYear > 0
    ? Math.round(history.summary.actualKwh / expectedYear * 100) : null;
  const hasTemperatures = readings.some(row => row.flowC != null && row.returnC != null);
  const missingDetails = expectedYear === null || !hasTemperatures;

  return <>
    {history ? <HeatingCustomerCard customer={history.customer ?? null} installation={history.installation} /> : null}
    {history ? <View style={s.overview}>
      <View style={s.overviewHeading}>
        <View><Text style={s.sectionTitle}>Årets varme</Text><Text style={s.muted}>Afregningsår {history.year}</Text></View>
        <AppIcon name="activity" size={20} color={colors.primary} />
      </View>
      <View style={s.annualCard}>
        <Text style={s.metricLabel}>Forventet i afregningsåret</Text>
        <Text style={s.annualValue}>{gj(expectedYear)}</Text>
      </View>
      <View style={s.metricRow}>
        <View style={s.metricCard}><Text style={s.metricLabel}>{history.summary?.actualKwh != null ? 'Brugt indtil nu' : 'Brugt på målte dage'}</Text><Text style={s.metricValue}>{gj(used)}</Text></View>
        <View style={s.metricCard}><Text style={s.metricLabel}>Forventet på målte dage</Text><Text style={s.metricValue}>{gj(expectedToDate)}</Text></View>
      </View>
      {annualShare !== null ? <View style={s.progressWrap} accessibilityLabel={`${annualShare} procent af forventet årsforbrug brugt`}>
        <View style={s.progressTrack}><View style={[s.progressFill, { width: `${Math.min(100, annualShare)}%` }]} /></View>
        <Text style={s.muted}>{annualShare}% af årsforventningen</Text>
      </View> : null}
      {missingDetails ? <View style={s.missingDetails}>
        <Text style={s.muted}>{heat.loading ? 'Henter årsoversigt og temperaturer…' : Platform.OS === 'web' ? 'Årsoversigt eller temperaturer mangler. Åbn mobilappen for at opdatere.' : 'Årsoversigt eller temperaturer mangler i de gemte data.'}</Text>
        {Platform.OS !== 'web' && !heat.loading ? <Pressable accessibilityRole="button" onPress={() => void heat.refresh()} style={s.refreshButton}><AppIcon name="refresh-cw" size={14} color={colors.primary} /><Text style={s.refreshText}>Hent nye varmedata</Text></Pressable> : null}
      </View> : null}
      <Text style={s.updated}>Opdateret {new Date(history.fetchedAt).toLocaleDateString('da-DK')}</Text>
    </View> : null}
    <HeatingUsageCard heat={heat} />
    {history ? <HeatingTemperatureChart readings={readings} /> : null}
  </>;
}

function HeatingCustomerCard({ customer, installation }: { customer: HeatCustomer | null; installation: string }) {
  const legacyCustomerNumber = installation.split('/')[0] ?? null;
  const details = [
    ['Kundenummer', customer?.customerNumber ?? legacyCustomerNumber],
    ['Forbrugernummer', customer?.consumerNumber ?? null],
    ['Installationsnummer', customer?.installationNumber ?? null],
    ['Målernummer', customer?.meterNumber ?? null],
  ].filter((item): item is [string, string] => !!item[1]);
  const address = [customer?.address, [customer?.postalCode, customer?.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return <View style={s.customerCard}>
    <View style={s.overviewHeading}>
      <View><Text style={s.sectionTitle}>Kundeoplysninger</Text><Text style={s.muted}>Sønderborg Varme</Text></View>
      <AppIcon name="user" size={20} color={colors.primary} />
    </View>
    {address ? <View style={s.addressRow}><AppIcon name="map-pin" size={15} color={colors.primary} /><Text style={s.address}>{address}</Text></View> : null}
    <View style={s.customerGrid}>{details.map(([label, value]) => <View key={label} style={s.customerMetric}><Text style={s.metricLabel}>{label}</Text><Text selectable style={s.customerValue}>{value}</Text></View>)}</View>
    {!customer ? <Text style={s.customerHint}>Opdater varmedata i mobilappen for at hente adresse og måleroplysninger.</Text> : null}
  </View>;
}

function HeatingTemperatureChart({ readings }: { readings: HeatReading[] }) {
  const { temperaturePeriod: period, setTemperaturePeriod: setPeriod, temperatureDate: date, setTemperatureDate: setDate } = useDashboardViewState();
  const [picker, setPicker] = useState(false);
  const [width, setWidth] = useState(0);
  const [overview, setOverview] = useState(true);
  const [selected, setSelected] = useState('');
  const daily = useMemo(() => dailyTemperaturePoints(readings).filter(point => point.flowC !== null && point.returnC !== null), [readings]);
  const earliest = daily[0]?.date;
  const latest = daily[daily.length - 1]?.date;
  const anchor = date || latest || new Date().toISOString().slice(0, 10);
  const years = useMemo(() => {
    if (!earliest || !latest) return [Number(anchor.slice(0, 4))];
    return Array.from({ length: Number(latest.slice(0, 4)) - Number(earliest.slice(0, 4)) + 1 }, (_, i) => Number(earliest.slice(0, 4)) + i);
  }, [earliest, latest, anchor]);
  const points = useMemo(() => temperatureChartPoints(readings, period, anchor), [readings, period, anchor]);
  const current = selected ? points.find(point => point.date === selected) : [...points].reverse().find(point => point.flowC !== null && point.returnC !== null);
  const values = points.flatMap(point => [point.flowC, point.returnC]).filter((value): value is number => value !== null);
  const min = values.length ? Math.max(0, Math.floor((Math.min(...values) - 5) / 10) * 10) : 0;
  const max = values.length ? Math.max(min + 10, Math.ceil((Math.max(...values) + 5) / 10) * 10) : 100;
  const slotWidth = overview && width ? Math.max(8, (width - 16) / points.length) : 24;
  const graphWidth = slotWidth * points.length;
  const labelEvery = Math.max(1, Math.ceil(38 / slotWidth));
  const selectedIndex = points.findIndex(point => point.date === selected);
  const y = (value: number) => chartHeight - 9 - (value - min) / (max - min) * 110;
  const pathFor = (field: 'flowC' | 'returnC') => {
    let connected = false;
    return points.map((point, index) => {
      if (point[field] === null) { connected = false; return ''; }
      const segment = `${connected ? 'L' : 'M'} ${slotWidth * (index + 0.5)} ${y(point[field]!)}`;
      connected = true;
      return segment;
    }).join(' ');
  };
  const navigate = (direction: number) => {
    const nextDate = new Date(`${anchor}T12:00:00Z`);
    nextDate.setUTCDate(1);
    if (period === 'month') nextDate.setUTCFullYear(nextDate.getUTCFullYear() + direction);
    else nextDate.setUTCMonth(nextDate.getUTCMonth() + direction);
    setDate(nextDate.toISOString().slice(0, 10));
    setSelected('');
  };
  const previous = period === 'month' ? !!earliest && Number(anchor.slice(0, 4)) > Number(earliest.slice(0, 4))
    : !!earliest && anchor.slice(0, 7) > earliest.slice(0, 7);
  const next = period === 'month' ? !!latest && Number(anchor.slice(0, 4)) < Number(latest.slice(0, 4))
    : !!latest && anchor.slice(0, 7) < latest.slice(0, 7);
  const title = period === 'month' ? anchor.slice(0, 4) : new Date(`${anchor}T12:00:00Z`).toLocaleDateString('da-DK', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const currentLabel = current ? period === 'month'
    ? new Date(`${current.date}-01T12:00:00Z`).toLocaleDateString('da-DK', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    : new Date(`${current.date}T12:00:00Z`).toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : null;

  return <View style={s.temperatureCard}>
    <Text style={s.sectionTitle}>Frem- og returtemperatur</Text>
    <View style={s.tabs}>{(['month', 'day'] as TemperaturePeriod[]).map(mode => <Pressable key={mode} accessibilityRole="button" accessibilityState={{ selected: period === mode }} onPress={() => { setPeriod(mode); setSelected(''); }} style={[s.tab, period === mode && s.activeTab]}><Text style={[s.tabText, period === mode && s.activeTabText]}>{mode === 'month' ? 'Måned' : 'Dag'}</Text></Pressable>)}</View>
    <View style={s.periodRow}>
      <Pressable accessibilityRole="button" accessibilityLabel="Forrige periode" disabled={!previous} onPress={() => navigate(-1)} style={[s.arrow, !previous && s.disabled]}><AppIcon name="chevron-left" size={21} color={colors.ink} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Vælg periode" onPress={() => setPicker(true)} style={s.periodButton}><Text style={s.periodText}>{title}</Text><AppIcon name="calendar" size={16} color={colors.primary} /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Næste periode" disabled={!next} onPress={() => navigate(1)} style={[s.arrow, !next && s.disabled]}><AppIcon name="chevron-right" size={21} color={colors.ink} /></Pressable>
    </View>
    {picker ? <UsageDatePicker aggregation={period === 'month' ? 'Month' : 'Day'} anchor={anchor} years={years} maxDate={latest ?? anchor} onClose={() => setPicker(false)} onSelect={value => { setDate(value); setSelected(''); setPicker(false); }} /> : null}
    <Text style={s.muted}>{currentLabel ?? 'Ingen temperaturmålinger i perioden'}{period === 'month' && currentLabel ? ' · gennemsnit' : ''}</Text>
    <View style={s.temperatureValues}>
      <View style={s.temperatureMetric}><View style={[s.key, { backgroundColor: flowColor }]} /><View><Text style={s.metricLabel}>Fremløb</Text><Text style={s.temperatureValue}>{degrees(current?.flowC)}</Text></View></View>
      <View style={s.temperatureMetric}><View style={[s.key, { backgroundColor: returnColor }]} /><View><Text style={s.metricLabel}>Retur</Text><Text style={s.temperatureValue}>{degrees(current?.returnC)}</Text></View></View>
    </View>
    {values.length ? <>
      <Text style={s.scale}>{min}–{max} °C</Text>
      <View onLayout={event => setWidth(event.nativeEvent.layout.width)}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chart}>
        <View style={{ width: graphWidth, height: 160 }}>
          <Svg width={graphWidth} height={chartHeight} accessible={false}>
            {[0, 0.5, 1].map(level => <Line key={level} x1={0} x2={graphWidth} y1={9 + 110 * level} y2={9 + 110 * level} stroke={colors.line} strokeWidth={1} />)}
            <Path d={pathFor('flowC')} stroke={flowColor} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <Path d={pathFor('returnC')} stroke={returnColor} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            {points.map((point, index) => point.flowC === null ? null : <Circle key={`flow-${point.date}`} cx={slotWidth * (index + 0.5)} cy={y(point.flowC)} r={point.date === selected ? 4 : 2.5} fill={flowColor} />)}
            {points.map((point, index) => point.returnC === null ? null : <Circle key={`return-${point.date}`} cx={slotWidth * (index + 0.5)} cy={y(point.returnC)} r={point.date === selected ? 4 : 2.5} fill={returnColor} />)}
          </Svg>
          <View style={s.slotRow}>{points.map((point, index) => {
            const isSelected = point.date === selected;
            const showLabel = isSelected || (index % labelEvery === 0 && (selectedIndex < 0 || Math.abs(index - selectedIndex) >= labelEvery));
            return <Pressable key={point.date} accessibilityRole="button" accessibilityLabel={`${point.date}: fremløb ${degrees(point.flowC)}, retur ${degrees(point.returnC)}`} accessibilityState={{ selected: isSelected }} onPress={() => setSelected(isSelected ? '' : point.date)} style={[s.slot, { width: slotWidth }]}><Text numberOfLines={1} style={[s.tick, isSelected && s.selectedTick]}>{showLabel ? period === 'month' ? point.date.slice(5) : point.date.slice(8) : ''}</Text></Pressable>;
          })}</View>
        </View>
      </ScrollView></View>
      {period === 'day' ? <Pressable accessibilityRole="button" onPress={() => setOverview(value => !value)} style={s.zoom}><Text style={s.zoomText}>{overview ? 'Større graf' : 'Vis hele perioden'}</Text></Pressable> : null}
    </> : <Text style={s.noData}>Opdater varmeforbruget for at hente temperaturer.</Text>}
  </View>;
}

const s = StyleSheet.create({
  customerCard: { padding: 24, marginBottom: 24, borderRadius: 24, backgroundColor: colors.white },
  overview: { padding: 20, marginBottom: 18, borderRadius: 20, backgroundColor: colors.white },
  overviewHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontFamily: 'Nunito_700Bold', fontSize: 17, color: colors.ink, letterSpacing: -0.2 },
  muted: { fontFamily: 'Nunito_500Medium', fontSize: 10, color: colors.muted, marginTop: 4 },
  annualCard: { marginTop: 16, borderRadius: 24, backgroundColor: colors.primarySoft, padding: 24 },
  annualValue: { fontFamily: 'Nunito_700Bold', fontSize: 28, color: colors.primary, marginTop: 4, letterSpacing: -0.8 },
  metricRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  metricCard: { flex: 1, minWidth: 0, borderRadius: 24, backgroundColor: colors.paper, padding: 12 },
  metricLabel: { fontFamily: 'Nunito_500Medium', fontSize: 11, color: colors.muted },
  metricValue: { fontFamily: 'Nunito_700Bold', fontSize: 19, color: colors.ink, marginTop: 5, letterSpacing: -0.4 },
  progressWrap: { marginTop: 15 },
  progressTrack: { height: 7, backgroundColor: colors.paper, borderRadius: 4, overflow: 'hidden', marginBottom: 5 },
  progressFill: { height: 7, backgroundColor: colors.primary, borderRadius: 4 },
  missingDetails: { marginTop: 12 },
  refreshButton: { marginTop: 9, flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', paddingVertical: 8 },
  refreshText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: colors.primary },
  updated: { fontFamily: 'Nunito_400Regular', fontSize: 10, color: colors.muted, marginTop: 12 },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginTop: 15 },
  address: { flex: 1, fontFamily: 'Nunito_500Medium', fontSize: 13, color: colors.ink, lineHeight: 18 },
  customerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 },
  customerMetric: { width: '47%', paddingVertical: 7 },
  customerValue: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: colors.ink, marginTop: 3 },
  customerHint: { fontFamily: 'Nunito_400Regular', fontSize: 10, color: colors.muted, marginTop: 12, lineHeight: 15 },
  temperatureCard: { padding: 24, marginBottom: 24, borderRadius: 24, backgroundColor: colors.white },
  tabs: { flexDirection: 'row', padding: 4, backgroundColor: colors.paper, borderRadius: 16, marginTop: 18 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 42, borderRadius: 12 },
  activeTab: { backgroundColor: colors.primary },
  tabText: { color: colors.ink, fontFamily: 'Nunito_700Bold', fontSize: 12 },
  activeTabText: { color: colors.white },
  periodRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 14 },
  arrow: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.3 },
  periodButton: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, minHeight: 48 },
  periodText: { color: colors.ink, fontFamily: 'Nunito_700Bold', fontSize: 15, textTransform: 'capitalize' },
  temperatureValues: { flexDirection: 'row', gap: 10, marginTop: 12 },
  temperatureMetric: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9, padding: 12, borderRadius: 14, backgroundColor: colors.paper },
  key: { width: 4, height: 30, borderRadius: 2 },
  temperatureValue: { fontFamily: 'Nunito_700Bold', fontSize: 21, color: colors.ink, marginTop: 2, letterSpacing: -0.4 },
  scale: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: colors.muted, textAlign: 'right', marginTop: 18 },
  chart: { alignItems: 'flex-end', paddingTop: 12, paddingBottom: 2, paddingHorizontal: 8 },
  slotRow: { flexDirection: 'row', position: 'absolute', top: 0, left: 0 },
  slot: { height: 160, justifyContent: 'flex-end', alignItems: 'center' },
  tick: { width: 38, textAlign: 'center', fontSize: 9, color: colors.muted },
  selectedTick: { color: colors.primary, fontFamily: 'Nunito_700Bold' },
  zoom: { alignSelf: 'flex-end', marginTop: 10, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, backgroundColor: colors.primarySoft },
  zoomText: { color: colors.primary, fontFamily: 'Nunito_700Bold', fontSize: 11 },
  noData: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: colors.muted, marginTop: 16 },
});
