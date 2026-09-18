import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFonts as useDMSans, DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from "@expo-google-fonts/dm-sans";
import { Fraunces_600SemiBold, useFonts as useFraunces } from "@expo-google-fonts/fraunces";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  PanResponder,
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
import { createSamplePrices, fetchGridSuppliers, fetchPrices, GridSupplier, GRID_SUPPLIERS, PricePoint } from "./src/prices";
import { AddressSuggestion, searchAddresses } from "./src/addresses";
import { EvModel, fetchOpenEvModels } from "./src/evData";
import { fetchWasteEvents, fetchWasteHealth, WasteEvent, WasteHealth, WASTE_LABELS } from "./src/waste";
import { TeslaConnectionCard } from "./src/components/TeslaConnectionCard";
import { NumericField, Stepper } from "./src/components/DeviceControls";
import { getTeslaAuthorizationUrl, getTeslaStatus, getTeslaVehicles } from "./src/services/tesla";
import { DEVICE_TEMPLATES, EforsyningData, EnergyClass, HouseholdDevice, TeslaVehicle, WashTemperature } from "./src/types/app";
import { CLASS_ENERGY_KWH, DURATIONS, ENERGY_CLASSES, WASH_TEMPERATURES, WASH_TEMPERATURE_MULTIPLIERS, findBestEnergyWindow, isEnergyClass } from "./src/utils/energyPlanning";
import { dayKey, formatDuration, formatPrice } from "./src/utils/formatting";

const GRID_SUPPLIERS_FALLBACK = GRID_SUPPLIERS;
const DEFAULT_GRID_SUPPLIER: GridSupplier = { id: "n1_c", name: "N1", area: "DK1" };

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

const EFORSYNING_API_URL = "http://localhost:8787";
type DeviceKind = HouseholdDevice["kind"];

const DEVICES_STORAGE_KEY = "stromblik.household-devices.v1";
const PROFILE_STORAGE_KEY = "stromblik.profile.v1";
const ENERGY_CLASS_COLORS: Record<EnergyClass, string> = {
  A: "#2D8A45",
  B: "#62A844",
  C: "#B5C836",
  D: "#F1D13C",
  E: "#F4A62A",
  F: "#E66C2E",
  G: "#C93C35",
};


function getPriceTone(value: number, values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const low = sorted[Math.floor(sorted.length * 0.33)] ?? value;
  const high = sorted[Math.floor(sorted.length * 0.67)] ?? value;
  if (value <= low) return { label: "Lav pris", color: colors.green, soft: "#E2F0E6" };
  if (value >= high) return { label: "Høj pris", color: "#A4462E", soft: "#F8E1D8" };
  return { label: "Mellempris", color: "#745A13", soft: "#F8EDC8" };
}

function DevicePlanCard({ device, points, now, evModels, expanded, onToggle, onChange, onRemove, onToggleDashboard }: {
  device: HouseholdDevice;
  points: PricePoint[];
  now: number;
  evModels: EvModel[];
  expanded: boolean;
  onToggle: () => void;
  onChange: (changes: Partial<HouseholdDevice>) => void;
  onRemove?: () => void;
  onToggleDashboard?: () => void;
}) {
  const isCar = device.kind === "ev";
  const hasCycleEnergyLabel = device.kind === "dishwasher" || device.kind === "laundry" || device.kind === "dryer";
  const energyClass = isEnergyClass(device.energyClass) ? device.energyClass : device.kind === "laundry" ? "A" : "B";
  const temperature = device.temperature ?? 40;
  const estimatedCycleKwh = hasCycleEnergyLabel
    ? CLASS_ENERGY_KWH[device.kind as keyof typeof CLASS_ENERGY_KWH][energyClass]
    : device.energyKwh;
  const cycleEnergyKwh = device.kind === "laundry" ? estimatedCycleKwh * WASH_TEMPERATURE_MULTIPLIERS[temperature] : estimatedCycleKwh;
  const energyKwh = isCar
    ? device.batteryKwh * Math.max(0, device.targetCharge - device.currentCharge) / 100 / 0.9
    : cycleEnergyKwh;
  const durationHours = isCar ? Math.max(0.25, energyKwh / device.chargerKw) : device.durationHours;
  const plan = useMemo(() => findBestEnergyWindow(points, energyKwh, durationHours, now), [durationHours, energyKwh, now, points]);
  const vehicleQuery = (device.vehicleModel ?? "").trim().toLowerCase();
  const vehicleMatches = [...new Map(evModels
    .filter((model) => {
      const name = (model.name ?? "").toLowerCase();
      const modelName = (model.modelName ?? model.name ?? "").toLowerCase();
      return name.includes(vehicleQuery) || modelName.includes(vehicleQuery);
    })
    .sort((left, right) => {
      const leftName = left.modelName ?? left.name ?? "";
      const rightName = right.modelName ?? right.name ?? "";
      const leftStarts = leftName.toLowerCase().startsWith(vehicleQuery) ? 0 : 1;
      const rightStarts = rightName.toLowerCase().startsWith(vehicleQuery) ? 0 : 1;
      return leftStarts - rightStarts || leftName.localeCompare(rightName, "da");
    })
    .map((model) => [(model.modelName ?? model.name), model] as const)).values()].slice(0, 8);
  const endTime = plan ? new Date(plan.cheapest.startsAt.getTime() + durationHours * 3_600_000) : undefined;
  const nowEndTime = new Date(now + durationHours * 3_600_000);
  const selectVehicleModel = (model: EvModel) => {
    onChange({ vehicleModel: model.name, batteryKwh: model.batteryKwh, chargerKw: model.chargerKw ?? device.chargerKw, name: model.name });
  };

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
          {onToggleDashboard ? <Pressable accessibilityLabel={`${device.showOnDashboard ? "Skjul" : "Vis"} ${device.name} på overblik`} onPress={onToggleDashboard} style={[styles.deviceActionButton, device.showOnDashboard && styles.deviceActionButtonActive]}><Feather name="eye" size={16} color={device.showOnDashboard ? colors.green : colors.muted} /></Pressable> : null}
          <Pressable accessibilityLabel={`${expanded ? "Luk" : "Tilpas"} ${device.name}`} onPress={onToggle} style={styles.deviceActionButton}>
            <Feather name={expanded ? "chevron-up" : "sliders"} size={17} color={colors.ink} />
          </Pressable>
          {onRemove ? <Pressable accessibilityLabel={`Fjern ${device.name}`} onPress={onRemove} style={styles.deviceActionButton}>
            <Feather name="trash-2" size={16} color="#A4462E" />
          </Pressable> : null}
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
              <View style={styles.vehicleLookupGroup}>
                <Text style={styles.simpleSettingTitle}>Bilmodel</Text>
                <View style={styles.vehicleLookupRow}>
                  <TextInput
                    accessibilityLabel="Bilmodel"
                    placeholder="Søg bilmodel"
                    placeholderTextColor={colors.muted}
                    value={device.vehicleModel ?? ""}
                    onChangeText={(vehicleModel) => onChange({ vehicleModel })}
                    style={styles.vehiclePlateInput}
                  />
                </View>
                {device.vehicleModel ? (
                  <View style={styles.vehicleModelSuggestions}>
                    {vehicleMatches.map((model) => (
                      <Pressable key={model.name} onPress={() => selectVehicleModel(model)} style={styles.vehicleModelOption}>
                        <Text style={styles.vehicleModelOptionName}>{model.name}</Text>
                        <Text style={styles.vehicleModelOptionBattery}>{model.batteryKwh} kWh</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                <Text style={styles.vehicleLookupHint}>Vælg en model for automatisk batterikapacitet, eller justér den manuelt nedenfor.</Text>
              </View>
              <View style={styles.controlRow}>
                <Stepper label="Batteri" value={device.batteryKwh} min={20} max={150} step={5} suffix=" kWh" onChange={(batteryKwh) => onChange({ batteryKwh })} styles={styles} colors={colors} />
                <Stepper label="Lader" value={device.chargerKw} min={2} max={22} step={1} suffix=" kW" onChange={(chargerKw) => onChange({ chargerKw })} styles={styles} colors={colors} />
              </View>
              <View style={styles.controlRow}>
                <Stepper label="Fra" value={device.currentCharge} min={0} max={Math.max(0, device.targetCharge - 10)} onChange={(currentCharge) => onChange({ currentCharge })} styles={styles} colors={colors} />
                <Stepper label="Til" value={device.targetCharge} min={Math.min(100, device.currentCharge + 10)} max={100} onChange={(targetCharge) => onChange({ targetCharge })} styles={styles} colors={colors} />
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
                      <Pressable key={item} accessibilityRole="radio" accessibilityState={{ checked: energyClass === item }} onPress={() => onChange({ energyClass: item })} style={[styles.classChoice, { backgroundColor: ENERGY_CLASS_COLORS[item] }, energyClass === item && styles.classChoiceActive]}>
                        <Text style={[styles.classChoiceText, (item === "C" || item === "D") && styles.classChoiceTextDark]}>{item}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={styles.estimateCaption}>Estimeret forbrug: {formatPrice(energyKwh, 2)} kWh pr. program</Text>
                </View>
              ) : null}
              {device.kind === "laundry" ? (
                <View style={styles.simpleSettingGroup}>
                  <Text style={styles.simpleSettingTitle}>Vasketemperatur</Text>
                  <View style={styles.durationGrid} accessibilityRole="radiogroup">
                    {WASH_TEMPERATURES.map((item) => (
                      <Pressable key={item} accessibilityRole="radio" accessibilityState={{ checked: temperature === item }} onPress={() => onChange({ temperature: item })} style={[styles.durationChoice, temperature === item && styles.durationChoiceActive]}>
                        <Text style={[styles.durationChoiceText, temperature === item && styles.durationChoiceTextActive]}>{item} °C</Text>
                      </Pressable>
                    ))}
                  </View>
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
                <NumericField label="Forbrug" value={device.energyKwh} suffix=" kWh" onChange={(energyKwh) => onChange({ energyKwh })} styles={styles} colors={colors} />
              ) : null}
              <Text style={styles.deviceHelp}>Beregningen er et estimat ud fra apparattype, energiklasse og valgt køretid.</Text>
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

function FamilyPlanner({ points, now, evModels }: { points: PricePoint[]; now: number; evModels: EvModel[] }) {
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
        setDevices(savedDevices.map((device) => ({
          ...device,
          energyClass: isEnergyClass(device.energyClass) ? device.energyClass : device.kind === "laundry" ? "A" : "B",
          temperature: device.temperature ?? 40,
        })));
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
        registration: "",
        vehicleModel: "",
        energyClass: kind === "laundry" ? "A" : "B",
        temperature: kind === "laundry" ? 40 : undefined,
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
              evModels={evModels}
              expanded={expandedId === device.id}
              onToggle={() => setExpandedId((current) => current === device.id ? null : device.id)}
              onChange={(changes) => setDevices((current) => current.map((item) => item.id === device.id ? { ...item, ...changes } : item))}
              onToggleDashboard={() => setDevices((current) => current.map((item) => item.id === device.id ? { ...item, showOnDashboard: !item.showOnDashboard } : item))}
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

function PriceChart({ points, now, onScrubChange }: { points: PricePoint[]; now: number; onScrubChange?: (isScrubbing: boolean) => void }) {
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

function WasteCollectionCard({ events, error, wasteHealth, showOnDashboard, onToggleDashboard, onOpenProfile }: { events: WasteEvent[]; error: string; wasteHealth: WasteHealth | null; showOnDashboard: boolean; onToggleDashboard: () => void; onOpenProfile?: () => void }) {
  return (
    <View style={styles.wastePanel}>
      <View style={styles.sectionHeadingRow}>
        <View><Text style={styles.pageEyebrow}>AFFALD</Text><Text style={styles.sectionTitle}>Næste afhentning</Text></View>
        <Pressable accessibilityLabel={showOnDashboard ? "Skjul næste afhentning fra overblik" : "Vis næste afhentning på overblik"} onPress={onToggleDashboard} style={[styles.deviceActionButton, showOnDashboard && styles.deviceActionButtonActive]}>
          <Feather name="eye" size={16} color={showOnDashboard ? colors.green : colors.muted} />
        </Pressable>
      </View>
      {events.length ? events.slice(0, 3).map((event) => (
        <View key={event.id} style={styles.wasteEvent}>
          <View style={styles.wasteDate}><Text style={styles.wasteDateDay}>{new Date(`${event.date}T12:00:00`).getDate()}</Text><Text style={styles.wasteDateMonth}>{new Date(`${event.date}T12:00:00`).toLocaleDateString("da-DK", { month: "short" })}</Text></View>
          <View style={styles.wasteEventCopy}><Text style={styles.wasteEventTitle}>{WASTE_LABELS[event.category]}</Text><Text style={styles.wasteEventMeta}>{event.title}</Text></View>
        </View>
      )) : <>
        <Text style={styles.wasteEmpty}>{error || "Tilføj din adresse i Profil for at se affaldsafhentninger."}</Text>
        {!events.length && onOpenProfile ? <Pressable onPress={onOpenProfile} style={styles.wasteAction}><Text style={styles.wasteActionText}>{wasteHealth?.status === "unsupported" ? "Tilføj officiel kalender" : "Åbn Profil"}</Text><Feather name="arrow-right" size={14} color={colors.white} /></Pressable> : null}
      </>}
    </View>
  );
}

function Dashboard() {
  const { width } = useWindowDimensions();
  const isMobile = width < 520;
  const isTablet = width >= 760;
  const [gridSuppliers, setGridSuppliers] = useState<GridSupplier[]>(GRID_SUPPLIERS_FALLBACK);
  const [selectedSupplierId, setSelectedSupplierId] = useState("n1_c");
  const [showSupplierPicker, setShowSupplierPicker] = useState(false);
  const [address, setAddress] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [addressLookupLoading, setAddressLookupLoading] = useState(false);
  const [addressError, setAddressError] = useState("");
  const selectedSupplier = gridSuppliers.find((supplier) => supplier.id === selectedSupplierId) ?? DEFAULT_GRID_SUPPLIER;
  const area = selectedSupplier.area;
  const [now, setNow] = useState(() => Date.now());
  const [prices, setPrices] = useState<PricePoint[]>(() => createSamplePrices(area));
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isSample, setIsSample] = useState(false);
  const [eforsyning, setEforsyning] = useState<EforsyningData | null>(null);
  const [eforsyningUsername, setEforsyningUsername] = useState("");
  const [eforsyningPassword, setEforsyningPassword] = useState("");
  const [eforsyningSupplierId, setEforsyningSupplierId] = useState("");
  const [eforsyningLoading, setEforsyningLoading] = useState(false);
  const [eforsyningError, setEforsyningError] = useState("");
  const [evModels, setEvModels] = useState<EvModel[]>([]);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [quickDevices, setQuickDevices] = useState<HouseholdDevice[]>([]);
  const [expandedQuickId, setExpandedQuickId] = useState<number | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const [addressMunicipality, setAddressMunicipality] = useState<string | undefined>();
  const [addressPostcode, setAddressPostcode] = useState<string | undefined>();
  const [wasteCalendarUrl, setWasteCalendarUrl] = useState("");
  const [wasteEvents, setWasteEvents] = useState<WasteEvent[]>([]);
  const [wasteError, setWasteError] = useState("");
  const [wasteHealth, setWasteHealth] = useState<WasteHealth | null>(null);
  const [wasteShowOnDashboard, setWasteShowOnDashboard] = useState(false);
  const [activeTab, setActiveTab] = useState<"dashboard" | "home" | "profile">("dashboard");
  const [teslaConnected, setTeslaConnected] = useState(false);
  const [teslaVehicle, setTeslaVehicle] = useState<TeslaVehicle | null>(null);
  const [teslaRefreshing, setTeslaRefreshing] = useState(false);
  const [teslaShowOnDashboard, setTeslaShowOnDashboard] = useState(false);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      setPrices(await fetchPrices(selectedSupplier.area, selectedSupplier.id));
      setIsSample(false);
    } catch {
      setPrices(createSamplePrices("DK1"));
      setIsSample(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedSupplier]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const quarterKey = Math.floor(now / (15 * 60 * 1000));
  useEffect(() => {
    void load();
  }, [load, quarterKey]);

  useEffect(() => {
    fetchGridSuppliers().then(setGridSuppliers).catch(() => undefined);
  }, []);

  useEffect(() => {
    fetchOpenEvModels().then(setEvModels).catch(() => undefined);
  }, []);

  const refreshTesla = useCallback(async () => {
    setTeslaRefreshing(true);
    try {
      const data = await getTeslaStatus();
      const connected = Boolean(data.connected);
      setTeslaConnected(connected);
      if (!connected) {
        setTeslaVehicle(null);
        return;
      }
      const vehicles = await getTeslaVehicles();
      setTeslaVehicle(vehicles[0] ?? null);
    } catch {
      setTeslaConnected(false);
      setTeslaVehicle(null);
    } finally {
      setTeslaRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refreshTesla();
  }, [activeTab, refreshTesla]);

  const connectTesla = () => {
    const authorizationUrl = getTeslaAuthorizationUrl();
    if (typeof window !== "undefined") window.location.assign(authorizationUrl);
    else void Linking.openURL(authorizationUrl);
  };

  useEffect(() => {
    AsyncStorage.getItem(PROFILE_STORAGE_KEY).then((stored) => {
      if (!stored) return;
      const profile = JSON.parse(stored) as { name?: string; email?: string; address?: string; municipalityCode?: string; postcode?: string; wasteCalendarUrl?: string; wasteShowOnDashboard?: boolean; teslaShowOnDashboard?: boolean };
      setProfileName(profile.name ?? "");
      setProfileEmail(profile.email ?? "");
      setAddress(profile.address ?? "");
      setAddressMunicipality(profile.municipalityCode);
      setAddressPostcode(profile.postcode);
      setWasteCalendarUrl(profile.wasteCalendarUrl ?? "");
      setWasteShowOnDashboard(profile.wasteShowOnDashboard ?? false);
      setTeslaShowOnDashboard(profile.teslaShowOnDashboard ?? false);
    }).catch(() => undefined);
    AsyncStorage.getItem(DEVICES_STORAGE_KEY).then((stored) => {
      if (!stored) return;
      const savedDevices = JSON.parse(stored) as HouseholdDevice[];
      if (Array.isArray(savedDevices)) setQuickDevices(savedDevices);
    }).catch(() => undefined);
  }, [activeTab]);

  useEffect(() => {
    if (!addressMunicipality) return;
    fetchWasteHealth(addressMunicipality).then(setWasteHealth).catch(() => setWasteHealth(null));
    fetchWasteEvents(addressMunicipality, addressPostcode, wasteCalendarUrl, address).then((events) => {
      setWasteEvents(events.filter((event) => new Date(`${event.date}T23:59:59`).getTime() >= Date.now()).slice(0, 8));
      setWasteError("");
    }).catch((error) => { setWasteEvents([]); setWasteError(error instanceof Error ? error.message : "Affaldskalenderen kunne ikke hentes"); });
  }, [addressMunicipality, addressPostcode, wasteCalendarUrl, address]);

  const saveTeslaVisibility = (showOnDashboard: boolean) => {
    setTeslaShowOnDashboard(showOnDashboard);
    void AsyncStorage.mergeItem(PROFILE_STORAGE_KEY, JSON.stringify({ teslaShowOnDashboard: showOnDashboard }));
  };

  const saveProfile = async () => {
    await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({ name: profileName, email: profileEmail, address, municipalityCode: addressMunicipality, postcode: addressPostcode, wasteCalendarUrl, wasteShowOnDashboard, teslaShowOnDashboard }));
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 1800);
  };

  useEffect(() => {
    if (address.trim().length < 3) {
      setAddressSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      searchAddresses(address).then(setAddressSuggestions).catch(() => setAddressSuggestions([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [address]);

  const chooseAddress = async (suggestion: AddressSuggestion) => {
    setAddress(suggestion.text);
    setAddressMunicipality(suggestion.municipalityCode);
    setAddressPostcode(suggestion.postcode);
    void AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({ name: profileName, email: profileEmail, address: suggestion.text, municipalityCode: suggestion.municipalityCode, postcode: suggestion.postcode }));
    setAddressSuggestions([]);
    setAddressError("");
    setAddressLookupLoading(true);
    try {
      const response = await fetch(`${EFORSYNING_API_URL}/api/grid/lookup?x=${suggestion.x}&y=${suggestion.y}`);
      const result = await response.json() as { name?: string; error?: string };
      if (!response.ok || !result.name) throw new Error(result.error ?? "Netselskabet kunne ikke findes");
      const supplierTokens = (value: string) => value.toLowerCase()
        .replace(/[^a-z0-9æøå]+/g, " ")
        .split(" ")
        .filter((token) => (token.length > 2 || /\d/.test(token)) && !["a/s", "as", "net", "elnet", "netselskab"].includes(token));
      const supplierTokensFound = supplierTokens(result.name);
      const canonicalSupplierId = supplierTokensFound.includes("n1") ? "n1_c" : undefined;
      const match = (canonicalSupplierId && gridSuppliers.find((supplier) => supplier.id === canonicalSupplierId)) ?? gridSuppliers.find((supplier) => {
        return [supplier.name, supplier.companyName ?? ""].some((name) => {
          const candidateTokens = supplierTokens(name);
          return supplierTokensFound.some((token) => candidateTokens.includes(token));
        });
      });
      if (match) {
        setSelectedSupplierId(match.id);
        setShowSupplierPicker(false);
      }
      else setAddressError(`${result.name} blev fundet, men findes ikke i prislisten endnu.`);
    } catch (error) {
      setAddressError(error instanceof Error ? error.message : "Netselskabet kunne ikke findes");
    } finally {
      setAddressLookupLoading(false);
    }
  };

  const loginToEforsyning = async () => {
    setEforsyningLoading(true);
    setEforsyningError("");
    try {
      const response = await fetch(`${EFORSYNING_API_URL}/api/eforsyning/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: eforsyningUsername, password: eforsyningPassword, supplierId: eforsyningSupplierId }),
      });
      const data = await response.json() as EforsyningData & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Login mislykkedes");
      setEforsyning(data);
      setEforsyningPassword("");
    } catch (error) {
      setEforsyningError(error instanceof Error ? error.message : "Login mislykkedes");
    } finally {
      setEforsyningLoading(false);
    }
  };

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

  const [chartScrubbing, setChartScrubbing] = useState(false);

  const navigation = (
    <View style={styles.bottomNavigation}>
      {(["dashboard", "home", "profile"] as const).map((tab) => (
        <Pressable key={tab} onPress={() => setActiveTab(tab)} style={[styles.navigationItem, activeTab === tab && styles.navigationItemActive]}>
          <Feather name={tab === "dashboard" ? "activity" : tab === "home" ? "home" : "user"} size={17} color={activeTab === tab ? colors.green : colors.muted} />
          <Text style={[styles.navigationText, activeTab === tab && styles.navigationTextActive]}>{tab === "dashboard" ? "Overblik" : tab === "home" ? "Mit hjem" : "Profil"}</Text>
        </Pressable>
      ))}
    </View>
  );

  if (activeTab !== "dashboard") {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={[styles.container, isMobile && styles.containerMobile]}>
            <View style={styles.header}>
              <View><Text style={styles.brand}>STRØMBLIK</Text><Text style={styles.date}>{dkDay.format(new Date(now))}</Text></View>
              <Pressable accessibilityLabel="Opdater priser" onPress={() => void load(true)} style={styles.iconButton}><Feather name="refresh-cw" size={19} color={colors.ink} /></Pressable>
            </View>
            {activeTab === "home" ? (
              <>
                <Text style={styles.pageEyebrow}>MIT HJEM</Text>
                <Text style={styles.pageTitle}>Apparater og elbil</Text>
                <Text style={styles.pageIntro}>Gem dine apparater ét sted. Finjustér program, temperatur, lader og batteriniveau, når du planlægger.</Text>
                <TeslaConnectionCard connected={teslaConnected} vehicle={teslaVehicle} points={prices} now={now} evModels={evModels} refreshing={teslaRefreshing} showOnDashboard={teslaShowOnDashboard} onConnect={connectTesla} onRefresh={() => void refreshTesla()} onToggleDashboard={() => saveTeslaVisibility(!teslaShowOnDashboard)} />
                <FamilyPlanner points={prices} now={now} evModels={evModels} />
              </>
            ) : (
              <>
                <Text style={styles.pageEyebrow}>MIN PROFIL</Text>
                <Text style={styles.pageTitle}>Dine oplysninger</Text>
                <View style={styles.profileCard}>
                  <View style={styles.profileAvatar}><Feather name="user" size={24} color={colors.green} /></View>
                  <TextInput accessibilityLabel="Navn" placeholder="Dit navn" placeholderTextColor={colors.muted} value={profileName} onChangeText={setProfileName} style={styles.profileInput} />
                  <TextInput accessibilityLabel="Email" placeholder="din@email.dk" placeholderTextColor={colors.muted} keyboardType="email-address" autoCapitalize="none" value={profileEmail} onChangeText={setProfileEmail} style={styles.profileInput} />
                  <Pressable onPress={() => void saveProfile()} style={styles.profileSaveButton}><Text style={styles.profileSaveText}>{profileSaved ? "Gemt" : "Gem profil"}</Text></Pressable>
                </View>
                <Text style={styles.pageEyebrow}>MIN ADRESSE</Text>
                <Text style={styles.sectionTitle}>Find mit netselskab</Text>
                <Text style={styles.pageIntro}>Indtast din adresse, så bruger appen automatisk det rigtige netselskab på dashboardet.</Text>
                <View style={styles.profileAddressCard}>
                  <View style={styles.addressSearchWrap}>
                    <View style={styles.addressIconWrap}><Feather name="map-pin" size={16} color={colors.green} /></View>
                    <TextInput accessibilityLabel="Profiladresse" value={address} onChangeText={(value) => { setAddress(value); setAddressError(""); }} placeholder="Indtast din adresse" placeholderTextColor={colors.muted} style={styles.addressInput} />
                    {addressLookupLoading ? <ActivityIndicator size="small" color={colors.green} /> : null}
                  </View>
                  {addressSuggestions.map((suggestion) => <Pressable key={suggestion.id} onPress={() => void chooseAddress(suggestion)} style={styles.addressSuggestion}><Text style={styles.addressSuggestionText}>{suggestion.text}</Text></Pressable>)}
                  {addressError ? <Text style={styles.addressError}>{addressError}</Text> : null}
                  <View style={styles.currentSupplierRow}><Text style={styles.currentSupplierLabel}>AKTUELT NETSELSKAB</Text><Text style={styles.currentSupplierName}>{selectedSupplier.name} · {selectedSupplier.area}</Text></View>
                </View>
              </>
            )}
            {navigation}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar style="dark" />
      <ScrollView
        style={styles.dashboardScroll}
        contentContainerStyle={[styles.scrollContent, styles.scrollContentGrow]}
        nestedScrollEnabled
        scrollEnabled={!chartScrubbing}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.green} />}
      >
        <View style={[styles.container, isMobile && styles.containerMobile]}>
          <View style={styles.header}>
            <View>
              <Text style={styles.brand}>STRØMBLIK</Text>
              <Text style={styles.date}>{dkDay.format(new Date(now))}</Text>
            </View>
            <Pressable accessibilityLabel="Opdater priser" onPress={() => void load(true)} style={styles.iconButton}>
              <Feather name="refresh-cw" size={19} color={colors.ink} />
            </Pressable>
          </View>
          {navigation}

          <View style={styles.dashboardContext}><Text style={styles.dashboardContextLabel}>PRISER FRA</Text><Text style={styles.dashboardContextValue}>{selectedSupplier.name} · {area}</Text></View>

          {isSample ? (
            <View style={styles.notice}>
              <Feather name="wifi-off" size={16} color="#8A492F" />
              <Text style={styles.noticeText}>Offlinevisning: eksempelpriser vises</Text>
            </View>
          ) : null}

          <View style={[styles.trendPanel, isMobile && styles.trendPanelMobile]}>
            <View style={styles.sectionHeadingRow}>
              <View>
                <Text style={styles.eyebrow}>TIMEPRISER · OP TIL 7 DAGE</Text>
                <Text style={styles.sectionTitle}>Prisens bevægelse</Text>
              </View>
              {loading ? <ActivityIndicator color={colors.green} size="small" /> : <Feather name="trending-up" size={22} color={colors.coral} />}
            </View>
            <PriceChart points={prices} now={now} onScrubChange={setChartScrubbing} />
          </View>

          <View style={styles.dashboardDevicesSummary}>
            <Text style={styles.pageEyebrow}>MIT HJEM</Text>
            <Text style={styles.dashboardSummaryText}>Dine apparater og elbil ligger samlet i Mit hjem.</Text>
            {teslaShowOnDashboard ? <TeslaConnectionCard connected={teslaConnected} vehicle={teslaVehicle} points={prices} now={now} evModels={evModels} refreshing={teslaRefreshing} showOnDashboard={teslaShowOnDashboard} onConnect={connectTesla} onRefresh={() => void refreshTesla()} onToggleDashboard={() => saveTeslaVisibility(false)} /> : null}
            {quickDevices.filter((device) => device.showOnDashboard).length ? (
              <View style={styles.quickDeviceList}>
                {quickDevices.filter((device) => device.showOnDashboard).map((device) => (
                  <DevicePlanCard
                    key={device.id}
                    device={device}
                    points={prices}
                    now={now}
                    evModels={evModels}
                    expanded={expandedQuickId === device.id}
                    onToggle={() => setExpandedQuickId((current) => current === device.id ? null : device.id)}
                    onChange={(changes) => {
                      const next = quickDevices.map((item) => item.id === device.id ? { ...item, ...changes } : item);
                      setQuickDevices(next);
                      void AsyncStorage.setItem(DEVICES_STORAGE_KEY, JSON.stringify(next));
                    }}
                  />
                ))}
              </View>
            ) : <Text style={styles.dashboardSummaryText}>Vælg “Vis på overblik” på en enhed i Mit hjem for hurtig adgang her.</Text>}
            <Pressable onPress={() => setActiveTab("home")} style={styles.dashboardSummaryButton}><Text style={styles.dashboardSummaryButtonText}>Åbn Mit hjem</Text><Feather name="arrow-right" size={15} color={colors.white} /></Pressable>
          </View>

          {eforsyning ? (
            <View style={styles.utilityPanel}>
              <View style={styles.sectionHeadingRow}>
                <View>
                  <Text style={styles.eyebrow}>FORSYNING · SENESTE AFLÆSNING</Text>
                  <Text style={styles.sectionTitle}>Varme og vand</Text>
                </View>
                <Feather name="droplet" size={21} color={colors.green} />
              </View>
              <View style={styles.utilityGrid}>
                <View style={styles.utilityValue}>
                  <Text style={styles.utilityLabel}>VARME</Text>
                  <Text style={styles.utilityNumber}>{eforsyning.heating.usedKwh == null ? "–" : formatPrice(eforsyning.heating.usedKwh, 1)}</Text>
                  <Text style={styles.utilityUnit}>kWh</Text>
                </View>
                <View style={styles.utilityValue}>
                  <Text style={styles.utilityLabel}>VAND</Text>
                  <Text style={styles.utilityNumber}>{eforsyning.water.usedM3 == null ? "–" : formatPrice(eforsyning.water.usedM3, 2)}</Text>
                  <Text style={styles.utilityUnit}>m³</Text>
                </View>
                <View style={styles.utilityValue}>
                  <Text style={styles.utilityLabel}>AFKØLING</Text>
                  <Text style={styles.utilityNumber}>{eforsyning.temperatures.coolingC == null ? "–" : formatPrice(eforsyning.temperatures.coolingC, 1)}</Text>
                  <Text style={styles.utilityUnit}>°C</Text>
                </View>
              </View>
              <Text style={styles.utilityMeta}>{eforsyning.period.from ?? ""} – {eforsyning.period.to ?? ""}</Text>
            </View>
          ) : (
            <View style={styles.loginPanel}>
              <View style={styles.sectionHeadingRow}>
                <View style={styles.loginHeadingCopy}>
                  <Text style={styles.eyebrow}>FORSYNING</Text>
                  <Text style={styles.sectionTitle}>Se varmeforbrug</Text>
                </View>
                <Feather name="lock" size={20} color={colors.green} />
              </View>
              <Text style={styles.loginText}>Log ind med oplysningerne fra din eForsyning-regning for at se varme, vand og afkøling.</Text>
              <TextInput accessibilityLabel="Brugernummer" autoCapitalize="none" placeholder="Brugernummer" placeholderTextColor={colors.muted} value={eforsyningUsername} onChangeText={setEforsyningUsername} style={styles.loginInput} />
              <TextInput accessibilityLabel="Adgangskode" autoCapitalize="none" placeholder="Adgangskode" placeholderTextColor={colors.muted} secureTextEntry value={eforsyningPassword} onChangeText={setEforsyningPassword} style={styles.loginInput} />
              <TextInput accessibilityLabel="Forsynings-ID" autoCapitalize="none" placeholder="Forsynings-ID" placeholderTextColor={colors.muted} value={eforsyningSupplierId} onChangeText={setEforsyningSupplierId} style={styles.loginInput} />
              {eforsyningError ? <Text style={styles.loginError}>{eforsyningError}</Text> : null}
              <Pressable disabled={eforsyningLoading} onPress={() => void loginToEforsyning()} style={[styles.loginButton, eforsyningLoading && styles.loginButtonDisabled]}>
                <Feather name={eforsyningLoading ? "loader" : "log-in"} size={16} color={colors.white} />
                <Text style={styles.loginButtonText}>{eforsyningLoading ? "Logger ind..." : "Log ind og vis forbrug"}</Text>
              </Pressable>
              <Text style={styles.loginPrivacy}>Oplysningerne sendes til din lokale proxy og gemmes ikke i appen.</Text>
            </View>
          )}

        </View>
      </ScrollView>
      <Modal visible={showSupplierPicker} transparent animationType="slide" onRequestClose={() => setShowSupplierPicker(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.supplierModal}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.eyebrow}>ELNET</Text>
                <Text style={styles.sectionTitle}>Vælg netselskab</Text>
              </View>
              <Pressable accessibilityLabel="Luk netselskaber" onPress={() => setShowSupplierPicker(false)} style={styles.modalClose}>
                <Feather name="x" size={19} color={colors.ink} />
              </Pressable>
            </View>
            <Text style={styles.modalHint}>Vælg direkte fra listen, eller find netselskabet via din adresse.</Text>
            <Text style={styles.addressSectionLabel}>FIND VIA ADRESSE</Text>
            <View style={styles.addressSearchWrap}>
              <View style={styles.addressIconWrap}>
                <Feather name="map-pin" size={16} color={colors.green} />
              </View>
              <View style={styles.addressInputCopy}>
                <TextInput
                  accessibilityLabel="Søg adresse"
                  value={address}
                  onChangeText={(value) => { setAddress(value); setAddressError(""); }}
                  placeholder="Indtast din adresse"
                  placeholderTextColor={colors.muted}
                  style={styles.addressInput}
                />
              </View>
              {addressLookupLoading ? <ActivityIndicator size="small" color={colors.green} /> : null}
            </View>
            {addressSuggestions.length ? (
              <View style={styles.addressSuggestions}>
                {addressSuggestions.map((suggestion) => (
                  <Pressable key={suggestion.id} onPress={() => void chooseAddress(suggestion)} style={styles.addressSuggestion}>
                    <Text style={styles.addressSuggestionText}>{suggestion.text}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {addressError ? <Text style={styles.addressError}>{addressError}</Text> : null}
            <View style={styles.manualChoiceHeading}>
              <Text style={styles.addressSectionLabel}>VÆLG MANUELT</Text>
              <View style={styles.manualChoiceLine} />
            </View>
            <ScrollView style={styles.supplierList} showsVerticalScrollIndicator={false}>
              {gridSuppliers.map((supplier) => (
                <Pressable
                  key={supplier.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: supplier.id === selectedSupplier.id }}
                  onPress={() => { setSelectedSupplierId(supplier.id); setShowSupplierPicker(false); }}
                  style={[styles.supplierOption, supplier.id === selectedSupplier.id && styles.supplierOptionActive]}
                >
                  <View style={styles.supplierOptionCopy}>
                    <Text style={styles.supplierOptionName}>{supplier.name}</Text>
                    <Text style={styles.supplierOptionArea}>{supplier.area}</Text>
                  </View>
                  {supplier.id === selectedSupplier.id ? <Feather name="check" size={18} color={colors.green} /> : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  dashboardScroll: { flex: 1 },
  scrollContent: { paddingBottom: 68 },
  scrollContentGrow: { flexGrow: 1 },
  container: { width: "100%", maxWidth: 1120, alignSelf: "center", paddingHorizontal: 20 },
  containerMobile: { paddingHorizontal: 12 },
  header: { minHeight: 96, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { fontFamily: "DMSans_700Bold", fontSize: 18, color: colors.ink, letterSpacing: 0 },
  date: { fontFamily: "DMSans_400Regular", fontSize: 13, color: colors.muted, marginTop: 3, textTransform: "capitalize" },
  iconButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center", backgroundColor: colors.white },
  supplierPickerButton: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, borderRadius: 8, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, marginBottom: 20 },
  supplierPickerCopy: { flex: 1 },
  supplierPickerLabel: { fontFamily: "DMSans_700Bold", fontSize: 9, color: colors.muted },
  supplierPickerName: { fontFamily: "DMSans_700Bold", fontSize: 14, color: colors.ink, marginTop: 3 },
  supplierPickerArea: { fontFamily: "DMSans_700Bold", fontSize: 11, color: colors.green, backgroundColor: colors.mint, paddingVertical: 5, paddingHorizontal: 8, borderRadius: 5 },
  dashboardContext: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 2, marginBottom: 14 },
  dashboardContextLabel: { fontFamily: "DMSans_700Bold", fontSize: 9, color: colors.muted },
  dashboardContextValue: { fontFamily: "DMSans_700Bold", fontSize: 11, color: colors.green },
  addressSectionLabel: { fontFamily: "DMSans_700Bold", fontSize: 9, letterSpacing: 0.2, color: colors.muted, marginTop: 16, marginBottom: 7 },
  addressSearchWrap: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 10, padding: 8, borderRadius: 8, backgroundColor: colors.white, borderWidth: 1, borderColor: "#C9D5C7", marginTop: 0 },
  addressIconWrap: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 6, backgroundColor: colors.mint },
  addressInputCopy: { flex: 1, minWidth: 0 },
  addressInput: { minWidth: 0, paddingVertical: 7, fontFamily: "DMSans_400Regular", fontSize: 13, color: colors.ink },
  addressSuggestions: { backgroundColor: colors.white, borderRadius: 7, borderWidth: 1, borderColor: colors.line, marginTop: 8, marginBottom: 12, overflow: "hidden" },
  addressSuggestion: { minHeight: 42, justifyContent: "center", paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  addressSuggestionText: { fontFamily: "DMSans_500Medium", fontSize: 12, color: colors.ink },
  addressError: { fontFamily: "DMSans_400Regular", fontSize: 10, lineHeight: 15, color: "#A4462E", marginTop: 6, marginHorizontal: 2 },
  notice: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: "#F8E1D8", borderRadius: 6, marginBottom: 16 },
  noticeText: { fontFamily: "DMSans_500Medium", fontSize: 13, color: "#8A492F" },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(24,51,47,0.28)" },
  supplierModal: { maxHeight: "82%", backgroundColor: colors.paper, borderTopLeftRadius: 14, borderTopRightRadius: 14, padding: 20 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalClose: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18, backgroundColor: colors.white },
  modalHint: { fontFamily: "DMSans_400Regular", fontSize: 12, color: colors.muted, marginTop: 8, marginBottom: 12 },
  manualChoiceHeading: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 7 },
  manualChoiceLine: { flex: 1, height: 1, backgroundColor: colors.line },
  supplierList: { flexGrow: 0, marginTop: 8 },
  supplierOption: { minHeight: 54, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, borderRadius: 7, backgroundColor: colors.white, marginBottom: 7, borderWidth: 1, borderColor: "#E3E3D9" },
  supplierOptionActive: { borderColor: colors.green, backgroundColor: "#EDF3E9" },
  supplierOptionCopy: { flex: 1 },
  supplierOptionName: { fontFamily: "DMSans_700Bold", fontSize: 12, color: colors.ink },
  supplierOptionArea: { fontFamily: "DMSans_400Regular", fontSize: 10, color: colors.muted, marginTop: 3 },
  utilityPanel: { backgroundColor: colors.white, borderRadius: 8, padding: 18, borderWidth: 1, borderColor: "#E8E6DC", marginTop: 8, marginBottom: 28 },
  utilityGrid: { flexDirection: "row", gap: 8, marginTop: 16 },
  utilityValue: { flex: 1, backgroundColor: "#F1F3ED", borderRadius: 6, padding: 10 },
  utilityLabel: { fontFamily: "DMSans_700Bold", fontSize: 9, color: colors.muted },
  utilityNumber: { fontFamily: "Fraunces_600SemiBold", fontSize: 25, color: colors.ink, marginTop: 5 },
  utilityUnit: { fontFamily: "DMSans_400Regular", fontSize: 10, color: colors.muted, marginTop: 1 },
  utilityMeta: { fontFamily: "DMSans_400Regular", fontSize: 10, color: colors.muted, marginTop: 12, textTransform: "capitalize" },
  loginPanel: { backgroundColor: "#E7EEE4", borderRadius: 8, padding: 18, marginTop: 8, marginBottom: 28 },
  loginHeadingCopy: { flex: 1 },
  loginText: { fontFamily: "DMSans_400Regular", fontSize: 12, lineHeight: 18, color: colors.muted, marginTop: 12, marginBottom: 12 },
  loginInput: { minHeight: 42, borderRadius: 6, borderWidth: 1, borderColor: "#C9D5C7", backgroundColor: colors.white, paddingHorizontal: 12, marginTop: 7, fontFamily: "DMSans_400Regular", fontSize: 13, color: colors.ink },
  loginError: { fontFamily: "DMSans_500Medium", fontSize: 11, lineHeight: 16, color: "#A4462E", marginTop: 9 },
  loginButton: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 6, backgroundColor: colors.green, marginTop: 12, paddingHorizontal: 14 },
  loginButtonDisabled: { opacity: 0.65 },
  loginButtonText: { fontFamily: "DMSans_700Bold", fontSize: 12, color: colors.white },
  loginPrivacy: { fontFamily: "DMSans_400Regular", fontSize: 10, lineHeight: 15, color: colors.muted, textAlign: "center", marginTop: 10 },
  topGrid: { gap: 14 },
  topGridTablet: { flexDirection: "row" },
  halfPanel: { flex: 1 },
  hero: { minHeight: 315, borderRadius: 8, padding: 24, justifyContent: "space-between", overflow: "hidden" },
  heroMobile: { minHeight: 270, padding: 18 },
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
  trendPanelMobile: { minHeight: 315, padding: 15 },
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
  chartSelectionHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  chartSelectionTime: { fontFamily: "DMSans_700Bold", color: colors.ink, fontSize: 13 },
  scrubBadge: { backgroundColor: colors.mint, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4 },
  scrubBadgeText: { fontFamily: "DMSans_700Bold", fontSize: 9, color: colors.green, textTransform: "uppercase" },
  chartSelectionValue: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  chartSelectionPrice: { fontFamily: "Fraunces_600SemiBold", color: colors.ink, fontSize: 38, lineHeight: 43 },
  chartSelectionUnit: { fontFamily: "DMSans_500Medium", color: colors.muted, fontSize: 13 },
  barViewport: { height: 156, overflow: "hidden", position: "relative" },
  barChart: { height: 156, flexDirection: "row", alignItems: "flex-end", gap: 4, paddingTop: 14, paddingBottom: 6, paddingHorizontal: 16 },
  barChartOverview: { minWidth: "100%", gap: 1, paddingHorizontal: 4 },
  barSlot: { width: 27, height: "100%", justifyContent: "flex-end", alignItems: "center", position: "relative" },
  barSlotOverview: { width: "auto", flex: 1 },
  barSlotSelected: { backgroundColor: "rgba(22, 59, 71, 0.08)", borderRadius: 4 },
  bar: { width: 27, minHeight: 30, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  barOverview: { width: "100%", borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  barHour: { height: 18, paddingTop: 4, fontFamily: "DMSans_400Regular", fontSize: 9, color: colors.muted },
  barHourOverview: { fontSize: 8 },
  barHourCurrent: { fontFamily: "DMSans_700Bold", color: colors.ink },
  currentBar: { borderWidth: 2, borderColor: colors.ink },
  cheapestBar: { borderWidth: 2, borderColor: colors.green },
  selectedBar: { borderWidth: 2, borderColor: colors.navy },
  currentMarker: { position: "absolute", backgroundColor: colors.ink, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 2, zIndex: 2 },
  cheapestMarker: { backgroundColor: colors.green },
  scrubMarker: { backgroundColor: colors.navy },
  currentMarkerText: { fontFamily: "DMSans_700Bold", fontSize: 8, color: colors.white },
  railFadeLeft: { position: "absolute", left: 0, top: 0, bottom: 0, width: 16, pointerEvents: "none" },
  railFadeRight: { position: "absolute", right: 0, top: 0, bottom: 0, width: 16, pointerEvents: "none" },
  sliderWrapper: { marginHorizontal: 10, marginTop: 2, marginBottom: 4 },
  sliderTouchArea: { height: 22, justifyContent: "center", position: "relative" },
  sliderDot: { position: "absolute", top: 6, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.green },
  sliderDotActive: { backgroundColor: colors.ink, transform: [{ scale: 1.3 }] },
  swipeHint: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 7 },
  chartToolbar: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 7 },
  overviewButton: { minHeight: 30, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, borderRadius: 5, backgroundColor: "#ECEFE5" },
  overviewButtonText: { fontFamily: "DMSans_700Bold", fontSize: 10, color: colors.ink },
  chartLabel: { fontFamily: "DMSans_400Regular", color: colors.muted, fontSize: 10 },
  chartLabelActive: { color: colors.green, fontFamily: "DMSans_700Bold" },
  teslaCard: { marginTop: 18, padding: 15, borderRadius: 8, backgroundColor: "#E8F0EC", borderWidth: 1, borderColor: "#C7D9CD" },
  teslaCardHeader: { flexDirection: "row", alignItems: "center", gap: 11 },
  teslaIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.white },
  teslaCardCopy: { flex: 1 },
  teslaCardActions: { alignItems: "center", gap: 8 },
  teslaVisibilityButton: { width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "rgba(255,254,250,0.7)" },
  teslaVisibilityButtonActive: { backgroundColor: colors.white },
  teslaCardTitle: { fontFamily: "DMSans_700Bold", fontSize: 14, color: colors.ink },
  teslaCardText: { fontFamily: "DMSans_400Regular", fontSize: 11, lineHeight: 16, color: colors.muted, marginTop: 3 },
  teslaStatusDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#B6C0BA" },
  teslaStatusDotConnected: { backgroundColor: colors.green },
  teslaStats: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 15, paddingTop: 13, borderTopWidth: 1, borderTopColor: "#C7D9CD" },
  teslaPrimaryStat: { minWidth: 92, flex: 1, paddingRight: 8 },
  teslaStat: { minWidth: 92, flex: 1, paddingRight: 8 },
  teslaBatteryNumber: { fontFamily: "Fraunces_600SemiBold", fontSize: 28, color: colors.ink },
  teslaStatValue: { minHeight: 34, fontFamily: "DMSans_700Bold", fontSize: 13, color: colors.ink },
  teslaStatLabel: { fontFamily: "DMSans_700Bold", fontSize: 8, color: colors.muted, marginTop: 3 },
  teslaConnectButton: { minHeight: 36, marginTop: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 18, backgroundColor: colors.ink },
  teslaConnectButtonText: { fontFamily: "DMSans_700Bold", fontSize: 11, color: colors.white },
  plannerSection: { marginVertical: 26 },
  plannerHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  addDeviceButton: { minHeight: 38, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 13, borderRadius: 19, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  addDeviceButtonActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  addDeviceText: { fontFamily: "DMSans_700Bold", fontSize: 11, color: colors.ink },
  addDeviceTextActive: { color: colors.white },
  deviceCatalog: { backgroundColor: "#E7EEE4", borderRadius: 8, padding: 14, marginBottom: 12 },
  catalogLabel: { fontFamily: "DMSans_700Bold", fontSize: 10, color: colors.muted, marginBottom: 10 },
  catalogGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catalogItem: { flexGrow: 1, flexBasis: "45%", minHeight: 62, flexDirection: "row", alignItems: "center", gap: 8, padding: 9, borderRadius: 6, backgroundColor: colors.white, borderWidth: 1, borderColor: "#D7DFD4" },
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
  deviceActionButtonActive: { backgroundColor: colors.mint },
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
  classChoice: { width: "22%", minHeight: 40, alignItems: "center", justifyContent: "center", borderRadius: 5, borderWidth: 1, borderColor: "transparent", opacity: 0.72 },
  classChoiceActive: { borderWidth: 3, borderColor: colors.ink, opacity: 1 },
  classChoiceText: { fontFamily: "DMSans_700Bold", fontSize: 12, color: colors.white },
  classChoiceTextDark: { color: colors.ink },
  estimateCaption: { fontFamily: "DMSans_500Medium", fontSize: 10, color: colors.green, marginTop: 7 },
  durationGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  durationChoice: { width: "23%", minHeight: 35, alignItems: "center", justifyContent: "center", borderRadius: 5, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  durationChoiceActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  durationChoiceText: { fontFamily: "DMSans_500Medium", fontSize: 10, color: colors.muted },
  durationChoiceTextActive: { fontFamily: "DMSans_700Bold", color: colors.white },
  controlRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  vehicleLookupGroup: { marginBottom: 14 },
  vehicleLookupRow: { flexDirection: "row", gap: 8 },
  vehiclePlateInput: { flex: 1, minWidth: 0, minHeight: 38, borderRadius: 6, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 10, fontFamily: "DMSans_700Bold", fontSize: 13, color: colors.ink },
  vehicleModelSuggestions: { marginTop: 6, borderRadius: 6, overflow: "hidden", borderWidth: 1, borderColor: colors.line },
  vehicleModelOption: { minHeight: 36, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.line },
  vehicleModelOptionName: { fontFamily: "DMSans_500Medium", fontSize: 11, color: colors.ink },
  vehicleModelOptionBattery: { fontFamily: "DMSans_700Bold", fontSize: 10, color: colors.green },
  vehicleLookupHint: { fontFamily: "DMSans_400Regular", fontSize: 10, lineHeight: 15, color: colors.muted, marginTop: 6 },
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
  bottomNavigation: { flexDirection: "row", gap: 6, padding: 5, marginBottom: 20, borderRadius: 8, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  navigationItem: { flex: 1, minHeight: 42, alignItems: "center", justifyContent: "center", gap: 4, borderRadius: 6 },
  navigationItemActive: { backgroundColor: colors.mint },
  navigationText: { fontFamily: "DMSans_500Medium", fontSize: 10, color: colors.muted },
  navigationTextActive: { fontFamily: "DMSans_700Bold", color: colors.green },
  pageEyebrow: { fontFamily: "DMSans_700Bold", fontSize: 10, color: colors.muted, marginTop: 10 },
  pageTitle: { fontFamily: "Fraunces_600SemiBold", fontSize: 32, lineHeight: 38, color: colors.ink, marginTop: 5 },
  pageIntro: { fontFamily: "DMSans_400Regular", fontSize: 13, lineHeight: 19, color: colors.muted, marginTop: 8, marginBottom: 18 },
  profileCard: { alignItems: "center", padding: 24, marginVertical: 18, borderRadius: 8, backgroundColor: colors.white, borderWidth: 1, borderColor: "#E8E6DC" },
  profileAvatar: { width: 58, height: 58, alignItems: "center", justifyContent: "center", borderRadius: 29, backgroundColor: colors.mint },
  profileName: { fontFamily: "Fraunces_600SemiBold", fontSize: 23, color: colors.ink, marginTop: 12 },
  profileEmail: { fontFamily: "DMSans_400Regular", fontSize: 13, color: colors.muted, marginTop: 3 },
  profileInput: { width: "100%", minHeight: 44, marginTop: 8, paddingHorizontal: 12, borderRadius: 6, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, fontFamily: "DMSans_400Regular", fontSize: 13, color: colors.ink },
  profileSaveButton: { minHeight: 38, minWidth: 120, alignItems: "center", justifyContent: "center", marginTop: 12, paddingHorizontal: 18, borderRadius: 6, backgroundColor: colors.green },
  profileSaveText: { fontFamily: "DMSans_700Bold", fontSize: 11, color: colors.white },
  profileAddressCard: { padding: 14, marginTop: 10, borderRadius: 8, backgroundColor: "#E7EEE4" },
  currentSupplierRow: { paddingTop: 14, marginTop: 12, borderTopWidth: 1, borderTopColor: "#C9D5C7" },
  currentSupplierLabel: { fontFamily: "DMSans_700Bold", fontSize: 9, color: colors.muted },
  currentSupplierName: { fontFamily: "DMSans_700Bold", fontSize: 14, color: colors.ink, marginTop: 4 },
  dashboardDevicesSummary: { padding: 18, marginTop: 22, marginBottom: 28, borderRadius: 8, backgroundColor: colors.white, borderWidth: 1, borderColor: "#E8E6DC" },
  dashboardSummaryText: { fontFamily: "DMSans_400Regular", fontSize: 13, color: colors.muted, marginTop: 5 },
  quickDeviceList: { gap: 7, marginTop: 14 },
  quickDeviceItem: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 9, borderRadius: 6, backgroundColor: "#F1F3ED" },
  quickDeviceIcon: { width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: colors.mint },
  quickDeviceCopy: { flex: 1 },
  quickDeviceName: { fontFamily: "DMSans_700Bold", fontSize: 12, color: colors.ink },
  quickDeviceMeta: { fontFamily: "DMSans_400Regular", fontSize: 10, color: colors.muted, marginTop: 2 },
  dashboardSummaryButton: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 14, borderRadius: 6, backgroundColor: colors.green },
  dashboardSummaryButtonText: { fontFamily: "DMSans_700Bold", fontSize: 11, color: colors.white },
  wastePanel: { padding: 18, marginBottom: 28, borderRadius: 8, backgroundColor: "#E7EEE4" },
  wasteEvent: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9, borderTopWidth: 1, borderTopColor: "#C9D5C7" },
  wasteDate: { width: 42, alignItems: "center" },
  wasteDateDay: { fontFamily: "Fraunces_600SemiBold", fontSize: 22, lineHeight: 24, color: colors.ink },
  wasteDateMonth: { fontFamily: "DMSans_700Bold", fontSize: 9, color: colors.green, textTransform: "uppercase" },
  wasteEventCopy: { flex: 1 },
  wasteEventTitle: { fontFamily: "DMSans_700Bold", fontSize: 12, color: colors.ink },
  wasteEventMeta: { fontFamily: "DMSans_400Regular", fontSize: 10, color: colors.muted, marginTop: 2 },
  wasteEmpty: { fontFamily: "DMSans_400Regular", fontSize: 12, lineHeight: 18, color: colors.muted, marginTop: 8 },
  wasteAction: { minHeight: 36, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 12, borderRadius: 6, backgroundColor: colors.green },
  wasteActionText: { fontFamily: "DMSans_700Bold", fontSize: 11, color: colors.white },
});