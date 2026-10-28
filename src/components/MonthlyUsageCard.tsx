import {AppText as Text} from './AppText';
import {AnimatedMetric} from './Motion';
import {LoadingState} from './LoadingState';
import {cardStyles} from '../styles/cards';
import { AppIcon } from './AppIcon';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ElectricityAgreement } from '../hooks/useElectricityAgreements';
import { fetchHistoricalPrices, type GridSupplier, type PricePoint } from '../prices';
import type { ElectricityUsage } from '../services/eloverblik';
import { colors } from '../styles/theme';
import { usageToday } from '../utils/usagePeriods';
import { midnight } from '../services/consumption-data.mjs';

type Props = { data: ElectricityUsage | null; currentMonthDays: ElectricityUsage | null; previousMonthDays: ElectricityUsage | null; loading: boolean; error: string; agreements: ElectricityAgreement[]; gridSupplier: GridSupplier };
const number = (value: number, digits = 0) => new Intl.NumberFormat('da-DK', { maximumFractionDigits: digits }).format(value);
const monthFormatter = new Intl.DateTimeFormat('da-DK', { month: 'long', timeZone: 'Europe/Copenhagen' });
const dateFormatter = new Intl.DateTimeFormat('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Europe/Copenhagen' });
const monthName = (at: string) => monthFormatter.format(new Date(at));
const localDate = (at: string) => dateFormatter.format(new Date(at));
const localMonth = (at: string) => localDate(at).slice(0, 7);
const firstOfMonth = (date: string, offset: number) => {
  const value = new Date(`${date.slice(0, 7)}-01T12:00:00Z`);
  value.setUTCMonth(value.getUTCMonth() + offset);
  return value.toISOString().slice(0, 10);
};

export function MonthlyUsageCard({ data, currentMonthDays, previousMonthDays, loading, error, agreements, gridSupplier }: Props) {
  const currentStart = firstOfMonth(usageToday(), -1);
  const liveStart = firstOfMonth(usageToday(), 0);
  const [snapshot,setSnapshot]=useState<{key:string;prices:PricePoint[]}>({key:'',prices:[]});
  const priceKey=`${gridSupplier.area}:${gridSupplier.id}:${currentStart}`;
  const prices=snapshot.key===priceKey?snapshot.prices:[];
  useEffect(() => {
    let active = true;
    setSnapshot({key:priceKey,prices:[]});
    void fetchHistoricalPrices(gridSupplier.area, gridSupplier.id, midnight(currentStart), midnight(firstOfMonth(currentStart, 1)))
      .then(result => { if (active) setSnapshot({key:priceKey,prices:result}); }).catch(() => {});
    return () => { active = false; };
  }, [currentStart, gridSupplier.area, gridSupplier.id]);

  const current = data?.points.find(point => localMonth(point.at) === currentStart.slice(0, 7));
  const currentKwh = current?.kwh;
  const usable = currentKwh !== null && currentKwh !== undefined && !current?.incomplete && data?.meterCount;
  const comparison = useMemo(() => {
    if (!currentMonthDays?.meterCount || !previousMonthDays?.meterCount) return null;
    const live = new Map(currentMonthDays.points.map(point => [localDate(point.at), point]));
    const prior = new Map(previousMonthDays.points.map(point => [localDate(point.at), point]));
    const lastCompleteDay = Math.min(Number(usageToday().slice(-2)) - 1, (Date.parse(`${liveStart}T12:00:00Z`) - Date.parse(`${currentStart}T12:00:00Z`)) / 86400000);
    let days = 0, liveKwh = 0, priorKwh = 0;
    for (let day = 1; day <= lastCompleteDay; day++) {
      const suffix = String(day).padStart(2, '0');
      const thisDay = live.get(`${liveStart.slice(0, 7)}-${suffix}`);
      const lastMonthDay = prior.get(`${currentStart.slice(0, 7)}-${suffix}`);
      if (!thisDay || !lastMonthDay || thisDay.kwh === null || lastMonthDay.kwh === null || thisDay.incomplete || lastMonthDay.incomplete) break;
      days++; liveKwh += thisDay.kwh; priorKwh += lastMonthDay.kwh;
    }
    return days ? { days, difference: liveKwh - priorKwh, percentage: priorKwh ? (liveKwh - priorKwh) / priorKwh * 100 : liveKwh === 0 ? 0 : null } : null;
  }, [currentMonthDays, previousMonthDays, currentStart, liveStart]);
  const percentage = comparison?.percentage ?? null;
  const difference = comparison?.difference ?? null;
  const badgeTone = percentage !== null && percentage > 5
    ? { backgroundColor: '#FCE8E6', color: '#B94138', icon: 'arrow-up-right' as const }
    : percentage !== null && percentage < -5
      ? { backgroundColor: '#E5F3E8', color: '#28783D', icon: 'arrow-down-right' as const }
      : { backgroundColor: colors.primarySoft, color: colors.primary, icon: 'minus' as const };
  const monthComparison = `${monthName(`${liveStart}T12:00:00Z`).slice(0, 3)}–${monthName(`${currentStart}T12:00:00Z`).slice(0, 3)}`;
  // Group public prices once, independently of arriving household readings.
  const priceDays = useMemo(() => {
    const start = Date.parse(midnight(currentStart));
    const end = Date.parse(midnight(firstOfMonth(currentStart, 1)));
    const grouped = new Map<string, { count: number; total: number; grid: number }>();
    for (const price of prices) {
      const at = price.startsAt.getTime();
      if (at < start || at >= end) continue;
      const date = dateFormatter.format(price.startsAt);
      const day = grouped.get(date) ?? { count: 0, total: 0, grid: 0 };
      day.count++; day.total += price.totalOrePerKwh; day.grid += price.gridAndTaxOrePerKwh;
      grouped.set(date, day);
    }
    return grouped;
  }, [prices, currentStart]);
  const estimate = useMemo(() => {
    if (!usable || !priceDays.size) return null;
    const days = (Date.parse(`${firstOfMonth(currentStart, 1)}T12:00:00Z`) - Date.parse(`${currentStart}T12:00:00Z`)) / 86400000;
    const priceCount = [...priceDays.values()].reduce((sum, day) => sum + day.count, 0);
    if (priceCount < (days * 24 - 1) * 0.95) return null;
    const dayReadings = new Map(previousMonthDays?.points.map(point => [localDate(point.at), point]) ?? []);
    const allDaysComplete = Array.from({ length: days }, (_, index) => {
      const date = new Date(Date.parse(`${currentStart}T12:00:00Z`) + index * 86400000).toISOString().slice(0, 10);
      const point = dayReadings.get(date);
      return !!point && point.kwh !== null && !point.incomplete;
    }).every(Boolean);
    const orderedAgreements = [...agreements].sort((a, b) => b.date_from.localeCompare(a.date_from));
    const latest = orderedAgreements.find(item => !item.date_to) ?? orderedAgreements[0];
    let total = 0;
    for (let index = 0; index < days; index++) {
      const date = new Date(Date.parse(`${currentStart}T12:00:00Z`) + index * 86400000).toISOString().slice(0, 10);
      const agreement = orderedAgreements.find(item => item.date_from <= date && (!item.date_to || date < item.date_to)) ?? latest;
      if (!agreement) return null;
      const dailyPrices = priceDays.get(date);
      if (!dailyPrices || dailyPrices.count < 20) return null;
      const orePerKwh = agreement.price_type === 'fixed'
        ? dailyPrices.grid / dailyPrices.count + Number(agreement.fixed_ore) + Number(agreement.markup_ore)
        : dailyPrices.total / dailyPrices.count + Number(agreement.markup_ore);
      const subscription = Number(agreement.subscription_dkk);
      if (!Number.isFinite(orePerKwh) || !Number.isFinite(subscription)) return null;
      const kwh = allDaysComplete ? dayReadings.get(date)!.kwh! : currentKwh! / days;
      total += kwh * orePerKwh / 100 + subscription / days;
    }
    return total;
  }, [usable, currentKwh, currentStart, agreements, priceDays, previousMonthDays]);

  return <View style={[s.card, { backgroundColor: colors.white }]}>
    <View style={s.top}>
      <Text style={s.label}>Samlet forbrug i {monthName(`${currentStart}T12:00:00Z`)}</Text>
      {percentage !== null ? <View style={[s.badge, { backgroundColor: badgeTone.backgroundColor }]}><AppIcon name={badgeTone.icon} size={14} color={badgeTone.color} /><Text style={[s.badgeText, { color: badgeTone.color }]}>{monthName(`${liveStart}T12:00:00Z`).slice(0, 3)} {Math.round(percentage) > 0 ? '+' : ''}{Math.round(percentage)} %</Text></View> : null}
    </View>
    {usable ? <View style={s.totalRow}><AnimatedMetric style={s.total} value={number(currentKwh!,1)}/><Text style={s.unit}>kWh</Text></View>
      : loading ? <LoadingState label="Henter månedens forbrug…" />
      : <Text style={s.missing}>Månedens målinger er endnu ikke komplette.</Text>}
    {usable ? <View style={s.details}>
      <View style={s.detailColumn}><Text style={s.detailLabel}>Estimeret pris</Text><Text style={s.price}>{estimate === null ? '—' : number(estimate)} <Text style={s.priceUnit}>kr.</Text></Text></View>
      <View style={s.detailColumn}><Text style={s.detailLabel}>{monthComparison} · 1.–{comparison?.days ?? '…'}.</Text><Text style={s.comparison}>{difference === null ? 'Afventer målinger' : difference === 0 ? 'Samme forbrug' : `${number(Math.abs(difference), 1)} kWh ${difference < 0 ? 'mindre' : 'mere'}`}</Text></View>
    </View> : null}
    {error && !usable ? <Text style={s.error}>{error}</Text> : null}
  </View>;
}

const s = StyleSheet.create({
  card: cardStyles.card,
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap:'wrap', gap: 12 },
  label: {...cardStyles.title,flex:1},
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.primarySoft, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: colors.primaryPressed },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 7, marginTop: 4 },
  total: cardStyles.metric,
  unit: { fontFamily: 'Nunito_700Bold', fontSize: 19, color: colors.ink },
  loading: { marginVertical: 20 },
  missing: {...cardStyles.note,marginTop:16},
  details: { flexDirection: 'row', gap:16, borderRadius: 17, backgroundColor: 'rgba(203,216,255,0.4)', padding: 14, marginTop: 18 },
  detailColumn: { flex: 1 },
  detailLabel: cardStyles.label,
  price: { fontFamily: 'Nunito_700Bold', color: colors.ink, fontSize: 23, marginTop: 2, letterSpacing: -0.5 },
  priceUnit: { fontFamily: 'Nunito_400Regular', fontSize: 12 },
  comparison: { fontFamily: 'Nunito_700Bold', color: colors.primaryPressed, fontSize: 13, lineHeight: 18, marginTop: 6 },
  error: { fontFamily: 'Nunito_400Regular', color: colors.coral, fontSize:12, marginTop: 8 },
});
