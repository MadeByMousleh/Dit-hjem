import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFonts as useDMSans, DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from "@expo-google-fonts/dm-sans";
import { Fraunces_600SemiBold, useFonts as useFraunces } from "@expo-google-fonts/fraunces";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { createSamplePrices, fetchPrices, PricePoint } from "./src/prices";

const colors = {
  ink: "#18332F",
  muted: "#65736E",
  paper: "#F4F1E8",
  white: "#FFFEFA",
  mint: "#DCE9DC",
  green: "#0B694F",
  coral: "#E87555",
  yellow: "#F2CA6B",
  line: "#D8D9CF",
  navy: "#163B47",
};

const dkTime = new Intl.DateTimeFormat("da-DK", {
  timeZone: "Europe/Copenhagen",
  hour: "2-digit",
  minute: "2-digit",
});
const dkDay = new Intl.DateTimeFormat("da-DK", {
  timeZone: "Europe/Copenhagen",
  weekday: "long",
  day: "numeric",
  month: "short",
});

const DEVICE_TEMPLATES = [
  { kind: "dishwasher", name: "Opvaskemaskine", icon: "droplet" as const, energyKwh: 1, durationHours: 2 },
  { kind: "laundry", name: "Vaskemaskine", icon: "refresh-cw" as const, energyKwh: 0.8, durationHours: 2 },
  { kind: "dryer", name: "Tørretumbler", icon: "wind" as const, energyKwh: 2.5, durationHours: 2 },
  { kind: "ev", name: "Elbil", icon: "battery-charging" as const, energyKwh: 0, durationHours: 0 },
  { kind: "other", name: "Andet apparat", icon: "power" as const, energyKwh: 1, durationHours: 1 },
] as const;

type DeviceKind = typeof DEVICE_TEMPLATES[number]["kind"];
type EnergyClass = "A+++" | "A++" | "A+" | "A" | "B" | "C" | "D" | "E" | "F" | "G";
type HouseholdDevice = {
  id: number;
  kind: DeviceKind;
  name: string;
  icon: typeof DEVICE_TEMPLATES[number]["icon"];
  energyKwh: number;
  durationHours: number;
  batteryKwh: number;
  currentCharge: number;
  targetCharge: number;
  chargerKw: number;
  energyClass?: EnergyClass;
};

const DEVICES_STORAGE_KEY = "stromblik.household-devices.v1";
const ENERGY_CLASSES: EnergyClass[] = ["A+++", "A++", "A+", "A", "B", "C", "D", "E", "F", "G"];
const DURATIONS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4];

const CLASS_ENERGY_KWH: Record<"dishwasher" | "laundry" | "dryer", Record<EnergyClass, number>> = {
  dishwasher: { "A+++": 0.65, "A++": 0.75, "A+": 0.9, A: 0.55, B: 0.64, C: 0.72, D: 0.82, E: 0.93, F: 1.04, G: 1.16 },
  laundry: { "A+++": 0.55, "A++": 0.65, "A+": 0.75, A: 0.49, B: 0.55, C: 0.61, D: 0.69, E: 0.76, F: 0.84, G: 0.95 },
  dryer: { "A+++": 1, "A++": 1.35, "A+": 2, A: 0.8, B: 0.95, C: 1.1, D: 1.3, E: 1.6, F: 2, G: 2.5 },
};

function formatPrice(value: number, digits = 0) {
  return value.toLocaleString("da-DK", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function formatDuration(hours: number) {
  const totalMinutes = Math.round(hours * 60);
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!wholeHours) return `${minutes} min`;
  return minutes ? `${wholeHours} t ${minutes} min` : `${wholeHours} t`;
}

function dayKey(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Copenhagen",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getPriceTone(value: number, values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const low = sorted[Math.floor(sorted.length * 0.33)] ?? value;
  const high = sorted[Math.floor(sorted.length * 0.67)] ?? value;
  if (value <= low) return { label: "Lav pris", color: colors.green, soft: "#E2F0E6" };
  if (value >= high) return { label: "Høj pris", color: "#A4462E", soft: "#F8E1D8" };
  return { label: "Mellempris", color: "#745A13", soft: "#F8EDC8" };
}

function findBestEnergyWindow(points: PricePoint[], energyKwh: number, durationHours: number, now: number) {
  const horizon = now + 48 * 60 * 60 * 1000;
  const averagePowerKw = energyKwh / durationHours;
  const calculateCost = (startsAt: number) => {
    const endsAt = startsAt + durationHours * 3_600_000;
    let coveredHours = 0;
    let cost = 0;

    points.forEach((point, index) => {
      const intervalStart = point.startsAt.getTime();
      const intervalEnd = points[index + 1]?.startsAt.getTime() ?? intervalStart + 3_600_000;
      const overlapStart = Math.max(startsAt, intervalStart);
      const overlapEnd = Math.min(endsAt, intervalEnd);
      if (overlapEnd <= overlapStart) return;
      const overlapHours = (overlapEnd - overlapStart) / 3_600_000;
      cost += (point.totalOrePerKwh / 100) * averagePowerKw * overlapHours;
      coveredHours += overlapHours;
    });

    return coveredHours >= durationHours - 0.001 ? cost : undefined;
  };
  const candidates = points
    .map((startPoint) => {
      if (startPoint.startsAt.getTime() < now || startPoint.startsAt.getTime() >= horizon) return undefined;
      const cost = calculateCost(startPoint.startsAt.getTime());
      if (cost === undefined) return undefined;
      return { startsAt: startPoint.startsAt, cost };
    })
    .filter((item): item is { startsAt: Date; cost: number } => Boolean(item));

  if (!candidates.length) return undefined;
  const cheapest = candidates.reduce((best, item) => item.cost < best.cost ? item : best);
  const nowCost = calculateCost(now);
  if (nowCost === undefined) return undefined;
  return { cheapest, nowCost, savings: Math.max(0, nowCost - cheapest.cost) };
}

function Stepper({ label, value, onChange, min, max, step = 10, suffix = "%", digits = 0 }: { label: string; value: number; onChange: (value: number) => void; min: number; max: number; step?: number; suffix?: string; digits?: number }) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <Pressable accessibilityLabel={`Sænk ${label}`} disabled={value <= min} onPress={() => onChange(Math.max(min, value - step))} style={styles.stepperButton}>
          <Feather name="minus" size={15} color={colors.ink} />
        </Pressable>
        <Text style={styles.stepperValue}>{formatPrice(value, digits)}{suffix}</Text>
        <Pressable accessibilityLabel={`Hæv ${label}`} disabled={value >= max} onPress={() => onChange(Math.min(max, value + step))} style={styles.stepperButton}>
          <Feather name="plus" size={15} color={colors.ink} />
        </Pressable>
      </View>
    </View>
  );
}

function NumericField({ label, value, suffix, onChange }: { label: string; value: number; suffix: string; onChange: (value: number) => void }) {
  return (
    <View style={styles.numericField}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.numericInputWrap}>
        <TextInput
          accessibilityLabel={label}
          inputMode="decimal"
          selectTextOnFocus
          value={formatPrice(value, Number.isInteger(value) ? 0 : 1)}
          onChangeText={(text) => {
            const parsed = Number(text.replace(",", "."));
            if (Number.isFinite(parsed) && parsed >= 0) onChange(parsed);
          }}
          style={styles.numericInput}
        />
        <Text style={styles.numericSuffix}>{suffix}</Text>
      </View>
    </View>
  );
}

function DevicePlanCard({ device, points, now, expanded, onToggle, onChange, onRemove }: {
  device: HouseholdDevice;
  points: PricePoint[];
  now: number;
  expanded: boolean;
  onToggle: () => void;
  onChange: (changes: Partial<HouseholdDevice>) => void;
  onRemove: () => void;
}) {
  const isCar = device.kind === "ev";
  const hasCycleEnergyLabel = device.kind === "dishwasher" || device.kind === "laundry" || device.kind === "dryer";
  const energyClass = device.energyClass ?? (device.kind === "laundry" ? "A" : "B");
  const estimatedCycleKwh = hasCycleEnergyLabel
    ? CLASS_ENERGY_KWH[device.kind as keyof typeof CLASS_ENERGY_KWH][energyClass]
    : device.energyKwh;
  const energyKwh = isCar
    ? device.batteryKwh * Math.max(0, device.targetCharge - device.currentCharge) / 100 / 0.9
    : estimatedCycleKwh;
  const durationHours = isCar ? Math.max(0.25, energyKwh / device.chargerKw) : device.durationHours;
  const plan = useMemo(() => findBestEnergyWindow(points, energyKwh, durationHours, now), [durationHours, energyKwh, now, points]);
  const endTime = plan ? new Date(plan.cheapest.startsAt.getTime() + durationHours * 3_600_000) : undefined;
  const nowEndTime = new Date(now + durationHours * 3_600_000);

  return (
    <View style={styles.deviceCard}>
      <View style={styles.deviceHeader}>
        <View style={styles.deviceIdentity}>
          <View style={styles.deviceIcon}><Feather name={device.icon} size={18} color={colors.green} /></View>
          <View>
            <Text style={styles.deviceName}>{device.name}</Text>
            <Text style={styles.deviceMeta}>{formatPrice(energyKwh, 2)} kWh · ca. {formatDuration(durationHours)}</Text>
          </View>
        </View>
        <View style={styles.deviceActions}>
          <Pressable accessibilityLabel={`${expanded ? "Luk" : "Tilpas"} ${device.name}`} onPress={onToggle} style={styles.deviceActionButton}>
            <Feather name={expanded ? "chevron-up" : "sliders"} size={17} color={colors.ink} />
          </Pressable>
          <Pressable accessibilityLabel={`Fjern ${device.name}`} onPress={onRemove} style={styles.deviceActionButton}>
            <Feather name="trash-2" size={16} color="#A4462E" />
          </Pressable>
        </View>
      </View>

      <View style={styles.devicePlan}>
        <View>
          <Text style={styles.devicePlanLabel}>STARTER DU NU</Text>
          <Text style={styles.devicePlanTime}>
            {plan ? `${dkTime.format(new Date(now))}–${dkTime.format(nowEndTime)}` : "Afventer priser"}
          </Text>
        </View>
        <View style={styles.devicePriceWrap}>
          <Text style={styles.devicePrice}>{plan ? formatPrice(plan.nowCost, 2) : "–"} kr</Text>
          <Text style={styles.deviceSaving}>hele programmet</Text>
        </View>
      </View>
      {plan && endTime ? (
        <View style={styles.cheapestSuggestion}>
          <Feather name="clock" size={14} color={colors.green} />
          <Text style={styles.cheapestSuggestionText}>Billigst {dkDay.format(plan.cheapest.startsAt)} kl. {dkTime.format(plan.cheapest.startsAt)} · {formatPrice(plan.cheapest.cost, 2)} kr</Text>
          <Text style={styles.cheapestSaving}>Spar {formatPrice(plan.savings, 2)} kr</Text>
        </View>
      ) : null}

      {expanded ? (
        <View style={styles.deviceSettings}>
          {isCar ? (
            <>
              <View style={styles.controlRow}>
                <Stepper label="Batteri" value={device.batteryKwh} min={20} max={150} step={5} suffix=" kWh" onChange={(batteryKwh) => onChange({ batteryKwh })} />
                <Stepper label="Lader" value={device.chargerKw} min={2} max={22} step={1} suffix=" kW" onChange={(chargerKw) => onChange({ chargerKw })} />
              </View>
              <View style={styles.controlRow}>
                <Stepper label="Fra" value={device.currentCharge} min={0} max={Math.max(0, device.targetCharge - 10)} onChange={(currentCharge) => onChange({ currentCharge })} />
                <Stepper label="Til" value={device.targetCharge} min={Math.min(100, device.currentCharge + 10)} max={100} onChange={(targetCharge) => onChange({ targetCharge })} />
              </View>
              <Text style={styles.deviceHelp}>Virker med alle elbiler. Brug bilens brugbare batterikapacitet og din hjemmeladers effekt.</Text>
            </>
          ) : (
            <>
              {hasCycleEnergyLabel ? (
                <View style={styles.simpleSettingGroup}>
                  <Text style={styles.simpleSettingTitle}>Energimærke</Text>
                  <View style={styles.choiceGrid} accessibilityRole="radiogroup">
                    {ENERGY_CLASSES.map((item) => (
                      <Pressable key={item} accessibilityRole="radio" accessibilityState={{ checked: energyClass === item }} onPress={() => onChange({ energyClass: item })} style={[styles.classChoice, energyClass === item && styles.classChoiceActive]}>
                        <Text style={[styles.classChoiceText, energyClass === item && styles.classChoiceTextActive]}>{item}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={styles.estimateCaption}>Estimeret forbrug: {formatPrice(energyKwh, 2)} kWh pr. program</Text>
                </View>
              ) : null}
              {!isCar ? (
                <View style={styles.simpleSettingGroup}>
                  <Text style={styles.simpleSettingTitle}>Hvor længe kører den?</Text>
                  <View style={styles.durationGrid}>
                    {DURATIONS.map((duration) => (
                      <Pressable key={duration} accessibilityRole="radio" accessibilityState={{ checked: device.durationHours === duration }} onPress={() => onChange({ durationHours: duration })} style={[styles.durationChoice, device.durationHours === duration && styles.durationChoiceActive]}>
                        <Text style={[styles.durationChoiceText, device.durationHours === duration && styles.durationChoiceTextActive]}>{duration === 0.5 ? "30 min" : `${formatPrice(duration, duration % 1 ? 1 : 0)} t`}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}
              {!hasCycleEnergyLabel && !isCar ? (
                <NumericField label="Forbrug" value={device.energyKwh} suffix=" kWh" onChange={(energyKwh) => onChange({ energyKwh })} />
              ) : null}
              <Text style={styles.deviceHelp}>Beregningen er et estimat ud fra apparattype, energiklasse og valgt køretid.</Text>
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

function FamilyPlanner({ points, now }: { points: PricePoint[]; now: number }) {
  const nextId = useRef(1);
  const [devices, setDevices] = useState<HouseholdDevice[]>([]);
  const [showCatalog, setShowCatalog] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(DEVICES_STORAGE_KEY)
      .then((stored) => {
        if (!stored) return;
        const savedDevices = JSON.parse(stored) as HouseholdDevice[];
        if (!Array.isArray(savedDevices)) return;
        setDevices(savedDevices);
        nextId.current = Math.max(0, ...savedDevices.map((device) => device.id)) + 1;
      })
      .catch(() => undefined)
      .finally(() => setStorageReady(true));
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    void AsyncStorage.setItem(DEVICES_STORAGE_KEY, JSON.stringify(devices));
  }, [devices, storageReady]);

  const addDevice = (kind: DeviceKind) => {
    const template = DEVICE_TEMPLATES.find((item) => item.kind === kind)!;
    const id = nextId.current++;
    setDevices((current) => {
      const matchingDevices = current.filter((device) => device.kind === kind).length;
      return [...current, {
        id,
        kind,
        name: matchingDevices ? `${template.name} ${matchingDevices + 1}` : template.name,
        icon: template.icon,
        energyKwh: template.energyKwh,
        durationHours: template.durationHours,
        batteryKwh: 60,
        currentCharge: 40,
        targetCharge: 80,
        chargerKw: 11,
        energyClass: kind === "laundry" ? "A" : "B",
      }];
    });
    setExpandedId(id);
    setShowCatalog(false);
  };

  return (
    <View style={styles.plannerSection}>
      <View style={styles.plannerHeading}>
        <View>
          <Text style={styles.eyebrow}>FAMILIEPLAN · NÆSTE 48 TIMER</Text>
          <Text style={styles.sectionTitle}>Jeres apparater</Text>
        </View>
        <Pressable accessibilityLabel={showCatalog ? "Luk tilføjelse" : "Tilføj apparat"} onPress={() => setShowCatalog((value) => !value)} style={[styles.addDeviceButton, showCatalog && styles.addDeviceButtonActive]}>
          <Feather name={showCatalog ? "x" : "plus"} size={18} color={showCatalog ? colors.white : colors.ink} />
          <Text style={[styles.addDeviceText, showCatalog && styles.addDeviceTextActive]}>{showCatalog ? "Luk" : "Tilføj"}</Text>
        </Pressable>
      </View>

      {showCatalog ? (
        <View style={styles.deviceCatalog}>
          <Text style={styles.catalogLabel}>HVAD VIL I PLANLÆGGE?</Text>
          <View style={styles.catalogGrid}>
            {DEVICE_TEMPLATES.map((item) => (
              <Pressable key={item.kind} accessibilityLabel={`Tilføj ${item.name}`} onPress={() => addDevice(item.kind)} style={styles.catalogItem}>
                <View style={styles.catalogIcon}><Feather name={item.icon} size={20} color={colors.green} /></View>
                <Text style={styles.catalogName}>{item.name}</Text>
                <Feather name="plus-circle" size={17} color={colors.muted} />
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {!devices.length ? (
        <Pressable accessibilityLabel="Tilføj første apparat" onPress={() => setShowCatalog(true)} style={styles.plannerEmpty}>
          <View style={styles.emptyIcon}><Feather name="home" size={23} color={colors.green} /></View>
          <Text style={styles.emptyTitle}>Tilføj familiens apparater</Text>
          <Text style={styles.emptyText}>Så finder vi det billigste tidspunkt og den forventede pris for hver enkelt.</Text>
          <View style={styles.emptyAction}><Feather name="plus" size={15} color={colors.white} /><Text style={styles.emptyActionText}>Kom i gang</Text></View>
        </Pressable>
      ) : (
        <View style={styles.deviceList}>
          {devices.map((device) => (
            <DevicePlanCard
              key={device.id}
              device={device}
              points={points}
              now={now}
              expanded={expandedId === device.id}
              onToggle={() => setExpandedId((current) => current === device.id ? null : device.id)}
              onChange={(changes) => setDevices((current) => current.map((item) => item.id === device.id ? { ...item, ...changes } : item))}
              onRemove={() => {
                setDevices((current) => current.filter((item) => item.id !== device.id));
                if (expandedId === device.id) setExpandedId(null);
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function PriceChart({ points, now }: { points: PricePoint[]; now: number }) {
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
  const [showFullDay, setShowFullDay] = useState(false);
  const [chartViewportWidth, setChartViewportWidth] = useState(0);
  const chartScrollRef = useRef<ScrollView>(null);
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
  useEffect(() => {
    if (!chartViewportWidth) return;
    if (showFullDay) {
      chartScrollRef.current?.scrollTo({ x: 0, animated: true });
      return;
    }
    const barStride = 31;
    const scrollPosition = currentBarIndex >= 0
      ? currentBarIndex * barStride
      : cheapestBarIndex * barStride - chartViewportWidth / 2 + barStride / 2;
    chartScrollRef.current?.scrollTo({ x: Math.max(0, scrollPosition), animated: true });
  }, [chartViewportWidth, cheapestBarIndex, currentBarIndex, selectedDayIndex, showFullDay]);
  const barColor = (price: number, selectedBar: boolean) => {
    if (price >= 2) return selectedBar ? "#B94F46" : "#E2B8B4";
    if (price >= 1.5) return selectedBar ? "#D9A62E" : "#F0DDA4";
    return selectedBar ? "#4E9B59" : "#B9D9BE";
  };

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
        <Text style={styles.chartSelectionTime}>{selected ? `kl. ${dkTime.format(selected.startsAt)}` : ""}</Text>
        <View style={styles.chartSelectionValue}>
          <Text style={styles.chartSelectionPrice}>{selected ? formatPrice(selected.price, 2) : ""}</Text>
          <Text style={styles.chartSelectionUnit}>kr/kWh</Text>
        </View>
      </View>
      <View style={styles.barViewport} onLayout={(event) => setChartViewportWidth(event.nativeEvent.layout.width)}>
        <ScrollView
          ref={chartScrollRef}
          horizontal
          scrollEnabled={!showFullDay}
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
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
                onPress={() => setSelectedIndex(index)}
                onPressIn={() => setSelectedIndex(index)}
                onHoverIn={() => setSelectedIndex(index)}
                style={[styles.barSlot, showFullDay && styles.barSlotOverview]}
              >
                {currentBar || cheapestBar ? (
                  <View style={[styles.currentMarker, cheapestBar && styles.cheapestMarker, { bottom: height + 24 }]}>
                    <Text style={styles.currentMarkerText}>{currentBar ? "NU" : "BILLIGST"}</Text>
                  </View>
                ) : null}
                <View style={[styles.bar, showFullDay && styles.barOverview, { height, backgroundColor: barColor(item.price, selectedBar || currentBar || cheapestBar) }, currentBar && styles.currentBar, cheapestBar && styles.cheapestBar]} />
                <Text style={[styles.barHour, showFullDay && styles.barHourOverview, currentBar && styles.barHourCurrent]}>
                  {showFullDay && index % 3 !== 0 ? "" : dkTime.format(item.startsAt).slice(0, 2)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <LinearGradient colors={[colors.white, "rgba(255,254,250,0)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.railFadeLeft} />
        <LinearGradient colors={["rgba(255,254,250,0)", colors.white]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.railFadeRight} />
      </View>
      <View style={styles.chartToolbar}>
        {!showFullDay ? <View style={styles.swipeHint}><Feather name="move" size={12} color={colors.muted} /><Text style={styles.chartLabel}>Stryg for hele døgnet</Text></View> : <View />}
        <Pressable accessibilityLabel={showFullDay ? "Vis større søjler" : "Vis hele dagen"} onPress={() => setShowFullDay((value) => !value)} style={styles.overviewButton}>
          <Feather name={showFullDay ? "minimize-2" : "maximize-2"} size={13} color={colors.ink} />
          <Text style={styles.overviewButtonText}>{showFullDay ? "Større søjler" : "Vis hele dagen"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Dashboard() {
  const { width } = useWindowDimensions();
  const isTablet = width >= 760;
  const area = "DK1" as const;
  const [now, setNow] = useState(() => Date.now());
  const [prices, setPrices] = useState<PricePoint[]>(() => createSamplePrices("DK1"));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isSample, setIsSample] = useState(false);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      setPrices(await fetchPrices("DK1", "n1_c"));
      setIsSample(false);
    } catch {
      setPrices(createSamplePrices("DK1"));
      setIsSample(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const quarterKey = Math.floor(now / (15 * 60 * 1000));
  useEffect(() => {
    void load();
  }, [load, quarterKey]);

  const current = [...prices].reverse().find((point) => point.startsAt.getTime() <= now) ?? prices[0];
  const future = prices.filter((point) => point.startsAt.getTime() >= now).slice(0, 49);
  const displayPoints = future.length > 1 ? future : prices.slice(0, 49);
  const pointPrice = (point: PricePoint) => point.totalOrePerKwh;
  const oreValues = displayPoints.map(pointPrice);
  const currentOre = current ? pointPrice(current) : 0;
  const tone = getPriceTone(currentOre, oreValues);
  const cheapest = displayPoints.reduce<PricePoint | undefined>((best, point) =>
    !best || pointPrice(point) < pointPrice(best) ? point : best, undefined);

  const days = useMemo(() => {
    const grouped = new Map<string, PricePoint[]>();
    prices.forEach((point) => {
      const key = dayKey(point.startsAt);
      grouped.set(key, [...(grouped.get(key) ?? []), point]);
    });
    return [...grouped.values()].filter((group) => group.some((point) => point.startsAt.getTime() >= now - 900000)).slice(0, 3);
  }, [prices, now]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.green} />}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <View>
              <Text style={styles.brand}>STRØMBLIK</Text>
              <Text style={styles.date}>{dkDay.format(new Date(now))}</Text>
            </View>
            <Pressable accessibilityLabel="Opdater priser" onPress={() => void load(true)} style={styles.iconButton}>
              <Feather name="refresh-cw" size={19} color={colors.ink} />
            </Pressable>
          </View>

          {isSample ? (
            <View style={styles.notice}>
              <Feather name="wifi-off" size={16} color="#8A492F" />
              <Text style={styles.noticeText}>Offlinevisning: eksempelpriser vises</Text>
            </View>
          ) : null}

          <View style={[styles.topGrid, isTablet && styles.topGridTablet]}>
            <LinearGradient colors={["#DCE9DC", "#EEF1DB"]} style={[styles.hero, isTablet && styles.halfPanel]}>
              <View style={styles.heroTopline}>
                <Text style={styles.eyebrow}>LIGE NU · N1 · {area}</Text>
                {loading ? <ActivityIndicator color={colors.green} size="small" /> : null}
              </View>
              <View style={styles.priceLine}>
                <Text adjustsFontSizeToFit numberOfLines={1} style={styles.price}>{formatPrice(currentOre / 100, 2)}</Text>
                <View style={styles.unitWrap}>
                  <Text style={styles.unit}>kr</Text>
                  <Text style={styles.unitSmall}>pr. kWh</Text>
                </View>
              </View>
              <View style={[styles.statusPill, { backgroundColor: tone.soft }]}>
                <View style={[styles.statusDot, { backgroundColor: tone.color }]} />
                <Text style={[styles.statusText, { color: tone.color }]}>{tone.label}</Text>
              </View>
              <Text style={styles.vatNote}>Inkl. moms, elafgift og transport</Text>
            </LinearGradient>

            <View style={[styles.trendPanel, isTablet && styles.halfPanel]}>
              <View style={styles.sectionHeadingRow}>
                <View>
                  <Text style={styles.eyebrow}>TIMEPRISER · OP TIL 7 DAGE</Text>
                  <Text style={styles.sectionTitle}>Prisens bevægelse</Text>
                </View>
                <Feather name="trending-up" size={22} color={colors.coral} />
              </View>
              <PriceChart points={prices} now={now} />
            </View>
          </View>

          <FamilyPlanner points={prices} now={now} />

          <View style={styles.sectionHeadingRow}>
            <View>
              <Text style={styles.eyebrow}>KVARTER FOR KVARTER</Text>
              <Text style={styles.sectionTitle}>Kommende priser</Text>
            </View>
            <Text style={styles.smallMeta}>inkl. moms</Text>
          </View>
          <View style={[styles.hourGrid, isTablet && styles.hourGridTablet]}>
            {displayPoints.slice(0, isTablet ? 8 : 6).map((point, index) => {
              const value = pointPrice(point);
              const itemTone = getPriceTone(value, oreValues);
              return (
                <View key={point.startsAt.toISOString()} style={[styles.hourRow, isTablet && styles.hourRowTablet, index === 0 && styles.hourRowCurrent]}>
                  <View style={styles.hourTimeWrap}>
                    <Text style={styles.hourTime}>{dkTime.format(point.startsAt)}</Text>
                    <Text style={styles.hourRelative}>{index === 0 ? "Næste interval" : `+${index * 15} min`}</Text>
                  </View>
                  <View style={styles.hourPriceWrap}>
                    <Text style={styles.hourPrice}>{formatPrice(value / 100, 2)}</Text>
                    <Text style={styles.hourUnit}>kr</Text>
                  </View>
                  <View style={[styles.miniDot, { backgroundColor: itemTone.color }]} />
                </View>
              );
            })}
          </View>

          <View style={[styles.sectionHeadingRow, styles.daysHeading]}>
            <View>
              <Text style={styles.eyebrow}>DAGSPRISER</Text>
              <Text style={styles.sectionTitle}>I dag og frem</Text>
            </View>
            <Feather name="calendar" size={21} color={colors.ink} />
          </View>
          <View style={[styles.dayGrid, isTablet && styles.dayGridTablet]}>
            {days.map((group) => {
              const values = group.map(pointPrice);
              const average = values.reduce((sum, value) => sum + value, 0) / values.length;
              return (
                <View key={dayKey(group[0]!.startsAt)} style={styles.dayItem}>
                  <Text style={styles.dayName}>{dkDay.format(group[0]!.startsAt)}</Text>
                  <Text style={styles.dayPrice}>{formatPrice(average / 100, 2)} <Text style={styles.dayUnit}>kr</Text></Text>
                  <View style={styles.rangeLine}>
                    <Text style={styles.rangeText}>Lav {formatPrice(Math.min(...values) / 100, 2)}</Text>
                    <Text style={styles.rangeText}>Høj {formatPrice(Math.max(...values) / 100, 2)}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          <View style={styles.disclosure}>
            <Feather name="info" size={17} color={colors.muted} />
            <Text style={styles.disclosureText}>
              Samlet pris inkluderer spotpris, moms, elafgift samt lokale og nationale tariffer. Elselskabets og netselskabets abonnementer er ikke medregnet. Data: Strømligning og Nord Pool.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function App() {
  const [dmLoaded] = useDMSans({ DMSans_400Regular, DMSans_500Medium, DMSans_700Bold });
  const [frauncesLoaded] = useFraunces({ Fraunces_600SemiBold });

  if (!dmLoaded || !frauncesLoaded) {
    return <View style={styles.loadingScreen}><ActivityIndicator color={colors.green} /></View>;
  }

  return <SafeAreaProvider><Dashboard /></SafeAreaProvider>;
}

const styles = StyleSheet.create({
  loadingScreen: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.paper },
  safeArea: { flex: 1, backgroundColor: colors.paper },
  scrollContent: { paddingBottom: 44 },
  container: { width: "100%", maxWidth: 1120, alignSelf: "center", paddingHorizontal: 20 },
  header: { minHeight: 96, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { fontFamily: "DMSans_700Bold", fontSize: 18, color: colors.ink, letterSpacing: 0 },
  date: { fontFamily: "DMSans_400Regular", fontSize: 13, color: colors.muted, marginTop: 3, textTransform: "capitalize" },
  iconButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center", backgroundColor: colors.white },
  notice: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: "#F8E1D8", borderRadius: 6, marginBottom: 16 },
  noticeText: { fontFamily: "DMSans_500Medium", fontSize: 13, color: "#8A492F" },
  topGrid: { gap: 14 },
  topGridTablet: { flexDirection: "row" },
  halfPanel: { flex: 1 },
  hero: { minHeight: 315, borderRadius: 8, padding: 24, justifyContent: "space-between", overflow: "hidden" },
  heroTopline: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  eyebrow: { fontFamily: "DMSans_700Bold", fontSize: 11, color: colors.muted, letterSpacing: 0 },
  priceLine: { flexDirection: "row", alignItems: "flex-end", gap: 10, marginVertical: 12 },
  price: { fontFamily: "Fraunces_600SemiBold", fontSize: 94, lineHeight: 102, color: colors.ink, maxWidth: "74%" },
  unitWrap: { paddingBottom: 14 },
  unit: { fontFamily: "DMSans_700Bold", color: colors.ink, fontSize: 22 },
  unitSmall: { fontFamily: "DMSans_400Regular", color: colors.muted, fontSize: 12 },
  statusPill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 18, paddingVertical: 7, paddingHorizontal: 11 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontFamily: "DMSans_700Bold", fontSize: 12 },
  vatNote: { fontFamily: "DMSans_400Regular", fontSize: 12, color: colors.muted, marginTop: 9 },
  trendPanel: { minHeight: 315, backgroundColor: colors.white, borderRadius: 8, padding: 22, borderWidth: 1, borderColor: "#E8E6DC" },
  sectionHeadingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontFamily: "Fraunces_600SemiBold", fontSize: 24, color: colors.ink, marginTop: 4 },
  chartWrap: { flex: 1, justifyContent: "flex-end", marginTop: 8 },
  dayNavigator: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 48, borderBottomWidth: 1, borderBottomColor: colors.line, marginBottom: 8 },
  dayNavigatorTitle: { alignItems: "center" },
  dayNavigatorDate: { fontFamily: "DMSans_700Bold", color: colors.ink, fontSize: 14, textTransform: "capitalize" },
  dayNavigatorMeta: { fontFamily: "DMSans_400Regular", color: colors.muted, fontSize: 10, marginTop: 2 },
  dayArrow: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  dayArrowDisabled: { opacity: 0.25 },
  chartSelection: { minHeight: 58, justifyContent: "flex-end" },
  chartSelectionTime: { fontFamily: "DMSans_700Bold", color: colors.ink, fontSize: 13 },
  chartSelectionValue: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  chartSelectionPrice: { fontFamily: "Fraunces_600SemiBold", color: colors.ink, fontSize: 38, lineHeight: 43 },
  chartSelectionUnit: { fontFamily: "DMSans_500Medium", color: colors.muted, fontSize: 13 },
  barViewport: { height: 166, overflow: "hidden", position: "relative" },
  barChart: { height: 160, flexDirection: "row", alignItems: "flex-end", gap: 4, paddingTop: 15, paddingBottom: 25, paddingHorizontal: 16 },
  barChartOverview: { minWidth: "100%", gap: 1, paddingHorizontal: 4 },
  barSlot: { width: 27, height: "100%", justifyContent: "flex-end", alignItems: "center", position: "relative" },
  barSlotOverview: { width: "auto", flex: 1 },
  bar: { width: 27, minHeight: 30, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  barOverview: { width: "100%", borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  barHour: { height: 18, paddingTop: 4, fontFamily: "DMSans_400Regular", fontSize: 9, color: colors.muted },
  barHourOverview: { fontSize: 8 },
  barHourCurrent: { fontFamily: "DMSans_700Bold", color: colors.ink },
  currentBar: { borderWidth: 2, borderColor: colors.ink },
  cheapestBar: { borderWidth: 2, borderColor: colors.green },
  currentMarker: { position: "absolute", backgroundColor: colors.ink, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 2, zIndex: 2 },
  cheapestMarker: { backgroundColor: colors.green },
  currentMarkerText: { fontFamily: "DMSans_700Bold", fontSize: 8, color: colors.white },
  railFadeLeft: { position: "absolute", left: 0, top: 0, bottom: 0, width: 16, pointerEvents: "none" },
  railFadeRight: { position: "absolute", right: 0, top: 0, bottom: 0, width: 16, pointerEvents: "none" },
  swipeHint: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 7 },
  chartToolbar: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 7 },
  overviewButton: { minHeight: 30, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, borderRadius: 5, backgroundColor: "#ECEFE5" },
  overviewButtonText: { fontFamily: "DMSans_700Bold", fontSize: 10, color: colors.ink },
  chartLabel: { fontFamily: "DMSans_400Regular", color: colors.muted, fontSize: 10 },
  plannerSection: { marginVertical: 26 },
  plannerHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  addDeviceButton: { minHeight: 38, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 13, borderRadius: 19, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  addDeviceButtonActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  addDeviceText: { fontFamily: "DMSans_700Bold", fontSize: 11, color: colors.ink },
  addDeviceTextActive: { color: colors.white },
  deviceCatalog: { backgroundColor: "#E7EEE4", borderRadius: 8, padding: 14, marginBottom: 12 },
  catalogLabel: { fontFamily: "DMSans_700Bold", fontSize: 10, color: colors.muted, marginBottom: 10 },
  catalogGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catalogItem: { width: "48%", minHeight: 62, flexDirection: "row", alignItems: "center", gap: 8, padding: 9, borderRadius: 6, backgroundColor: colors.white, borderWidth: 1, borderColor: "#D7DFD4" },
  catalogIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.mint },
  catalogName: { flex: 1, fontFamily: "DMSans_700Bold", fontSize: 11, color: colors.ink },
  plannerEmpty: { minHeight: 220, alignItems: "center", justifyContent: "center", padding: 28, borderRadius: 8, borderWidth: 1, borderStyle: "dashed", borderColor: "#BFC9BC", backgroundColor: "rgba(255,254,250,0.55)" },
  emptyIcon: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center", backgroundColor: colors.mint, marginBottom: 13 },
  emptyTitle: { fontFamily: "Fraunces_600SemiBold", fontSize: 21, color: colors.ink, textAlign: "center" },
  emptyText: { maxWidth: 310, fontFamily: "DMSans_400Regular", fontSize: 12, lineHeight: 18, color: colors.muted, textAlign: "center", marginTop: 7 },
  emptyAction: { minHeight: 36, flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 18, paddingHorizontal: 14, backgroundColor: colors.green, marginTop: 17 },
  emptyActionText: { fontFamily: "DMSans_700Bold", fontSize: 11, color: colors.white },
  deviceList: { gap: 10 },
  deviceCard: { backgroundColor: colors.white, borderRadius: 8, padding: 15, borderWidth: 1, borderColor: "#E3E3D9" },
  deviceHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  deviceIdentity: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  deviceIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.mint },
  deviceName: { fontFamily: "DMSans_700Bold", fontSize: 15, color: colors.ink },
  deviceMeta: { fontFamily: "DMSans_400Regular", fontSize: 10, color: colors.muted, marginTop: 2 },
  deviceActions: { flexDirection: "row", gap: 5 },
  deviceActionButton: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 17, backgroundColor: "#F1F1EB" },
  devicePlan: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 10, borderTopWidth: 1, borderTopColor: colors.line, marginTop: 13, paddingTop: 13 },
  devicePlanLabel: { fontFamily: "DMSans_700Bold", fontSize: 9, color: colors.green },
  devicePlanTime: { fontFamily: "DMSans_700Bold", fontSize: 13, color: colors.ink, marginTop: 4, textTransform: "capitalize" },
  devicePriceWrap: { alignItems: "flex-end" },
  devicePrice: { fontFamily: "Fraunces_600SemiBold", fontSize: 24, color: colors.ink },
  deviceSaving: { fontFamily: "DMSans_500Medium", fontSize: 9, color: colors.green, marginTop: 1 },
  cheapestSuggestion: { minHeight: 38, flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 6, backgroundColor: "#EDF3E9", paddingHorizontal: 10, marginTop: 10 },
  cheapestSuggestionText: { flex: 1, fontFamily: "DMSans_500Medium", fontSize: 10, color: colors.ink, textTransform: "capitalize" },
  cheapestSaving: { fontFamily: "DMSans_700Bold", fontSize: 10, color: colors.green },
  deviceSettings: { borderTopWidth: 1, borderTopColor: colors.line, marginTop: 14, paddingTop: 14 },
  simpleSettingGroup: { marginBottom: 13 },
  simpleSettingTitle: { fontFamily: "DMSans_700Bold", fontSize: 11, color: colors.ink, marginBottom: 8 },
  choiceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  classChoice: { width: "18%", minHeight: 38, alignItems: "center", justifyContent: "center", borderRadius: 5, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  classChoiceActive: { backgroundColor: colors.green, borderColor: colors.green },
  classChoiceText: { fontFamily: "DMSans_700Bold", fontSize: 11, color: colors.ink },
  classChoiceTextActive: { color: colors.white },
  estimateCaption: { fontFamily: "DMSans_500Medium", fontSize: 10, color: colors.green, marginTop: 7 },
  durationGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  durationChoice: { width: "23%", minHeight: 35, alignItems: "center", justifyContent: "center", borderRadius: 5, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  durationChoiceActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  durationChoiceText: { fontFamily: "DMSans_500Medium", fontSize: 10, color: colors.muted },
  durationChoiceTextActive: { fontFamily: "DMSans_700Bold", color: colors.white },
  controlRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  labelConversion: { fontFamily: "DMSans_700Bold", fontSize: 10, color: colors.green, marginTop: 3 },
  deviceHelp: { fontFamily: "DMSans_400Regular", fontSize: 10, lineHeight: 15, color: colors.muted, marginTop: 4 },
  stepper: { flex: 1, backgroundColor: "#F1F3ED", borderRadius: 6, padding: 9 },
  stepperLabel: { fontFamily: "DMSans_500Medium", fontSize: 9, color: colors.muted, marginBottom: 7 },
  stepperControls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stepperButton: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  stepperValue: { fontFamily: "DMSans_700Bold", fontSize: 13, color: colors.ink },
  numericField: { flex: 1, backgroundColor: "#F1F3ED", borderRadius: 6, padding: 9 },
  numericInputWrap: { minHeight: 30, flexDirection: "row", alignItems: "center", borderRadius: 5, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 9 },
  numericInput: { flex: 1, minWidth: 0, paddingVertical: 5, fontFamily: "DMSans_700Bold", fontSize: 14, color: colors.ink },
  numericSuffix: { fontFamily: "DMSans_500Medium", fontSize: 9, color: colors.muted },
  smallMeta: { fontFamily: "DMSans_400Regular", fontSize: 12, color: colors.muted },
  hourGrid: { marginTop: 12, borderTopWidth: 1, borderTopColor: colors.line },
  hourGridTablet: { flexDirection: "row", flexWrap: "wrap" },
  hourRow: { minHeight: 68, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: colors.line, paddingHorizontal: 8 },
  hourRowTablet: { flexBasis: "50%", flexGrow: 0, flexShrink: 0 },
  hourRowCurrent: { backgroundColor: "#ECEFE5" },
  hourTimeWrap: { flex: 1 },
  hourTime: { fontFamily: "DMSans_700Bold", fontSize: 16, color: colors.ink },
  hourRelative: { fontFamily: "DMSans_400Regular", fontSize: 10, color: colors.muted, marginTop: 2 },
  hourPriceWrap: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  hourPrice: { fontFamily: "Fraunces_600SemiBold", fontSize: 25, color: colors.ink },
  hourUnit: { fontFamily: "DMSans_400Regular", fontSize: 11, color: colors.muted },
  miniDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 14 },
  daysHeading: { marginTop: 34 },
  dayGrid: { marginTop: 13, gap: 10 },
  dayGridTablet: { flexDirection: "row" },
  dayItem: { flex: 1, minHeight: 132, paddingVertical: 18, borderTopWidth: 3, borderTopColor: colors.coral, borderBottomWidth: 1, borderBottomColor: colors.line },
  dayName: { fontFamily: "DMSans_700Bold", fontSize: 13, color: colors.muted, textTransform: "capitalize" },
  dayPrice: { fontFamily: "Fraunces_600SemiBold", fontSize: 31, color: colors.ink, marginTop: 10 },
  dayUnit: { fontFamily: "DMSans_400Regular", fontSize: 12, color: colors.muted },
  rangeLine: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  rangeText: { fontFamily: "DMSans_400Regular", fontSize: 11, color: colors.muted },
  disclosure: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 28, paddingTop: 18, borderTopWidth: 1, borderTopColor: colors.line },
  disclosureText: { flex: 1, fontFamily: "DMSans_400Regular", fontSize: 12, lineHeight: 18, color: colors.muted },
});