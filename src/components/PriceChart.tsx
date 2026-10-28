import {chartPalette} from '../styles/chartPalette';
import {AppText as Text} from './AppText';
import {MotionView,AnimatedMetric} from './Motion';
import {cardStyles} from '../styles/cards';
import {PriceModeFields,priceModeNote,type PriceDisplayMode} from './PriceModeFields';
import {NegativePriceBar,NegativePriceSpark,negativePriceGold,GoldMotionProvider} from './NegativePriceBar';
import{ForecastPriceBar}from'./ForecastPriceBar';
import {HapticPressable as Pressable} from './HapticPressable';
import {defaultPriceLimits,type PriceLimits} from '../utils/priceLimits';
import { AppIcon } from './AppIcon';
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Linking, PanResponder, ScrollView, View } from "react-native";
import { PricePoint, type GridSupplier } from "../prices";
import{fetchPriceForecast,mergePriceForecast}from'../services/price-forecast';
import { dayKey, formatPrice } from "../utils/formatting";
import { colors, dkDay, dkTime } from "../styles/theme";
import { styles } from "../styles/appStyles";
import { useBarScrub } from '../hooks/useBarScrub';
import { tickSelection } from '../utils/barScrub';

export const spotPriceCardStyle = {...cardStyles.card,gap:0};
export const spotPriceTitleStyle = {...cardStyles.title,marginBottom:16};

export function PriceChart({ points, now, onScrubChange, compact = false, minimal = false, priceLimits = defaultPriceLimits, priceMode="total", onPriceModeChange, gridSupplier }: { points: PricePoint[]; now: number; gridSupplier?: GridSupplier; onScrubChange?: (isScrubbing: boolean) => void; compact?: boolean; minimal?: boolean; priceLimits?: PriceLimits;priceMode?:PriceDisplayMode;onPriceModeChange?:(mode:PriceDisplayMode)=>Promise<boolean>|void }) {
  const [settingsOpen,setSettingsOpen]=useState(false),[modeError,setModeError]=useState('');
  const [forecastInfoOpen,setForecastInfoOpen]=useState(false);
  const forecastKey=gridSupplier?.id?gridSupplier.area+':'+gridSupplier.id:'';
  const [forecast,setForecast]=useState<{key:string;points:PricePoint[];failed:boolean;loading:boolean}>({key:'',points:[],failed:false,loading:false});
  useEffect(()=>{
    let alive=true;
    if(!gridSupplier?.id)return;
    const supplier={id:gridSupplier.id,area:gridSupplier.area};
    setForecast(old=>({key:forecastKey,points:old.key===forecastKey?old.points:[],failed:false,loading:true}));
    void fetchPriceForecast(supplier).then(value=>{if(alive)setForecast({key:forecastKey,points:value.points,failed:false,loading:false});}).catch(()=>{if(alive)setForecast({key:forecastKey,points:[],failed:true,loading:false});});
    return()=>{alive=false;};
  },[forecastKey,Math.floor(now/(15*60000))]);
  const displayPoints=useMemo(()=>mergePriceForecast(points,forecast.key===forecastKey?forecast.points:[]),[points,forecast.points,forecast.key,forecastKey]);
  const allHours = useMemo(() => {
  const groups = new Map<string, PricePoint[]>();
  displayPoints.forEach((point) => {
    const key = `${dayKey(point.startsAt)}-${Math.floor(point.startsAt.getTime()/3600000)}`;
    groups.set(key, [...(groups.get(key) ?? []), point]);
  });
  return [...groups.values()].map((group) => ({
    startsAt: group[0]!.startsAt,
    endsAt: new Date(group[group.length - 1]!.startsAt.getTime() + (group[group.length-1]!.intervalMinutes??15) * 60 * 1000),
    forecast:group.some(p=>p.forecast===true),
    provisional:group.some(p=>p.forecastProvisional===true),
    lower:group.every(p=>Number.isFinite(p.forecastLowerOrePerKwh))?group.reduce((sum,p)=>sum+(priceMode==='spot'?(p.forecastLowerOrePerKwh!-p.gridAndTaxOrePerKwh)/1.25:p.forecastLowerOrePerKwh!),0)/group.length/100:null,
    upper:group.every(p=>Number.isFinite(p.forecastUpperOrePerKwh))?group.reduce((sum,p)=>sum+(priceMode==='spot'?(p.forecastUpperOrePerKwh!-p.gridAndTaxOrePerKwh)/1.25:p.forecastUpperOrePerKwh!),0)/group.length/100:null,
    totalPrice: group.reduce((sum,point)=>sum+point.totalOrePerKwh,0)/group.length/100,
    price: group.reduce((sum, point) => sum + (priceMode==='spot'?point.priceDkkMwh/10:point.totalOrePerKwh), 0) / group.length / 100,
  }));
  }, [displayPoints,priceMode]);
  const todayKey = dayKey(new Date(now));
  const availableDays = useMemo(() => [...new Set(allHours.map((item) => dayKey(item.startsAt)))]
    .filter((key) => key >= todayKey)
    .slice(0, 7), [allHours, todayKey]);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  useEffect(()=>{setSelectedDayIndex(index=>Math.max(0,Math.min(index,Math.max(0,availableDays.length-1))));},[availableDays.length]);
  const selectedDay = availableDays[Math.min(selectedDayIndex, availableDays.length - 1)];
  const hourly = useMemo(() => allHours.filter((item) => dayKey(item.startsAt) === selectedDay), [allHours, selectedDay]);
  const currentBarIndex = hourly.findIndex((item) => item.startsAt.getTime() <= now && item.endsAt.getTime() > now);
  const cheapestBarIndex = hourly.reduce((cheapestIndex, item, index) =>
    item.price < (hourly[cheapestIndex]?.price ?? Number.POSITIVE_INFINITY) ? index : cheapestIndex, 0);
  const [selectedIndex, setSelectedIndex] = useState(Math.max(0, currentBarIndex));
  const selectedIndexRef = useRef(selectedIndex);
  selectedIndexRef.current = selectedIndex;

  const showFullDay = true;
  const [chartViewportWidth, setChartViewportWidth] = useState(0);
  const [sliderWidth, setSliderWidth] = useState(0);
  const [isSliding, setIsSliding] = useState(false);

  const chartScrollRef = useRef<ScrollView>(null);
  const sliderTrackRef = useRef<View>(null);
  const sliderTrackPageX = useRef(0);
  const scrollXRef = useRef(0);
  const dragPageX = useRef<number | null>(null);
  const [scrollX, setScrollX] = useState(0);
  const padding = 8;
  const gap = showFullDay ? 2 : 3;
  const barWidth = showFullDay && chartViewportWidth > 0
    ? Math.max(1, (chartViewportWidth - padding * 2 - gap * (hourly.length - 1)) / Math.max(1, hourly.length))
    : 18;
  const stride = barWidth + gap;

  const selected = hourly[Math.min(selectedIndex, hourly.length - 1)];
  const plotPrices=hourly.map(item=>item.price);
  const maxPrice = Math.max(0, ...plotPrices);
  const minPrice = Math.min(0, ...plotPrices);
  const priceRange = Math.max(.001,maxPrice-minPrice), plotHeight=compact?48:94, zeroY=30+maxPrice/priceRange*plotHeight;
  const selectedDayDate = selected?.startsAt ?? new Date(`${selectedDay}T12:00:00`);
  const isForecastDay = hourly.some(item=>item.forecast);

  const changeDay = (nextIndex: number) => {
    const safeIndex = Math.max(0, Math.min(nextIndex, availableDays.length - 1));
    const nextDay = availableDays[safeIndex];
    const nextHours = allHours.filter((item) => dayKey(item.startsAt) === nextDay);
    const nextCurrentIndex = nextHours.findIndex((item) => item.startsAt.getTime() <= now && item.endsAt.getTime() > now);
    const nextCheapestIndex = nextHours.reduce((cheapestIndex, item, index) =>
      item.price < (nextHours[cheapestIndex]?.price ?? Number.POSITIVE_INFINITY) ? index : cheapestIndex, 0);
    setSelectedDayIndex(safeIndex);
    setSelectedIndex(nextCurrentIndex >= 0 ? nextCurrentIndex : nextCheapestIndex);
  };

  const scrollToBar = useCallback((index: number, animated = true) => {
    if (showFullDay || !chartViewportWidth || !hourly.length) return;
    const barCenter = padding + index * stride + barWidth / 2;
    const maxScroll = Math.max(0, hourly.length * stride - gap + padding * 2 - chartViewportWidth);
    const targetScrollX = Math.max(0, Math.min(maxScroll, barCenter - chartViewportWidth / 2));
    scrollXRef.current = targetScrollX;
    chartScrollRef.current?.scrollTo({ x: targetScrollX, animated });
  }, [showFullDay, chartViewportWidth, hourly.length, stride, barWidth, gap]);

  useEffect(() => {
    if (!chartViewportWidth) return;
    if (showFullDay) {
      scrollXRef.current = 0;
      setScrollX(0);
      chartScrollRef.current?.scrollTo({ x: 0, animated: true });
      return;
    }
    const initialIndex = Math.min(selectedIndexRef.current, hourly.length - 1);
    scrollToBar(initialIndex, true);
  }, [chartViewportWidth, cheapestBarIndex, currentBarIndex, selectedDayIndex, showFullDay, scrollToBar]);

  const selectHour = useCallback((index: number, scroll = true, feedback = false, initial = false) => {
    if (!hourly.length) return;
    const next = Math.max(0, Math.min(hourly.length - 1, index));
    if (feedback && (initial || selectedIndexRef.current !== next)) tickSelection();
    selectedIndexRef.current = next;
    setSelectedIndex(next);
    if (scroll) {
      scrollToBar(next, false);
    }
  }, [hourly.length, scrollToBar]);

  const updateFromPageX = useCallback((pageX: number) => {
    if (!hourly.length || sliderWidth <= 0) return;
    const xInTrack = Math.max(0, Math.min(sliderWidth, pageX - sliderTrackPageX.current));
    const nextIndex = Math.round((xInTrack + (showFullDay ? 0 : scrollXRef.current) - padding - barWidth / 2) / stride);
    selectHour(nextIndex, false, true);
  }, [hourly.length, sliderWidth, selectHour, showFullDay, barWidth, stride]);

  const barScrub = useBarScrub({ count: hourly.length, stride, inset: padding, viewportWidth: chartViewportWidth,
    contentWidth: hourly.length * stride - gap + padding * 2, scrollRef: chartScrollRef,
    onSelect: (index, initial) => selectHour(index, false, true, initial), onScrubChange });

  useEffect(() => {
    if (!isSliding || showFullDay || !sliderWidth) return;
    let frame: number;
    let previousTime = 0;
    const tick = (time: number) => {
      const elapsed = previousTime ? Math.min(time - previousTime, 50) / 1000 : 0;
      previousTime = time;
      if (dragPageX.current !== null) {
        const x = Math.max(0, Math.min(sliderWidth, dragPageX.current - sliderTrackPageX.current));
        const edge = Math.min(36, sliderWidth / 4);
        const direction = x < edge ? -(1 - x / edge) : x > sliderWidth - edge ? 1 - (sliderWidth - x) / edge : 0;
        const maxScroll = Math.max(0, hourly.length * stride - gap + padding * 2 - chartViewportWidth);
        const next = Math.max(0, Math.min(maxScroll, scrollXRef.current + direction * 150 * elapsed));
        if (next !== scrollXRef.current) {
          scrollXRef.current = next;
          setScrollX(next);
          chartScrollRef.current?.scrollTo({ x: next, animated: false });
          updateFromPageX(dragPageX.current);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isSliding, showFullDay, sliderWidth, hourly.length, stride, gap, chartViewportWidth, updateFromPageX]);

  useEffect(() => () => { onScrubChange?.(false); }, [onScrubChange]);

  const sliderPanResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,

      onPanResponderGrant: (evt) => {
        dragPageX.current = evt.nativeEvent.pageX;
        setIsSliding(true);
        onScrubChange?.(true);
        sliderTrackRef.current?.measureInWindow((x) => {
          if (typeof x === "number") {
            sliderTrackPageX.current = x;
            if (dragPageX.current !== null) updateFromPageX(dragPageX.current);
          }
        });
      },

      onPanResponderMove: (evt) => {
        dragPageX.current = evt.nativeEvent.pageX;
        updateFromPageX(evt.nativeEvent.pageX);
      },

      onPanResponderRelease: () => {
        dragPageX.current = null;
        setIsSliding(false);
        onScrubChange?.(false);
      },

      onPanResponderTerminate: () => {
        dragPageX.current = null;
        setIsSliding(false);
        onScrubChange?.(false);
      },

      onPanResponderTerminationRequest: () => false,
    });
  }, [updateFromPageX, onScrubChange]);

  const barColor = (price: number, selectedBar: boolean) => {
    if (price >= priceLimits.expensiveFrom) return selectedBar ? chartPalette.selectedExpensive : chartPalette.expensive;
    if (price >= priceLimits.cheapBelow) return selectedBar ? chartPalette.selectedNormal : chartPalette.normal;
    return selectedBar ? chartPalette.selectedCheap : chartPalette.cheap;
  };

  if(!hourly.length)return <View style={{paddingVertical:16}}><Text style={{color:colors.muted}}>Ingen aktuelle priser. Prøv igen senere.</Text></View>;
  const dotSize = 10;
  const dotLeft = padding + Math.min(selectedIndex, hourly.length - 1) * stride + barWidth / 2 - (showFullDay ? 0 : scrollX) - dotSize / 2;

  return (
    <GoldMotionProvider><MotionView key={selectedDay+priceMode} style={[styles.chartWrap, { flex: 0, justifyContent: "flex-start", marginTop: 0 }]}>
      {onPriceModeChange?<View style={{alignItems:"flex-end",position:"absolute",right:0,top:-64,zIndex:2}}><Pressable accessibilityRole="button" accessibilityLabel="Indstillinger for elpriser" onPress={()=>setSettingsOpen(v=>!v)} style={{width:48,height:48,alignItems:"center",justifyContent:"center"}}><AppIcon name="sliders" size={17} color={colors.primary}/></Pressable></View>:null}
      {settingsOpen&&onPriceModeChange?<PriceModeFields value={priceMode} onChange={mode=>{setModeError('');Promise.resolve(onPriceModeChange(mode)).then(ok=>{if(ok===false)setModeError('Kunne ikke gemmes. Pr\u00f8v igen.');}).catch(()=>setModeError('Kunne ikke gemmes. Prøv igen.'));}}/>:null}
      {modeError?<Text accessibilityRole="alert">{modeError}</Text>:null}
      <View style={[styles.dayNavigator, { minHeight: 48, marginBottom: 8, borderBottomWidth: 0 }]}>
        <Pressable
          accessibilityLabel="Forrige dag"
          disabled={selectedDayIndex === 0}
          onPress={() => changeDay(selectedDayIndex - 1)}
          style={[styles.dayArrow, selectedDayIndex === 0 && styles.dayArrowDisabled]}
        >
          <AppIcon name="chevron-left" size={20} color={colors.ink} />
        </Pressable>
        <View style={styles.dayNavigatorTitle}>
          <Text style={styles.dayNavigatorDate}>{dkDay.format(selectedDayDate)}</Text>
          <Text style={styles.dayNavigatorMeta}>{isForecastDay ? (hourly.some(item=>item.provisional)?"Prognose · under indkøring":"Prognose") : selectedDayIndex === 0 ? "I dag" : "Offentliggjort"} · {selectedDayIndex + 1} af {availableDays.length}</Text>
        </View>
        <Pressable
          accessibilityLabel="Næste dag"
          disabled={selectedDayIndex >= availableDays.length - 1}
          onPress={() => changeDay(selectedDayIndex + 1)}
          style={[styles.dayArrow, selectedDayIndex >= availableDays.length - 1 && styles.dayArrowDisabled]}
        >
          <AppIcon name="chevron-right" size={20} color={colors.ink} />
        </Pressable>
      </View>
      <View style={styles.chartSelection}>
        <View style={styles.chartSelectionHeader}>
          <Text style={styles.chartSelectionTime}>{selected ? `kl. ${dkTime.format(selected.startsAt)}` : ""}</Text>
          {hourly[cheapestBarIndex] ? <Text numberOfLines={1} style={{ color: colors.primary, fontSize: 11, marginLeft: 'auto' }}>Billigst kl. {dkTime.format(hourly[cheapestBarIndex].startsAt)}</Text> : null}
          {isSliding ? (
            <View style={styles.scrubBadge}>
              <Text style={styles.scrubBadgeText}>Vælger time</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.chartSelectionValue}>
          {selected?.forecast?<Text style={cardStyles.note}>Ca.</Text>:null}
          <AnimatedMetric fast={isSliding||barScrub.isScrubbing} style={styles.chartSelectionPrice} value={selected ? formatPrice(selected.price, 2) : "—"}/>
          <Text style={styles.chartSelectionUnit}>kr/kWh</Text>{selected&&selected.price<0?<Text style={{color:negativePriceGold,fontSize:11,fontWeight:"700"}}>Negativ pris ↓</Text>:null}
        </View>
      </View>
      <View
        ref={barScrub.viewportRef}
        collapsable={false}
        {...barScrub.panHandlers}
        onTouchEnd={barScrub.end}
        onTouchCancel={barScrub.end}
        style={[styles.barViewport, compact && { height: 106 }]}
        onLayout={(event) => {
          setChartViewportWidth(event.nativeEvent.layout.width);
        }}
      >
        <ScrollView
          ref={chartScrollRef}
          horizontal
          scrollEnabled={!showFullDay && !isSliding && !barScrub.isScrubbing}
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          onScroll={(event) => {
            scrollXRef.current = event.nativeEvent.contentOffset.x;
            barScrub.setScrollX(event.nativeEvent.contentOffset.x);
            setScrollX(event.nativeEvent.contentOffset.x);
          }}
          scrollEventThrottle={16}
          contentContainerStyle={[styles.barChart, compact && { height: 106 }, { paddingTop:0,paddingBottom:0,gap, paddingHorizontal: padding, width: hourly.length * stride - gap + padding * 2 }]}
        >
          {hourly.map((item, index) => {
            const selectedBar = index === selectedIndex;
            const currentBar = index === currentBarIndex;
            const cheapestBar = currentBarIndex < 0 && index === cheapestBarIndex;
            const negative=item.price<0;
            const height=Math.abs(item.price)/priceRange*plotHeight;
            const barStyle=[styles.bar,{position:"absolute" as const,top:negative?zeroY:zeroY-height,width:barWidth,height,backgroundColor:negative?negativePriceGold:barColor(item.totalPrice,currentBar||cheapestBar)},currentBar&&styles.currentBar,cheapestBar&&!negative&&styles.cheapestBar,selectedBar&&styles.selectedBar,negative&&{borderRadius:3}];
            return (
              <Pressable
                key={item.startsAt.toISOString()}
                accessibilityLabel={`${item.forecast?'Prognose, cirka ':''}${dkTime.format(item.startsAt)}, ${formatPrice(item.price, 2)} kroner per kilowatttime`}
                accessibilityHint="Hold og træk for at vælge andre timer"
                delayLongPress={25}
                onLongPress={event => barScrub.begin(index, event.nativeEvent.pageX)}
                onPress={() => { if (!barScrub.shouldIgnorePress()) selectHour(index, true, true); }}
                style={[
                  styles.barSlot,
                  { width: barWidth },
                ]}
              >
                {currentBar ? (
                  <View style={[styles.currentMarker, { top: 0, width: 28, left: (barWidth - 28) / 2, alignItems: 'center' }]}>
                    <Text numberOfLines={1} style={styles.currentMarkerText}>NU</Text>
                  </View>
                ) : null}
                <View testID="price-zero-line" pointerEvents="none" style={{position:"absolute",top:zeroY,left:-gap/2,width:barWidth+gap,height:1,backgroundColor:"#B6AFBF"}}/>
                {item.forecast?<ForecastPriceBar valueY={zeroY-item.price/priceRange*plotHeight} zeroY={zeroY} width={barWidth} color={negative?negativePriceGold:barColor(item.totalPrice,selectedBar||cheapestBar)} selected={selectedBar}/>:negative?<NegativePriceBar height={height} style={barStyle}/>:<View style={barStyle}/>}
                {negative?<><NegativePriceSpark top={zeroY-27} width={barWidth} index={index}/><Text accessibilityElementsHidden importantForAccessibility="no" style={{position:"absolute",top:zeroY-16,width:barWidth,textAlign:"center",fontSize:12,lineHeight:14,fontWeight:"700",color:negativePriceGold}}>−</Text></>:null}

              </Pressable>
            );
          })}
        </ScrollView>
        <View pointerEvents="none" style={{position:"absolute",bottom:0,left:0,right:0,height:22}}>{hourly.map((item,index)=>index % Math.max(1,Math.ceil(56/stride))===0?<Text key={index} style={[cardStyles.note,{position:"absolute",left:Math.max(0,Math.min(chartViewportWidth-48,padding+index*stride-16)),width:48,fontSize:11,lineHeight:18,textAlign:index===0?"left":"center"}]}>{dkTime.format(item.startsAt).replace('.',':')}</Text>:null)}</View>
      </View>

      {/* Draggable dot beneath the graph */}
      <View style={[styles.sliderWrapper, { marginHorizontal: 0, overflow: 'hidden' }]}>
        <View
          ref={sliderTrackRef}
          style={styles.sliderTouchArea}
          onLayout={(e) => {
            const width = e.nativeEvent.layout.width;
            setSliderWidth(width);
            sliderTrackRef.current?.measureInWindow((x) => {
              if (typeof x === "number") sliderTrackPageX.current = x;
            });
          }}
          {...sliderPanResponder.panHandlers}
        >
          <View
            pointerEvents="none"
            style={[
              styles.sliderDot,
              isSliding && styles.sliderDotActive,
              { left: dotLeft },
            ]}
          />
        </View>
      </View>
      <View style={{gap:4,paddingTop:12}}>
        <Text style={cardStyles.note}>Kilde: Energinet / Energi Data Service · CC BY 4.0</Text>
        {forecast.key===forecastKey&&forecast.points.length>0?<Pressable accessibilityRole="button" accessibilityLabel="Om prisprognosen og dens kilder" onPress={()=>setForecastInfoOpen(v=>!v)}><Text style={cardStyles.note}>Prognose: Elpriser.dk · ECMWF · CC BY 4.0 · Om</Text></Pressable>:null}
        {forecast.key===forecastKey&&forecast.failed?<Text style={cardStyles.note}>Prognosen er midlertidigt utilgængelig.</Text>:null}
        {forecastInfoOpen?<Text style={cardStyles.note}>Stribede søjler viser den forventede pris. Grøn, orange og rød følger dine prisgrænser. Prognosen kan ændre sig og erstattes af offentliggjorte priser. Spotprognose fra <Text accessibilityRole="link" onPress={()=>void Linking.openURL('https://elpriser.dk/data/').catch(()=>undefined)}>Elpriser.dk</Text>, tilpasset dit netselskabs tariffer. Baseret på ECMWF-data; ECMWF påtager sig intet ansvar for data, tilgængelighed eller brug. Licens: <Text accessibilityRole="link" onPress={()=>void Linking.openURL('https://creativecommons.org/licenses/by/4.0/').catch(()=>undefined)}>CC BY 4.0</Text>.</Text>:null}
        <Text style={cardStyles.note}>{priceMode==='spot'?'Spotpris · uden moms, afgifter og net':'Inkl. moms, net og afgifter · uden tillæg/abonnement'}</Text>
        {gridSupplier ? <Text style={cardStyles.note}>Netselskab: {gridSupplier.id ? (gridSupplier.companyName || gridSupplier.name) : 'Ikke afklaret'}{gridSupplier.id ? ' · '+gridSupplier.area : ''}{gridSupplier.evidenceSource==='Selvvalgt netselskab'?' \u00b7 Selvvalgt':''}</Text> : null}
      </View>
    </MotionView></GoldMotionProvider>
  );
}

