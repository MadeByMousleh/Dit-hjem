import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, Pressable, ScrollView, Text, View } from "react-native";
import { PricePoint } from "../prices";
import { dayKey, formatPrice } from "../utils/formatting";
import { colors, dkDay, dkTime } from "../styles/theme";
import { styles } from "../styles/appStyles";

export function PriceChart({ points, now, onScrubChange }: { points: PricePoint[]; now: number; onScrubChange?: (isScrubbing: boolean) => void }) {
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
  const todayKey = dayKey(new Date(now));
  const availableDays = [...new Set(allHours.map((item) => dayKey(item.startsAt)))]
    .filter((key) => key >= todayKey)
    .slice(0, 7);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const selectedDay = availableDays[Math.min(selectedDayIndex, availableDays.length - 1)];
  const hourly = allHours.filter((item) => dayKey(item.startsAt) === selectedDay);
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
    const barStride = 31;
    const barCenter = 16 + index * barStride + 13.5;
    const maxScroll = Math.max(0, hourly.length * 31 + 32 - chartViewportWidth);
    const targetScrollX = Math.max(0, Math.min(maxScroll, barCenter - chartViewportWidth / 2));
    scrollXRef.current = targetScrollX;
    chartScrollRef.current?.scrollTo({ x: targetScrollX, animated });
  }, [showFullDay, chartViewportWidth, hourly.length]);

  useEffect(() => {
    if (!chartViewportWidth) return;
    if (showFullDay) {
      scrollXRef.current = 0;
      chartScrollRef.current?.scrollTo({ x: 0, animated: true });
      return;
    }
    const initialIndex = currentBarIndex >= 0 ? currentBarIndex : cheapestBarIndex;
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
    const fraction = xInTrack / sliderWidth;
    const nextIndex = Math.round(fraction * (hourly.length - 1));
    selectHour(nextIndex, true);
  }, [hourly.length, sliderWidth, selectHour]);

  const sliderPanResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,

      onPanResponderGrant: (evt) => {
        setIsSliding(true);
        onScrubChange?.(true);
        if (typeof evt.nativeEvent.pageX === "number" && typeof evt.nativeEvent.locationX === "number") {
          sliderTrackPageX.current = evt.nativeEvent.pageX - evt.nativeEvent.locationX;
        }
        sliderTrackRef.current?.measureInWindow((x) => {
          if (typeof x === "number") sliderTrackPageX.current = x;
        });
        updateFromPageX(evt.nativeEvent.pageX);
      },

      onPanResponderMove: (evt) => {
        updateFromPageX(evt.nativeEvent.pageX);
      },

      onPanResponderRelease: () => {
        setIsSliding(false);
        onScrubChange?.(false);
      },

      onPanResponderTerminate: () => {
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
  const dotLeft = sliderWidth > 0 && hourly.length > 1
    ? Math.max(0, Math.min(sliderWidth - dotSize, (selectedIndex / (hourly.length - 1)) * (sliderWidth - dotSize)))
    : 0;

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
          }}
          scrollEventThrottle={16}
          contentContainerStyle={[styles.barChart, showFullDay && styles.barChartOverview]}
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
                  showFullDay && styles.barSlotOverview,
                  selectedBar && styles.barSlotSelected,
                ]}
              >
                {currentBar || cheapestBar ? (
                  <View style={[styles.currentMarker, cheapestBar && styles.cheapestMarker, { bottom: height + 24 }]}>
                    <Text style={styles.currentMarkerText}>{currentBar ? "NU" : "BILLIGST"}</Text>
                  </View>
                ) : selectedBar ? (
                  <View style={[styles.currentMarker, styles.scrubMarker, { bottom: height + 24 }]}>
                    <Text style={styles.currentMarkerText}>{dkTime.format(item.startsAt).slice(0, 2)}</Text>
                  </View>
                ) : null}
                <View
                  style={[
                    styles.bar,
                    showFullDay && styles.barOverview,
                    { height, backgroundColor: barColor(item.price, selectedBar || currentBar || cheapestBar) },
                    currentBar && styles.currentBar,
                    cheapestBar && styles.cheapestBar,
                    selectedBar && styles.selectedBar,
                  ]}
                />
                <Text style={[styles.barHour, showFullDay && styles.barHourOverview, (currentBar || selectedBar) && styles.barHourCurrent]}>
                  {showFullDay && index % 3 !== 0 ? "" : dkTime.format(item.startsAt).slice(0, 2)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <LinearGradient colors={[colors.white, "rgba(255,254,250,0)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.railFadeLeft} />
        <LinearGradient colors={["rgba(255,254,250,0)", colors.white]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.railFadeRight} />
      </View>

      {/* Draggable dot beneath the graph */}
      <View style={styles.sliderWrapper}>
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
          <Feather name="sliders" size={12} color={isSliding ? colors.green : colors.muted} />
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

