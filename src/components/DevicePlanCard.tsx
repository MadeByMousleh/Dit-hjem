import { Feather } from "@expo/vector-icons";
import { useMemo } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { EvModel } from "../evData";
import { PricePoint } from "../prices";
import { NumericField, Stepper } from "./../components/DeviceControls";
import { HouseholdDevice } from "../types/app";
import { CLASS_ENERGY_KWH, DURATIONS, ENERGY_CLASSES, WASH_TEMPERATURES, WASH_TEMPERATURE_MULTIPLIERS, findBestEnergyWindow, isEnergyClass } from "../utils/energyPlanning";
import { formatDuration, formatPrice } from "../utils/formatting";
import { colors, dkDay, dkTime } from "../styles/theme";
import { styles } from "../styles/appStyles";

const ENERGY_CLASS_COLORS: Record<string, string> = { A: "#2D8A45", B: "#62A844", C: "#B5C836", D: "#F1D13C", E: "#F4A62A", F: "#E66C2E", G: "#C93C35" };

export function DevicePlanCard({ device, points, now, evModels, expanded, onToggle, onChange, onRemove, onToggleDashboard }: {
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

