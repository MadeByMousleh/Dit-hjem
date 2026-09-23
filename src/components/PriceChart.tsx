import { Feather } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, Pressable, ScrollView, Text, View } from "react-native";
import { PricePoint } from "../prices";
import { dayKey, formatPrice } from "../utils/formatting";
import { colors, dkDay, dkTime } from "../styles/theme";
import { styles } from "../styles/appStyles";

export function PriceChart({ points, now, onScrubChange }: { points: PricePoint[]; now: number; onScrubChange?: (isScrubbing: boolean) => void }) {
  const allHours = useMemo(() => {
  const groups = new Map<string, PricePoint[]>();
  points.forEach((point) => {
    const key = `${dayKey(point.startsAt)}-${point.startsAt.getHours()}`;
    groups.set(key, [...(groups.get(key) ?? []), point]);
  });
  return [...groups.values()].map((group) => ({
    startsAt: group[0]!.startsAt,
    endsAt: new Date(group[group.length - 1]!.startsAt.getTime() + 15 * 60 * 1000),
    price: group.reduce((sum, point) => sum + point.totalOrePerKwh, 0) / group.length / 100,
  }));
  }, [points]);
  const todayKey = dayKey(new Date(now));
  const availableDays = useMemo(() => [...new Set(allHours.map((item) => dayKey(item.startsAt)))]
    .filter((key) => key >= todayKey)
    .slice(0, 7), [allHours, todayKey]);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const selectedDay = availableDays[Math.min(selectedDayIndex, availableDays.length - 1)];
  const hourly = useMemo(() => allHours.filter((item) => dayKey(item.startsAt) === selectedDay), [allHours, selectedDay]);
  const currentBarIndex = hourly.findIndex((item) => item.startsAt.getTime() <= now && item.endsAt.getTime() > now);
  const cheapestBarIndex = hourly.reduce((cheapestIndex, item, index) =>
    item.price < (hourly[cheapestIndex]?.price ?? Number.POSITIVE_INFINITY) ? index : cheapestIndex, 0);
  const [selectedIndex, setSelectedIndex] = useState(Math.max(0, currentBarIndex));
  const selectedIndexRef = useRef(selectedIndex);
  selectedIndexRef.current = selectedIndex;

  const [showFullDay, setShowFullDay] = useState(false);
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
  const maxPrice = Math.max(...hourly.map((item) => item.price), 2.25);
  const selectedDayDate = selected?.startsAt ?? new Date(`${selectedDay}T12:00:00`);
  const isForecastDay = selectedDayIndex > 1;

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

  const selectHour = useCallback((index: number, scroll = true) => {
    const next = Math.max(0, Math.min(hourly.length - 1, index));
    setSelectedIndex(next);
    if (scroll) {
      scrollToBar(next, false);
    }
  }, [hourly.length, scrollToBar]);

  const updateFromPageX = useCallback((pageX: number) => {
    if (!hourly.length || sliderWidth <= 0) return;
    const xInTrack = Math.max(0, Math.min(sliderWidth, pageX - sliderTrackPageX.current));
    const nextIndex = Math.round((xInTrack + (showFullDay ? 0 : scrollXRef.current) - padding - barWidth / 2) / stride);
    selectHour(nextIndex, false);
  }, [hourly.length, sliderWidth, selectHour, showFullDay, barWidth, stride]);

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
    if (price >= 2) return selectedBar ? "#B94F46" : "#E2B8B4";
    if (price >= 1.5) return selectedBar ? "#D9A62E" : "#F0DDA4";
    return selectedBar ? "#4E9B59" : "#B9D9BE";
  };

  const dotSize = 10;
  const dotLeft = padding + Math.min(selectedIndex, hourly.length - 1) * stride + barWidth / 2 - (showFullDay ? 0 : scrollX) - dotSize / 2;

  return (
    <View style={styles.chartWrap}>
      <View style={styles.dayNavigator}>
        <Pressable
          accessibilityLabel="Forrige dag"
          disabled={selectedDayIndex === 0}
          onPress={() => changeDay(selectedDayIndex - 1)}
          style={[styles.dayArrow, selectedDayIndex === 0 && styles.dayArrowDisabled]}
        >
          <Feather name="chevron-left" size={20} color={colors.ink} />
        </Pressable>
        <View style={styles.dayNavigatorTitle}>
          <Text style={styles.dayNavigatorDate}>{dkDay.format(selectedDayDate)}</Text>
          <Text style={styles.dayNavigatorMeta}>{isForecastDay ? "Prognose" : selectedDayIndex === 0 ? "I dag" : "Offentliggjort"} · {selectedDayIndex + 1} af {availableDays.length}</Text>
        </View>
        <Pressable
          accessibilityLabel="Næste dag"
          disabled={selectedDayIndex >= availableDays.length - 1}
          onPress={() => changeDay(selectedDayIndex + 1)}
          style={[styles.dayArrow, selectedDayIndex >= availableDays.length - 1 && styles.dayArrowDisabled]}
        >
          <Feather name="chevron-right" size={20} color={colors.ink} />
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
          <Text style={styles.chartSelectionPrice}>{selected ? formatPrice(selected.price, 2) : ""}</Text>
          <Text style={styles.chartSelectionUnit}>kr/kWh</Text>
        </View>
      </View>
      <View
        style={styles.barViewport}
        onLayout={(event) => {
          setChartViewportWidth(event.nativeEvent.layout.width);
        }}
      >
        <ScrollView
          ref={chartScrollRef}
          horizontal
          scrollEnabled={!showFullDay && !isSliding}
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          onScroll={(event) => {
            scrollXRef.current = event.nativeEvent.contentOffset.x;
            setScrollX(event.nativeEvent.contentOffset.x);
          }}
          scrollEventThrottle={16}
          contentContainerStyle={[styles.barChart, { gap, paddingHorizontal: padding, width: hourly.length * stride - gap + padding * 2 }]}
        >
          {hourly.map((item, index) => {
            const selectedBar = index === selectedIndex;
            const currentBar = index === currentBarIndex;
            const cheapestBar = currentBarIndex < 0 && index === cheapestBarIndex;
            const height = Math.max(30, (item.price / maxPrice) * 94);
            return (
              <Pressable
                key={item.startsAt.toISOString()}
                accessibilityLabel={`${dkTime.format(item.startsAt)}, ${formatPrice(item.price, 2)} kroner per kilowatttime`}
                onPress={() => selectHour(index)}
                style={[
                  styles.barSlot,
                  { width: barWidth },
                  selectedBar && styles.barSlotSelected,
                ]}
              >
                {currentBar ? (
                  <View style={[styles.currentMarker, { bottom: height + 24, width: 28, left: (barWidth - 28) / 2, alignItems: 'center' }]}>
                    <Text numberOfLines={1} style={styles.currentMarkerText}>NU</Text>
                  </View>
                ) : selectedBar ? (
                  <View style={[styles.currentMarker, styles.scrubMarker, { bottom: height + 24, width: 24, left: (barWidth - 24) / 2, alignItems: 'center' }]}>
                    <Text numberOfLines={1} style={styles.currentMarkerText}>{dkTime.format(item.startsAt).slice(0, 2)}</Text>
                  </View>
                ) : null}
                <View
                  style={[
                    styles.bar,
                    { width: barWidth },
                    { height, backgroundColor: barColor(item.price, selectedBar || currentBar || cheapestBar) },
                    currentBar && styles.currentBar,
                    cheapestBar && styles.cheapestBar,
                    selectedBar && styles.selectedBar,
                  ]}
                />
                <Text numberOfLines={1} style={[styles.barHour, showFullDay && styles.barHourOverview, (currentBar || selectedBar) && styles.barHourCurrent]}>
                  {showFullDay && index % 3 !== 0 ? "" : dkTime.format(item.startsAt).slice(0, 2)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
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

      <View style={styles.chartToolbar}>
        <View style={styles.swipeHint}>
          <Feather name="sliders" size={12} color={isSliding ? colors.primary : colors.muted} />
          <Text style={[styles.chartLabel, isSliding && styles.chartLabelActive]}>
            {isSliding ? "Skubber time" : "Skub prikken for at se timepriser"}
          </Text>
        </View>
        <Pressable accessibilityLabel={showFullDay ? "Vis større søjler" : "Vis hele dagen"} onPress={() => setShowFullDay((value) => !value)} style={styles.overviewButton}>
          <Feather name={showFullDay ? "minimize-2" : "maximize-2"} size={13} color={colors.ink} />
          <Text style={styles.overviewButtonText}>{showFullDay ? "Større søjler" : "Vis hele dagen"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

