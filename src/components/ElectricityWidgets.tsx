import {GridSupplierSettings} from './GridSupplierSettings';
import {LoadingState} from './LoadingState';
import {AppText as Text} from './AppText';
import {AppModal as Modal} from './AppModal';
import {cardStyles} from '../styles/cards';
import {defaultPriceLimits,validPriceLimits,parsePriceLimit,priceLevel,priceLevelColor,priceWidgetHours} from '../utils/priceLimits';
import {PriceModeFields,priceModeNote} from './PriceModeFields';
import {PriceLimitFields} from './PriceLimitFields';
import {HapticPressable as Pressable} from './HapticPressable';
import { useEffect, useMemo, useState, type RefObject } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { AppIcon } from './AppIcon';
import { PriceChart, spotPriceCardStyle, spotPriceTitleStyle } from './PriceChart';
import { ElectricityUsageCard } from './ElectricityUsageCard';
import { HeatingUsageCard } from './HeatingUsageCard';
import { useEforsyning } from '../hooks/useEforsyning';
import { ResizableWidget } from './ResizableWidget';
import { colors, dkTime } from '../styles/theme';
import { fetchHistoricalPrices, type GridSupplier, type PricePoint } from '../prices';
import type { useElectricityUsage } from '../hooks/useElectricityUsage';
import type { useElectricityWidgets } from '../hooks/useElectricityWidgets';
import { cheapestWidgetHour, electricityWidgetIds, widgetUsageSummary, type ElectricityWidgetId, type WidgetPins } from '../utils/electricityWidgets';
import { estimateUsageTotals } from '../utils/usageTotalCost';
import { midnight } from '../services/consumption-data.mjs';
import { usageToday } from '../utils/usagePeriods';
import { DraggableWidgetList, WidgetTrackGrid, type WidgetDragScroll } from './DraggableWidgetList';
import { widgetGridGap, widgetGridRowHeight, type WidgetSpan } from '../utils/widgetDrag';
import { fixedSizeWidget, contrastRatio, defaultWidgetAppearance, widgetAppearanceColors, widgetBackgrounds, widgetSize, widgetSpan, widgetMinimumSpan, widgetMaximumRows, type WidgetAppearance } from '../utils/widgetAppearance';

const number = (n: number, digits = 1) => new Intl.NumberFormat('da-DK', { maximumFractionDigits: digits }).format(n);
const date = (at: string | number) => new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'long', timeZone: 'Europe/Copenhagen' }).format(new Date(at));
const definitions = {
  latest: { title: 'Seneste dags forbrug', icon: 'bar-chart-2' },
  month: { title: 'Denne måneds forbrug', icon: 'calendar' },
  price: { title: 'Strømpris lige nu', icon: 'zap' },
  cheapest: { title: 'Billigste kommende time', icon: 'clock' },
  budget: { title: 'Forbrugsbudget', icon: 'trending-up' },
  priceChart: { title: 'Elprisgraf', icon: 'bar-chart-2' },
  usageChart: { title: 'Forbrugsgraf', icon: 'bar-chart-2' },
  heatChart: { title: 'Varmeforbrug', icon: 'bar-chart-2' },
} as const;
const cleanTitles: Record<ElectricityWidgetId, string> = { latest: 'Seneste forbrug', month: 'Denne måned', price: 'Elpris nu', cheapest: 'Billigste time', budget: 'Månedsbudget', priceChart: 'Elprisgraf', usageChart: 'Forbrug · Eloverblik', heatChart: 'Varmeforbrug' };
type Card = { loading?: boolean; gridSupplier?: GridSupplier; priceDkk?:number; value: string; detail: string; note?: string; progress?: number; days?: { day: string; kwh: number | null }[]; status?: 'low' | 'medium' | 'high'; anchor?: string; prices?: PricePoint[]; now?: number; metric?: string; unit?: string; support?: string; warning?: string; consumption?: { state: ReturnType<typeof useElectricityUsage>; prices: PricePoint[]; supplier: GridSupplier } };
export type ElectricityWidgetData = Record<ElectricityWidgetId, Card>;

export function useElectricityWidgetData({ usage, prices, isSample, supplier, now, unit, limit, enabled, pricesLoading = false }: {
  usage: ReturnType<typeof useElectricityUsage>; prices: PricePoint[]; isSample: boolean; supplier: GridSupplier;
  now: number; unit: 'kwh' | 'dkk'; limit: number; enabled: boolean; pricesLoading?: boolean;
}): ElectricityWidgetData {
  const today = usageToday(now), month = today.slice(0, 7);
  const summary = useMemo(() => widgetUsageSummary(usage.currentMonthDays, usage.previousMonthDays, now), [usage.currentMonthDays, usage.previousMonthDays, today]);
  const from = summary.latest ? [usageToday(Date.parse(summary.latest.at)), `${month}-01`].sort()[0]! : `${month}-01`;
  const [historical, setHistorical] = useState<{ key: string; prices: PricePoint[] }>({ key: '', prices: [] });
  const key = `${supplier.area}:${supplier.id}:${from}:${today}`;
  useEffect(() => {
    if (!enabled || !summary.latest) return;
    let active = true;
    void fetchHistoricalPrices(supplier.area, supplier.id, midnight(from), midnight(today)).then(points => {
      if (active) setHistorical({ key, prices: points });
    }).catch(() => { /* Keep kWh visible when historical tariffs are unavailable. */ });
    return () => { active = false; };
  }, [enabled, key, !!summary.latest]);
  const tariffs = useMemo(()=>historical.key===key?historical.prices:[],[historical,key]);
  const cost = useMemo(()=>estimateUsageTotals(summary.days,'Day',usage.agreements.records,tariffs),[summary.days,usage.agreements.records,tariffs]);
  const latestCost = useMemo(()=>summary.latest?estimateUsageTotals([summary.latest],'Day',usage.agreements.records,tariffs).get(summary.latest.at):undefined,[summary.latest,usage.agreements.records,tariffs]);
  const monthCost = summary.days.length && summary.days.every(p => cost.has(p.at)) ? summary.days.reduce((sum, p) => sum + cost.get(p.at)! / 100, 0) : null;
  const priced = useMemo(()=>{const agreements=[...usage.agreements.records].sort((a,b)=>b.date_from.localeCompare(a.date_from));return isSample ? [] : prices.map(p => {
    const day = usageToday(+p.startsAt);
    const agreement = agreements.find(a => a.date_from <= day && (!a.date_to || day < a.date_to));
    return { ...p, agreementKnown: !!agreement, totalOrePerKwh: agreement ? (agreement.price_type === 'fixed' ? p.gridAndTaxOrePerKwh + Number(agreement.fixed_ore) : p.totalOrePerKwh) + Number(agreement.markup_ore) : p.totalOrePerKwh };
  }).sort((a,b)=>+a.startsAt-+b.startsAt);},[isSample,prices,usage.agreements.records]);
  const interval = priced.some(p => p.startsAt.getUTCMinutes() !== 0) ? 900000 : 3600000;
  const current = priced.find(p => +p.startsAt <= now && now < +p.startsAt + interval);
  const cheapest = useMemo(()=>cheapestWidgetHour(priced,now),[priced,now]);
  const unavailable = usage.connected === false ? 'Forbind Eloverblik under El' : usage.loading ? 'Henter gemte målinger…' : 'Afventer målinger fra Eloverblik';
  const budgetValue = unit === 'kwh' ? summary.total : monthCost;
  // Use the actual number of calendar days, also across short months.
  const daysInMonth = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).getUTCDate();
  const predicted = unit === 'kwh' ? summary.forecastKwh : summary.contiguous && monthCost !== null ? monthCost / Number(summary.through!.slice(-2)) * daysInMonth : null;
  const suffix = unit === 'kwh' ? 'kWh' : 'kr.';
  const result: ElectricityWidgetData = {
    heatChart: { value: '', detail: '' },
    usageChart: { value: '', detail: '', consumption: { state: usage, prices: isSample ? [] : prices, supplier } },
    priceChart: { gridSupplier: supplier, value: current ? `${number(current.totalOrePerKwh / 100, 2)} kr./kWh` : '—', detail: supplier.resolutionIssue??(isSample ? 'Aktuelle priser er utilgængelige' : 'Offentliggjorte elpriser'), prices: isSample ? [] : prices, now, note: 'Kilde: Energinet / Energi Data Service · CC BY 4.0 · inkl. net og afgifter' },
    latest: { value: summary.latest ? `${number(summary.latest.kwh!)} kWh` : '—', metric: summary.latest ? number(summary.latest.kwh!) : '—', unit: 'kWh', detail: summary.latest ? date(summary.latest.at) : unavailable, anchor: summary.latest ? usageToday(Date.parse(summary.latest.at)) : undefined, support: latestCost === undefined ? undefined : `Ca. ${number(latestCost / 100, 2)} kr.` },
    month: { value: summary.days.length ? `${number(summary.total)} kWh` : '—', metric: summary.days.length ? number(summary.total) : '—', unit: 'kWh', detail: summary.through ? `Til ${date(`${summary.through}T12:00:00Z`)}` : unavailable, support: monthCost === null ? undefined : `Ca. ${number(monthCost, 2)} kr.`, warning: summary.days.length && !summary.contiguous ? 'Data mangler' : undefined },
    price: { gridSupplier: supplier, priceDkk: current?current.totalOrePerKwh/100:undefined, value: current ? `${number(current.totalOrePerKwh / 100, 2)} kr./kWh` : '—', metric: current ? number(current.totalOrePerKwh / 100, 2) : '—', unit: 'kr./kWh', detail: current ? `Kl. ${dkTime.format(current.startsAt)}–${dkTime.format(new Date(+current.startsAt + interval))}` : 'Afventer elpris', support: current ? current.agreementKnown ? 'Inkl. net og afgifter' : 'Ekskl. leverandørtillæg' : undefined },
    cheapest: { value: cheapest ? `${dkTime.format(new Date(cheapest.start))}–${dkTime.format(new Date(cheapest.end))}` : '—', metric: cheapest ? `${dkTime.format(new Date(cheapest.start))}–${dkTime.format(new Date(cheapest.end))}` : '—', detail: cheapest ? date(cheapest.start) : 'Afventer kommende priser', support: cheapest ? `Ca. ${number(cheapest.ore / 100, 2)} kr./kWh` : undefined },
    budget: { value: summary.days.length && budgetValue !== null && limit > 0 ? `${unit === 'dkk' ? 'Ca. ' : ''}${number(budgetValue)} / ${number(limit)} ${suffix}` : '—', metric: summary.days.length && budgetValue !== null && limit > 0 ? `${unit === 'dkk' ? '≈ ' : ''}${number(budgetValue)}` : '—', unit: suffix, detail: limit > 0 ? `Af ${number(limit)} ${suffix}${summary.through ? ` · til ${Number(summary.through.slice(-2))}/${Number(summary.through.slice(5, 7))}` : ''}` : 'Vælg budget under Profil', support: predicted !== null && limit > 0 ? `Forventet ${number(predicted)} ${suffix}` : undefined, warning: summary.days.length && !summary.contiguous ? 'Data mangler' : predicted !== null && predicted > limit && limit > 0 ? 'Over budget ved månedsslut' : undefined, progress: summary.days.length && budgetValue !== null && limit > 0 ? Math.min(1, Math.max(0, budgetValue / limit)) : undefined },
  };
  const usagePending = !usage.error && !usage.connectionError && !usage.auth.authError && usage.connected !== false && (usage.loading || usage.connected === null || usage.auth.authLoading);
  for (const id of ['latest', 'month', 'budget'] as const) result[id].loading = !!usagePending && result[id].metric === '—';
  for (const id of ['priceChart', 'price', 'cheapest'] as const) result[id].loading = isSample && pricesLoading;
  return result;
}

export function WidgetsEntry({ onOpen }: { onOpen: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel="Åbn widgets" onPress={onOpen} style={s.entry}>
    <AppIcon name="grid" size={25} color={colors.primary} /><View style={s.grow}><Text style={s.title}>Widgets</Text><Text style={s.copy}>Vælg dine hurtige overblik</Text></View><AppIcon name="chevron-right" size={20} color={colors.primary} />
  </Pressable>;
}
function UsageChartWidget({ context, onScrubChange }: { context: NonNullable<Card['consumption']>; onScrubChange?: (active: boolean) => void }) {
  return <View testID="usage-widget-content" style={{width:'100%'}}><ElectricityUsageCard {...context.state} prices={context.prices} gridSupplier={context.supplier} gridSupplierName={context.supplier.name} widget onScrubChange={onScrubChange}/></View>;
}
function HeatingChartWidget({ onScrubChange }: { onScrubChange?: (active: boolean) => void }) {
  const heat = useEforsyning();
  const [scrubbing, setScrubbing] = useState(false);
  return <ScrollView nestedScrollEnabled scrollEnabled={!scrubbing} style={{ flex: 1, minHeight: 0 }}><HeatingUsageCard heat={heat} widget onScrubChange={active => { setScrubbing(active); onScrubChange?.(active); }} /></ScrollView>;
}
function WidgetCard({ id, data, children, preferences, preview, onHold, onScrubChange, span, rowHeight = widgetGridRowHeight, showControls = true, onSelect, onContentHeight }: { id: ElectricityWidgetId; data: ElectricityWidgetData; children?: React.ReactNode; preferences?: ReturnType<typeof useElectricityWidgets>; preview?: WidgetAppearance; onOpen?: () => void; onHold?: (event: { nativeEvent: { pageY: number; pageX: number } }) => void; onScrubChange?: (active: boolean) => void; span?: WidgetSpan; rowHeight?: number; showControls?: boolean; onSelect?: () => void; onContentHeight?:(height:number)=>void }) {
  const sourceCard = data[id];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<WidgetAppearance>(defaultWidgetAppearance);
  const [editorError, setEditorError] = useState('');
  const priceWidget=id==='priceChart'||id==='price';
  const fixedWidget=fixedSizeWidget(id);
  const storedAppearance=preview??preferences?.appearances?.[id]??defaultWidgetAppearance;
  const appearance=fixedWidget?{...storedAppearance,background:'default' as const,text:'auto' as const,size:'normal' as const}:storedAppearance;
  const limits=validPriceLimits(appearance.priceLimits)?appearance.priceLimits:defaultPriceLimits;
  const [cheapDraft,setCheapDraft]=useState(''),[expensiveDraft,setExpensiveDraft]=useState('');
  const rawCurrent=data.priceChart?.prices?.filter(p=>Math.floor(+p.startsAt/3600000)===Math.floor((data.priceChart?.now??Date.now())/3600000));
  const rawSpot=rawCurrent?.length?rawCurrent.reduce((sum,p)=>sum+p.priceDkkMwh,0)/rawCurrent.length/1000:undefined;
  const card=id==='price'&&appearance.priceMode==='spot'?{...sourceCard,value:rawSpot===undefined?'\u2014':number(rawSpot,2)+' kr./kWh',metric:undefined,priceDkk:sourceCard.priceDkk}:sourceCard;
  const palette = widgetAppearanceColors(appearance);
  const size = widgetSize(appearance), compact = fixedWidget?false:span ? span.rows < 24 : size !== 'normal', tiny = fixedWidget?false:span ? span.columns <= 6 : size === 'tiny';
  const miniChart = false;
  const fullChart = id === 'priceChart' && !miniChart;
  const snug = !!span && span.rows <= 18;
  const disabled = !preferences?.ready || preferences.saving;
  const save = async (reset: boolean) => {
    setEditorError('');
    const nextLimits={cheapBelow:parsePriceLimit(cheapDraft),expensiveFrom:parsePriceLimit(expensiveDraft)};
    if(priceWidget&&!reset&&!validPriceLimits(nextLimits)){setEditorError('Indtast to gyldige priser. Grænsen for dyr strøm skal være højere.');return;}
    const next=priceWidget?{...draft,background:'default' as const,text:'auto' as const,priceLimits:nextLimits}:draft;
    const saved = await preferences?.customize(id, reset ? null : next);
    if (saved) setEditing(false);
    else setEditorError('Tilpasningen kunne ikke gemmes. Prøv igen.');
  };
  const content = card.loading ? <LoadingState label={'Henter ' + cleanTitles[id].toLowerCase() + '…'} variant={fullChart ? 'chart' : 'card'} compact={!fullChart}/> : id !== 'priceChart' ? <View style={{ gap: 6 }}>
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} accessibilityLabel={card.value} style={{ fontFamily: 'Nunito_700Bold', fontSize: id === 'cheapest' ? 24 : tiny ? 28 : 32, lineHeight: id === 'cheapest' ? 30 : tiny ? 34 : 38, color: palette.text, flexShrink: 1 }}>{card.metric ?? card.value}</Text>
      {card.unit && card.metric !== '—' ? <Text style={{ fontFamily: 'Nunito_600SemiBold', fontSize: 12, color: palette.secondary }}>{card.unit}</Text> : null}
    </View>
    <View style={{ gap: 2 }}>
      {id==='price'&&card.priceDkk!==undefined?<Text style={{fontFamily:'Nunito_700Bold',fontSize:12,color:priceLevelColor(card.priceDkk,limits)}}>{({low:'Billig strøm',medium:'Normalpris',high:'Dyr strøm'})[priceLevel(card.priceDkk,limits)]}</Text>:null}
      <Text numberOfLines={2} style={{ fontFamily: 'Nunito_400Regular', fontSize: 12, lineHeight: 16, color: palette.secondary }}>{card.detail}</Text>
      {card.support && (!card.warning || id === 'budget') ? <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: 'Nunito_600SemiBold', fontSize: 12, lineHeight: 16, color: palette.text }}>{card.support}</Text> : null}
      {card.warning ? <Text numberOfLines={2} style={{ fontFamily: 'Nunito_600SemiBold', fontSize: 11, lineHeight: 14, color: palette.text }}>{card.warning}</Text> : null}
    </View>
    {card.progress !== undefined ? <View accessibilityLabel={`Budget brugt: ${Math.round(card.progress * 100)} procent`} style={{ height: 4, borderRadius: 2, backgroundColor: palette.track, overflow: 'hidden' }}><View style={{ height: 4, borderRadius: 2, backgroundColor: palette.accent, width: `${card.progress * 100}%` }} /></View> : null}
  </View> : <>
    {!(fullChart && card.prices?.length) ? <View style={s.row}>{card.status ? <View accessibilityLabel={card.status === 'low' ? 'Lav pris' : card.status === 'high' ? 'Høj pris' : 'Mellempris'} style={[s.statusDot, { backgroundColor: card.status === 'low' ? '#238454' : card.status === 'high' ? '#B42318' : '#B07900' }]} /> : null}<Text numberOfLines={span ? 1 : undefined} adjustsFontSizeToFit={!!span} minimumFontScale={0.75} style={[s.value, compact && s.compactValue, tiny && s.tinyValue, snug && { fontSize: 22, lineHeight: 28, flexShrink: 1 }, { color: palette.text }]}>{card.value}</Text></View> : null}
    {!fullChart || !card.prices?.length ? <Text numberOfLines={span ? 2 : undefined} style={[s.copy, tiny && s.tinyCopy, snug && { fontSize: 12, lineHeight: 16 }, { color: palette.secondary }]}>{card.detail}</Text> : null}
    {miniChart && card.prices?.length ? <View accessibilityLabel="Dagens elpriser" style={{height:40,flexDirection:'row',alignItems:'flex-end',gap:2}}>{priceWidgetHours(card.prices.filter(p=>usageToday(+p.startsAt)===usageToday(card.now??Date.now()))).map(point=><View key={point.at} style={{flex:1,minHeight:2,height:Math.max(2,Math.max(0,point.price)/Math.max(.01,...card.prices!.map(p=>Math.max(0,p.totalOrePerKwh/100)))*40),backgroundColor:priceLevelColor(point.price,limits),borderRadius:2}}/>)}</View>:null}

    {card.days?.length && !compact ? <View style={s.weekChart}>{card.days.map(day => {
      const maximum = Math.max(1, ...card.days!.map(item => item.kwh ?? 0));
      return <View key={day.day} accessible accessibilityLabel={`${date(`${day.day}T12:00:00Z`)}: ${day.kwh === null ? 'Mangler måling' : `${number(day.kwh)} kWh`}`} style={s.dayColumn}>
        <Text style={[s.dayValue, { color: palette.text }]}>{day.kwh === null ? '—' : number(day.kwh)}</Text>
        <View style={s.barSlot}><View style={{ width: '75%', height: day.kwh === null ? 2 : Math.max(2, day.kwh / maximum * 60), backgroundColor: palette.accent, opacity: day.kwh === null ? .3 : 1, borderRadius: 4 }} /></View>
        <Text style={[s.dayValue, { color: palette.secondary }]}>{Number(day.day.slice(-2))}/{Number(day.day.slice(5, 7))}</Text>
      </View>;
    })}</View> : null}
    {card.progress !== undefined ? <View style={[s.track, { backgroundColor: palette.track }]}><View style={[s.fill, { backgroundColor: palette.accent, width: `${card.progress * 100}%` }]} /></View> : null}
    {!span && !priceWidget && card.note ? <Text style={[s.note, tiny && s.tinyNote, { color: palette.secondary }]}>{card.note}</Text> : null}
    {span && card.note?.includes('mangler') ? <Text numberOfLines={1} style={[s.note, snug && { fontSize: 10, lineHeight: 12 }, { color: palette.secondary }]}>Ufuldstændige data</Text> : null}
    {span && card.note?.includes('ekskl. leverandørtillæg') ? <Text numberOfLines={1} style={[s.tinyNote, { color: palette.secondary }]}>Ekskl. leverandørtillæg</Text> : null}
  </>;
  return <View testID={`electricity-widget-${id}`} style={[s.card, ['usageChart', 'heatChart'].includes(id) && !span && { height: id === 'heatChart' ? 632 : 472 }, compact && s.compactCard, tiny && s.tinyCard, { backgroundColor: palette.background }, span && { height: span.rows * rowHeight + (span.rows - 1) * widgetGridGap, marginBottom: 0, overflow: 'hidden', padding: snug ? 10 : 14, gap: snug ? 4 : 8 }, id !== 'priceChart' && { padding: fixedWidget ? 20 : 16, gap: 8, borderRadius: 24, ...(!span ? { marginBottom: 16 } : {}) }, fullChart && spotPriceCardStyle, fullChart && span && {marginBottom:0}]}><View onLayout={event=>onContentHeight?.(event.nativeEvent.layout.height+(fullChart||fixedWidget?40:32))} style={{gap:fullChart?0:8}}><Pressable accessibilityRole={onHold ? 'button' : undefined} accessibilityLabel={onHold ? `Hold for at flytte ${definitions[id].title}` : undefined} delayLongPress={350} onLongPress={onHold} style={[s.row, tiny && s.tinyRow, span && showControls && !fullChart && { paddingLeft: 32, paddingRight: 24 }, span && onSelect && !showControls && !fullChart && { paddingRight: 24 }]}><Text numberOfLines={span ? 1 : undefined} style={[s.title, s.grow, tiny && s.tinyTitle, snug && { fontSize: 12, lineHeight: 16 }, id !== 'priceChart' && {fontSize:['usageChart','heatChart'].includes(id)?18:14,lineHeight:['usageChart','heatChart'].includes(id)?24:20}, { color: palette.text }, fullChart && spotPriceTitleStyle]}>{fullChart ? 'Elpriser' : cleanTitles[id]}</Text>
    {preferences && id!=='usageChart' && (showControls || onSelect) ? <Pressable accessibilityRole="button" accessibilityLabel={`${showControls ? 'Tilpas' : 'Rediger'} ${definitions[id].title}`} disabled={disabled} onPress={event => { event.stopPropagation(); if (!showControls && !priceWidget) { onSelect?.(); return; } setDraft(appearance); setCheapDraft(String(limits.cheapBelow).replace('.',',')); setExpensiveDraft(String(limits.expensiveFrom).replace('.',',')); setEditorError(''); setEditing(true); }} style={span ? { position: 'absolute', right: -10, top: -10, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', zIndex: 2 } : s.customize}><AppIcon name="sliders" size={fullChart ? 17 : 16} color={palette.accent} /></Pressable> : null}</Pressable>
    {id === 'heatChart' ? <HeatingChartWidget onScrubChange={onScrubChange} /> : id === 'usageChart' && card.consumption ? <UsageChartWidget context={card.consumption} onScrubChange={onScrubChange} /> : fullChart && card.prices?.length ? null : <View style={[s.widgetContent, tiny && s.tinyContent, snug && { gap: 4 }]}>{content}</View>}
    {id==='price' && card.gridSupplier ? <Text style={[s.note,{marginTop:0}]}>Netselskab: {card.gridSupplier.id ? (card.gridSupplier.companyName || card.gridSupplier.name) : 'Ikke afklaret'}</Text> : null}
    {id==='price'?<Text style={[s.note,{marginTop:0}]}>{appearance.priceMode==='spot'?priceModeNote('spot'):'Inkl. moms, afgifter og nettariffer. Uden abonnement.'}</Text>:null}
    {fullChart && card.prices?.length ? <View style={[{ backgroundColor: colors.white, borderRadius: 16, padding: 0 }, span && { flexGrow: 0, flexShrink: 0 }]}><PriceChart gridSupplier={card.gridSupplier} priceMode={appearance.priceMode??"total"} priceLimits={limits} points={card.prices} now={card.now ?? Date.now()} compact={false} minimal={false} onScrubChange={onScrubChange} /></View> : null}{children}
    {editing && preferences ? <Modal visible transparent animationType="fade" onRequestClose={() => { if (!preferences.saving) setEditing(false); }}>
      <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':'height'} style={s.backdrop}><View style={s.editor} accessibilityViewIsModal>
        <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets contentContainerStyle={s.editorContent}>
          <View style={s.row}><Text style={[s.title, s.grow]}>Tilpas widget</Text><Pressable accessibilityRole="button" accessibilityLabel="Luk tilpasning" disabled={preferences.saving} onPress={() => setEditing(false)} style={s.customize}><AppIcon name="x" size={20} color={colors.ink} /></Pressable></View>
          {!fixedWidget?<>
          <View style={{ width: widgetSpan(id, draft).columns <= 6 ? '48%' : '100%' }}><WidgetCard id={id} data={data} preview={draft} span={widgetSpan(id, draft)} rowHeight={rowHeight} /></View>
          <Text style={s.title}>Størrelse</Text><View style={s.actions}>{(['normal', 'medium', 'tiny'] as const).map(size => <Pressable key={size} accessibilityRole="radio" accessibilityLabel={`${size === 'normal' ? 'Normal' : size === 'medium' ? 'Medium' : 'Mini'} widget`} accessibilityState={{ checked: widgetSize(draft) === size }} disabled={preferences.saving} onPress={() => setDraft({ ...draft, size, columns: undefined, rows: undefined })} style={[s.action, widgetSize(draft) === size && s.selected]}><Text style={[s.actionText, widgetSize(draft) === size && s.selectedText]}>{size === 'normal' ? 'Normal' : size === 'medium' ? 'Medium' : 'Mini'}</Text></Pressable>)}</View>
          <Text style={s.note}>Hold på widgetten, og træk i hjørnet for at tilpasse størrelsen.</Text>
          </>:null}
          {priceWidget?<><GridSupplierSettings current={card.gridSupplier}/><PriceModeFields value={draft.priceMode??"total"} onChange={priceMode=>setDraft({...draft,priceMode})} disabled={preferences.saving}/><PriceLimitFields cheap={cheapDraft} expensive={expensiveDraft} onCheap={setCheapDraft} onExpensive={setExpensiveDraft} disabled={preferences.saving}/></>:<>
          <Text style={s.title}>Baggrundsfarve</Text>
          <View style={s.swatches}>{widgetBackgrounds.map(background => <Pressable key={background.id} accessibilityRole="radio" accessibilityLabel={background.label} accessibilityState={{ checked: draft.background === background.id }} disabled={preferences.saving} onPress={() => setDraft({ ...draft, background: background.id, text: 'auto' })} style={[s.swatch, { backgroundColor: background.color, borderColor: draft.background === background.id ? colors.primary : colors.line }]}>{draft.background === background.id ? <AppIcon name="check" size={22} color={widgetAppearanceColors({ background: background.id, text: 'auto' }).text} /> : null}</Pressable>)}</View>
          <Text style={s.title}>Tekstfarve</Text>
          <View style={s.actions}>{(['auto', 'dark', 'white'] as const).map(text => {
            const legible = text === 'auto' || contrastRatio(widgetAppearanceColors(draft).background, text === 'white' ? '#FFFFFF' : colors.ink) >= 4.5;
            const selected = draft.text === text;
            return <Pressable key={text} accessibilityRole="radio" accessibilityLabel={text === 'auto' ? 'Automatisk tekstfarve' : text === 'dark' ? 'Mørk tekst' : 'Hvid tekst'} accessibilityState={{ checked: selected, disabled: !legible || preferences.saving }} disabled={!legible || preferences.saving} onPress={() => setDraft({ ...draft, text })} style={[s.action, selected && s.selected, !legible && s.unavailable]}><Text style={[s.actionText, selected && s.selectedText]}>{text === 'auto' ? 'Automatisk' : text === 'dark' ? 'Mørk' : 'Hvid'}</Text></Pressable>;
          })}</View>
          <Text style={s.note}>Automatisk vælger en læsbar tekstfarve. Farverne bruges på både Overblik og El.</Text>
          </>}
          {editorError ? <Text accessibilityRole="alert" style={s.error}>{editorError}</Text> : null}
          <View style={s.actions}><Pressable accessibilityRole="button" disabled={preferences.saving} onPress={() => void save(false)} style={[s.action, s.selected]}><Text style={[s.actionText, s.selectedText]}>{preferences.saving ? 'Gemmer…' : 'Gem tilpasning'}</Text></Pressable>
            <Pressable accessibilityRole="button" disabled={preferences.saving} onPress={() => void save(true)} style={s.action}><Text style={s.actionText}>Gendan standard</Text></Pressable></View>
          <Text style={s.note}>{priceWidget?'Gendan standard nulstiller dine prisgrænser.':'Gendan standard nulstiller farver og størrelse.'}</Text>
        </ScrollView>
      </View></KeyboardAvoidingView>
    </Modal> : null}
  </View></View>;
}
export function PinnedElectricityWidgets({ location, preferences, data, onManage, onOpen, onDragChange, dragScroll, onScrubChange, dismissRef }: { location: keyof WidgetPins; preferences: ReturnType<typeof useElectricityWidgets>; data: ElectricityWidgetData; onManage: () => void; onOpen?: (id: ElectricityWidgetId, anchor?: string) => void; onDragChange?: (active: boolean) => void; dragScroll?: WidgetDragScroll; onScrubChange?: (active: boolean) => void; dismissRef?: RefObject<(() => void) | null> }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [gridWidth, setGridWidth] = useState(0);
  const [contentHeights,setContentHeights]=useState<Record<string,number>>({});
  const [dragging, setDragging] = useState(false);
  const [resize, setResize] = useState<{ key: string; id: string; span: WidgetSpan } | null>(null);
  const { fontScale = 1 } = useWindowDimensions();
  const rowHeight = Math.ceil((widgetGridRowHeight + widgetGridGap) * fontScale) - widgetGridGap;
  const dashboardGrid = location === 'dashboard';
  const spans = (id: string) => fixedSizeWidget(id)&&contentHeights[`${preferences.key}:${id}:${gridWidth}:${fontScale}`] ? {columns:12,rows:Math.ceil((contentHeights[`${preferences.key}:${id}:${gridWidth}:${fontScale}`]!+widgetGridGap)/(rowHeight+widgetGridGap))} : resize && resize.key === preferences.key && resize.id === id ? resize.span : widgetSpan(id as ElectricityWidgetId, preferences.appearances?.[id as ElectricityWidgetId]);
  const ids = location === 'electricity' ? preferences.pins[location].filter(id => !['price','priceChart','cheapest','usageChart','month'].includes(id)) : preferences.pins[location];
  const canReorder = location === 'dashboard' && ids.length > 0;
  const disabled = !preferences.ready || preferences.saving;
  const dismiss = () => { if (!dragging && !resize) setSelectedId(null); };
  useEffect(() => { if (dismissRef) dismissRef.current = dismiss; return () => { if (dismissRef) dismissRef.current = null; }; }, [dismissRef, dragging, resize]);
  useEffect(() => { setSelectedId(null); }, [preferences.key]);
  const renderDashboardCard = (id: string, onHold?: (event: { nativeEvent: { pageY: number; pageX: number } }) => void) => <View key={`${preferences.key}:${id}`} style={{ width: '100%', height: '100%' }} onTouchStart={event => { if (selectedId === id) event.stopPropagation(); }}><ResizableWidget label={id} resizable={!fixedSizeWidget(id)} enabled={selectedId === id} disabled={disabled || dragging || !!resize && resize.id !== id} span={spans(id)} minimum={widgetMinimumSpan(id as ElectricityWidgetId)} maximumRows={widgetMaximumRows(id as ElectricityWidgetId)} width={gridWidth} rowHeight={rowHeight}
    onRemove={async () => { const removed = await preferences.toggle(location, id as ElectricityWidgetId); if (removed) setSelectedId(null); }}
    onPreview={next => { setResize(next ? { key: preferences.key, id, span: next } : null); onDragChange?.(!!next); }}
    onCommit={next => preferences.customize(id as ElectricityWidgetId, { ...(preferences.appearances?.[id as ElectricityWidgetId] ?? defaultWidgetAppearance), columns: next.columns, rows: next.rows, gridVersion: 3 })}>
    <WidgetCard id={id as ElectricityWidgetId} data={data} preferences={preferences} span={spans(id)} rowHeight={rowHeight} showControls={selectedId === id} onSelect={() => setSelectedId(id)} onHold={onHold} onScrubChange={onScrubChange} onContentHeight={height=>{if(fixedSizeWidget(id)){const key=`${preferences.key}:${id}:${gridWidth}:${fontScale}`;setContentHeights(previous=>Math.abs((previous[key]??0)-height)<1?previous:{...previous,[key]:height});}}}/>
  </ResizableWidget></View>;
  if (!ids.length) return null;
  return <View onTouchStart={dismiss} onLayout={event => setGridWidth(event.nativeEvent.layout.width)}>{location!=='dashboard'?<View style={[s.row, s.heading]}><View style={s.grow} />
    <Pressable accessibilityRole="button" accessibilityLabel="Tilføj widgets" onPress={onManage} style={s.manage}><AppIcon name="plus" size={20} color={colors.primary} /></Pressable>
    </View>:null}
    {preferences.error ? <Text accessibilityRole="alert" style={s.error}>{preferences.error}</Text> : null}
    {canReorder ? <DraggableWidgetList key={preferences.key} ids={ids} disabled={disabled || !!resize} scroll={dragScroll} onDragChange={active => { setDragging(active); onDragChange?.(active); }}
      gridSpans={dashboardGrid ? spans : undefined} rowHeight={rowHeight}
      onHold={setSelectedId} selectedId={selectedId}
      isTiny={id => !fixedSizeWidget(id) && widgetSize(preferences.appearances?.[id as ElectricityWidgetId]) === 'tiny'}
      label={id => definitions[id as ElectricityWidgetId].title}
      onActivate={id => { if (selectedId && selectedId !== id) dismiss(); }}
      handleOnly={id => ['priceChart', 'usageChart', 'heatChart'].includes(id)}
      renderCard={renderDashboardCard}
      onReorder={order => preferences.reorder(location, order as ElectricityWidgetId[])} />
      : dashboardGrid ? <WidgetTrackGrid ids={ids} spans={spans} rowHeight={rowHeight} renderCard={renderDashboardCard} />
      : <View style={s.grid}>{ids.map(id => <View key={`${preferences.key}:${id}`} style={{ width: !fixedSizeWidget(id) && !['usageChart', 'heatChart'].includes(id) && widgetSize(preferences.appearances?.[id]) === 'tiny' ? '48%' : '100%' }}><WidgetCard id={id} data={data} preferences={preferences} onScrubChange={onScrubChange} /></View>)}</View>}
  </View>;
}
export function ElectricityWidgetsPage({ preferences, data }: { preferences: ReturnType<typeof useElectricityWidgets>; data: ElectricityWidgetData }) {
  return <View><Text style={s.pageTitle}>Widgets</Text><Text style={[s.copy, s.heading]}>Vælg de overblik, du vil have på forsiden.</Text>
    {preferences.error ? <Text accessibilityRole="alert" style={s.error}>{preferences.error}</Text> : null}
    {electricityWidgetIds.map(id => <WidgetCard key={`${preferences.key}:${id}`} id={id} data={data} preferences={preferences}><View style={s.actions}>
      {(['dashboard', 'electricity'] as const).filter(location => location !== 'electricity' || !['price','priceChart','cheapest','usageChart','month'].includes(id)).map(location => {
        const selected = preferences.pins[location].includes(id), label = location === 'dashboard' ? 'Overblik' : 'El';
        return <Pressable key={location} accessibilityRole="checkbox" accessibilityLabel={`${definitions[id].title} på ${label}`} accessibilityState={{ checked: selected, disabled: !preferences.ready || preferences.saving }} disabled={!preferences.ready || preferences.saving} onPress={() => void preferences.toggle(location, id)} style={[s.action, selected && s.selected]}><AppIcon name={selected ? 'check' : 'plus'} size={16} color={selected ? colors.white : colors.primary} /><Text style={[s.actionText, selected && s.selectedText]}>{label}</Text></Pressable>;
      })}
    </View></WidgetCard>)}
    <Text style={s.note}>Dine valg gemmes på denne enhed. Forbrug vises med den faktiske dato fra Eloverblik.</Text>
  </View>;
}
const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start' },
  tinyCard: { padding: 12, gap: 6, borderRadius:24 }, tinyContent: { gap: 6 }, tinyRow: { gap: 2 },
  tinyTitle: { fontSize: 12, lineHeight:18 }, tinyValue: { fontSize: 18 }, tinyCopy: { fontSize: 12, lineHeight:18 }, tinyNote: { fontSize:12, lineHeight:18 },
  compactCard: { padding: 16, gap: 4 }, compactValue: { fontSize: 22 }, widgetContent: { gap: 10 },
  statusDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: '#FFFFFF' },
  weekChart: { flexDirection: 'row', gap: 4, marginTop: 6 }, dayColumn: { flex: 1, alignItems: 'center', gap: 5 },
  dayValue: { fontFamily: 'Nunito_400Regular', fontSize:12 }, barSlot: { height: 60, width: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  customize: { minHeight:48, minWidth: 44, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 },
  editor: { backgroundColor: colors.paper, borderRadius: 24, maxHeight: '90%', width: '100%', maxWidth: 520, alignSelf: 'center' },
  editorContent: { padding: 20, gap: 14 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatch: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  unavailable: { opacity: .35 },
  entry: {...cardStyles.card,flexDirection:'row',alignItems:'center',gap:16,borderWidth:1,borderColor:colors.line},
  card: {...cardStyles.card,gap:12},
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 }, grow: { flex: 1 }, heading: { marginBottom: 20 },
  title: { fontFamily: 'Nunito_700Bold', fontSize: 16, color: colors.ink, flexShrink: 1 },
  pageTitle: { fontFamily: 'Nunito_600SemiBold', fontSize: 30, color: colors.ink, marginBottom: 8 },
  value: { fontFamily: 'Nunito_700Bold', fontSize: 28, color: colors.ink, flexShrink: 1 },
  copy: { fontFamily: 'Nunito_400Regular', fontSize: 14, lineHeight: 21, color: colors.muted },
  note: { fontFamily: 'Nunito_400Regular', fontSize: 12, lineHeight: 18, color: colors.muted },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  action: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 18, paddingHorizontal: 18, minHeight: 46, backgroundColor: colors.primarySoft },
  selected: { backgroundColor: colors.primary }, selectedText: { color: colors.white },
  actionText: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: colors.primary }, manage: { minHeight:48, justifyContent: 'center', paddingHorizontal: 12 },
  error: { fontFamily: 'Nunito_400Regular', color: colors.error, marginBottom: 16 },
  track: { height: 7, borderRadius: 4, backgroundColor: colors.primarySoft, overflow: 'hidden' }, fill: { height: 7, backgroundColor: colors.primary, borderRadius: 4 },
});
