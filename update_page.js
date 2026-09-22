const fs = require("fs");

const content = `import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { EvModel } from "../evData";
import { PricePoint } from "../prices";
import { TeslaVehicle } from "../types/app";
import { formatDuration, formatPrice } from "../utils/formatting";

// Modern Minimalist Palette (MobilePay / Nordic Fintech aesthetic)
const mp = {
  blue: "#4E65F6", // Signature MobilePay blue
  blueDark: "#3A4ED4",
  blueLight: "#EEF2FF",
  blueBorder: "#D5DEFF",

  white: "#FFFFFF",
  canvas: "#F4F6F9",
  card: "#FFFFFF",
  cardSubtle: "#F8FAFC",
  border: "#E2E8F0",
  borderSubtle: "#EDF2F7",

  textPrimary: "#0F172A",
  textSecondary: "#475569",
  textMuted: "#64748B",
  textLight: "#94A3B8",

  success: "#10B981",
  successBg: "#ECFDF5",
  successBorder: "#A7F3D0",
  successText: "#047857",

  warning: "#F59E0B",
  warningBg: "#FFFBEB",
  warningBorder: "#FDE68A",
  warningText: "#B45309",

  danger: "#EF4444",
  dangerBg: "#FEF2F2",
  dangerBorder: "#FECACA",
  dangerText: "#B91C1C",

  neutralPill: "#F1F5F9",
};

type TeslaSection = "battery" | "charging" | "climate" | "vehicle" | "all";

export type TeslaDetailsPageProps = {
  vehicle: TeslaVehicle | null;
  refreshing: boolean;
  onRefresh: () => void;
  connected?: boolean;
  onConnect?: () => void;
  showOnDashboard?: boolean;
  onToggleDashboard?: () => void;
  points?: PricePoint[];
  now?: number;
  evModels?: EvModel[];
  onBack?: () => void;
};

function formatExteriorColor(color: string | null | undefined): { label: string; hex: string } {
  if (!color) return { label: "Standard lakering", hex: "#64748B" };
  const map: Record<string, { label: string; hex: string }> = {
    SolidBlack: { label: "Massiv sort (Solid Black)", hex: "#0F172A" },
    Black: { label: "Sort", hex: "#0F172A" },
    PearlWhite: { label: "Perlehvid flerlags (Pearl White)", hex: "#F8FAFC" },
    White: { label: "Hvid", hex: "#F8FAFC" },
    MidnightSilver: { label: "Midnatssølv metallisk", hex: "#475569" },
    MidnightSilverMetallic: { label: "Midnatssølv metallisk", hex: "#475569" },
    StealthGrey: { label: "Stealth Grey metallisk", hex: "#334155" },
    DeepBlue: { label: "Dybblå metallisk (Deep Blue)", hex: "#2563EB" },
    DeepBlueMetallic: { label: "Dybblå metallisk", hex: "#2563EB" },
    Blue: { label: "Blå", hex: "#2563EB" },
    RedMultiCoat: { label: "Rød flerlags (Red Multi-Coat)", hex: "#DC2626" },
    UltraRed: { label: "Ultra Red", hex: "#B91C1C" },
    Red: { label: "Rød", hex: "#DC2626" },
    Quicksilver: { label: "Quicksilver metallisk", hex: "#94A3B8" },
  };
  return map[color] ?? { label: color.replace(/([a-z])([A-Z])/g, "$1 $2"), hex: "#64748B" };
}

function formatWheelType(wheel: string | null | undefined): string {
  if (!wheel) return "Standardmontering";
  const map: Record<string, string> = {
    Pinwheel18: '18" Aero-fælge',
    Pinwheel: '18" Aero-fælge',
    Stiletto19: '19" Sportsfælge',
    Sport19: '19" Sportsfælge',
    Gemini19: '19" Gemini-fælge',
    Gemini: '19" Gemini-fælge',
    Induction20: '20" Induction-fælge',
    Induction: '20" Induction-fælge',
    Uberturbine21: '21" Überturbine-fælge',
    Uberturbine20: '20" Überturbine-fælge',
    Cyberstream20: '20" Cyberstream-fælge',
  };
  return map[wheel] ?? wheel.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function formatChargingState(state: string | null | undefined): {
  label: string;
  tone: "active" | "complete" | "idle" | "alert";
  description: string;
} {
  if (!state) return { label: "Ikke tilsluttet", tone: "idle", description: "Ladekablet er ikke tilsluttet bilen" };
  switch (state) {
    case "Charging":
      return { label: "Oplader nu", tone: "active", description: "Bilen modtager aktivt strøm fra ladeboksen" };
    case "Complete":
      return { label: "Fuldt opladet", tone: "complete", description: "Opladning gennemført til den valgte ladegrænse" };
    case "Disconnected":
      return { label: "Ikke tilsluttet", tone: "idle", description: "Ladekablet er ikke koblet til bilens ladeport" };
    case "NoPower":
      return { label: "Ingen strøm på lader", tone: "alert", description: "Kablet er i bilen, men ladeboksen leverer ikke strøm" };
    case "Stopped":
      return { label: "Opladning stoppet", tone: "alert", description: "Ladesessionen er midlertidigt afbrudt" };
    case "Starting":
      return { label: "Starter opladning", tone: "active", description: "Bilen etablerer kontakt med ladeboksen" };
    case "Calibrating":
      return { label: "Kalibrerer lader", tone: "active", description: "Systemet måler netspænding og modstand" };
    default:
      return { label: state, tone: "idle", description: "Status modtaget fra bilens system" };
  }
}

function formatShiftState(state: string | null | undefined): string {
  if (!state) return "Parkeret (P)";
  switch (state.toUpperCase()) {
    case "P":
      return "Parkeret (P)";
    case "D":
      return "Kørsel (D)";
    case "R":
      return "Bakgear (R)";
    case "N":
      return "Frigear (N)";
    default:
      return state;
  }
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "Ukendt";
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return "Lige nu";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min. siden`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} t. siden`;
  return date.toLocaleDateString("da-DK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function StatTile({
  label,
  value,
  unit,
  subtext,
  icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  unit?: string;
  subtext?: string;
  icon?: keyof typeof Feather.glyphMap;
  tone?: "blue" | "success" | "warning" | "danger" | "default";
}) {
  const getIconColor = () => {
    switch (tone) {
      case "blue":
        return mp.blue;
      case "success":
        return mp.success;
      case "warning":
        return mp.warning;
      case "danger":
        return mp.danger;
      default:
        return mp.textMuted;
    }
  };

  const getIconBg = () => {
    switch (tone) {
      case "blue":
        return mp.blueLight;
      case "success":
        return mp.successBg;
      case "warning":
        return mp.warningBg;
      case "danger":
        return mp.dangerBg;
      default:
        return mp.neutralPill;
    }
  };

  return (
    <View style={styles.tile}>
      <View style={styles.tileTopRow}>
        <Text style={styles.tileLabel}>{label.toUpperCase()}</Text>
        {icon ? (
          <View style={[styles.tileIconCircle, { backgroundColor: getIconBg() }]}>
            <Feather name={icon} size={12} color={getIconColor()} />
          </View>
        ) : null}
      </View>
      <View style={styles.tileValueRow}>
        <Text style={styles.tileValue}>{value}</Text>
        {unit ? <Text style={styles.tileUnit}>{unit}</Text> : null}
      </View>
      {subtext ? <Text style={styles.tileSubtext}>{subtext}</Text> : null}
    </View>
  );
}

export function TeslaDetailsPage({
  vehicle,
  refreshing,
  onRefresh,
  connected = true,
  onConnect,
  showOnDashboard,
  onToggleDashboard,
  points = [],
  now = Date.now(),
  evModels = [],
  onBack,
}: TeslaDetailsPageProps) {
  const [selectedSection, setSelectedSection] = useState<TeslaSection>("battery");

  // Empty state: Clean MobilePay-style onboarding card
  if (!vehicle) {
    return (
      <View style={styles.wrapper}>
        {onBack ? (
          <Pressable onPress={onBack} style={styles.backButton}>
            <Feather name="arrow-left" size={16} color={mp.textPrimary} />
            <Text style={styles.backButtonText}>Tilbage</Text>
          </Pressable>
        ) : null}

        <View style={styles.emptyCard}>
          <View style={styles.emptyIconCircle}>
            <Feather name="zap" size={28} color={mp.blue} />
          </View>
          <Text style={styles.emptyTitle}>Forbind din Tesla</Text>
          <Text style={styles.emptySubtitle}>
            Få et lynhurtigt overblik over dit batteriniveau, se bilens rækkevidde og beregn automatisk ladeudgiften efter dagens billigste elpriser.
          </Text>

          <View style={styles.emptyFeatureList}>
            <View style={styles.emptyFeatureItem}>
              <View style={styles.featureIconWrap}>
                <Feather name="battery-charging" size={15} color={mp.blue} />
              </View>
              <Text style={styles.emptyFeatureText}>Live batteriniveau og nøjagtig rest-rækkevidde</Text>
            </View>
            <View style={styles.emptyFeatureItem}>
              <View style={styles.featureIconWrap}>
                <Feather name="trending-up" size={15} color={mp.blue} />
              </View>
              <Text style={styles.emptyFeatureText}>Prisberegning for fuld opladning til dagens elpriser</Text>
            </View>
            <View style={styles.emptyFeatureItem}>
              <View style={styles.featureIconWrap}>
                <Feather name="thermometer" size={15} color={mp.blue} />
              </View>
              <Text style={styles.emptyFeatureText}>Kabinetemperatur og styring af forkonditionering</Text>
            </View>
            <View style={styles.emptyFeatureItem}>
              <View style={styles.featureIconWrap}>
                <Feather name="shield" size={15} color={mp.blue} />
              </View>
              <Text style={styles.emptyFeatureText}>Låsestatus og Vægtertilstand (Sentry Mode)</Text>
            </View>
          </View>

          {onConnect ? (
            <Pressable onPress={onConnect} style={styles.primaryButton}>
              <Feather name="external-link" size={16} color={mp.white} />
              <Text style={styles.primaryButtonText}>Forbind med Tesla-konto</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  // Model and battery resolution
  const vehicleQuery = (vehicle.model ?? vehicle.name ?? "").toLowerCase();
  const matchedModel = evModels.find(
    (m) =>
      `${m.modelName} ${m.name}`.toLowerCase().includes(vehicleQuery) ||
      vehicleQuery.includes(m.modelName.toLowerCase())
  );
  const batteryKwh = matchedModel?.batteryKwh ?? 75;
  const batteryLevel = vehicle.batteryLevel ?? 0;
  const chargeLimit = vehicle.chargeLimitSoc ?? 80;

  // Energy needed to reach limit and 100% (accounting for ~90% charging efficiency)
  const neededKwhToLimit = (batteryKwh * Math.max(0, chargeLimit - batteryLevel)) / 100 / 0.9;
  const neededKwhTo100 = (batteryKwh * Math.max(0, 100 - batteryLevel)) / 100 / 0.9;

  // Current electricity spot price in kr/kWh
  const currentSpotPriceOre =
    [...points].reverse().find((p) => p.startsAt.getTime() <= now)?.totalOrePerKwh ?? 0;
  const currentPriceKr = currentSpotPriceOre / 100;
  const costToLimitKr = (neededKwhToLimit * currentSpotPriceOre) / 100;
  const costTo100Kr = (neededKwhTo100 * currentSpotPriceOre) / 100;

  // Formatted info
  const chargingInfo = formatChargingState(vehicle.chargingState);
  const exteriorColor = formatExteriorColor(vehicle.exteriorColor);
  const wheelName = formatWheelType(vehicle.wheelType);

  // Time remaining
  const estimatedHours =
    vehicle.timeToFullChargeHours ??
    (vehicle.chargerPowerKw && vehicle.chargerPowerKw > 0
      ? neededKwhToLimit / vehicle.chargerPowerKw
      : null);

  const sections: { id: TeslaSection; label: string; icon: keyof typeof Feather.glyphMap }[] = [
    { id: "battery", label: "Batteri", icon: "battery-charging" },
    { id: "charging", label: "Opladning", icon: "zap" },
    { id: "climate", label: "Klima", icon: "thermometer" },
    { id: "vehicle", label: "Køretøj", icon: "shield" },
    { id: "all", label: "Alle", icon: "grid" },
  ];

  // Section 1: Batteri
  const renderBatterySection = () => (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIconWrap}>
          <Feather name="battery-charging" size={17} color={mp.blue} />
        </View>
        <View style={styles.sectionTitleWrap}>
          <Text style={styles.sectionTitle}>Batteri & Rækkevidde</Text>
          <Text style={styles.sectionSubtitle}>Aktuel kapacitet, ladegrænse og forbrug</Text>
        </View>
      </View>

      <View style={styles.tileGrid}>
        <StatTile
          label="Batteriniveau"
          value={vehicle.batteryLevel != null ? `${Math.round(vehicle.batteryLevel)}` : "–"}
          unit="%"
          subtext={`Indstillet ladegrænse: ${chargeLimit}%`}
          icon="battery"
          tone="blue"
        />
        <StatTile
          label="Ladegrænse"
          value={vehicle.chargeLimitSoc != null ? `${vehicle.chargeLimitSoc}` : "–"}
          unit="%"
          subtext="Anbefalet grænse i hverdagen"
          icon="target"
          tone="default"
        />
        <StatTile
          label="Rækkevidde (WLTP)"
          value={vehicle.batteryRangeKm != null ? `${Math.round(vehicle.batteryRangeKm)}` : "–"}
          unit="km"
          subtext="Normeret beregning"
          icon="navigation"
        />
        <StatTile
          label="Estimeret rækkevidde"
          value={
            vehicle.estimatedBatteryRangeKm != null
              ? `${Math.round(vehicle.estimatedBatteryRangeKm)}`
              : vehicle.batteryRangeKm != null
              ? `${Math.round(vehicle.batteryRangeKm * 0.93)}`
              : "–"
          }
          unit="km"
          subtext="Beregnet efter kørsel"
          icon="activity"
        />
        <StatTile
          label="Batterikapacitet"
          value={formatPrice(batteryKwh, 1)}
          unit="kWh"
          subtext={matchedModel ? `${matchedModel.modelName} ${matchedModel.name}` : "Estimeret pakke"}
          icon="layers"
        />
        <StatTile
          label="Mangler til grænse"
          value={formatPrice(neededKwhToLimit, 1)}
          unit="kWh"
          subtext={`Til ${chargeLimit}% (inkl. 10% ladetab)`}
          icon="arrow-up-circle"
          tone="warning"
        />
      </View>

      <View style={styles.tipBox}>
        <Feather name="info" size={15} color={mp.blue} />
        <Text style={styles.tipText}>
          {chargeLimit <= 80
            ? "Ladegrænsen er sat fornuftigt til 80%, hvilket skåner batteriet og forlænger dets levetid i det daglige."
            : "Tip: Tesla anbefaler normalt en ladegrænse på 80% til daglig brug, og 100% før længere ture."}
        </Text>
      </View>
    </View>
  );

  // Section 2: Opladning
  const renderChargingSection = () => (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIconWrap}>
          <Feather name="zap" size={17} color={mp.blue} />
        </View>
        <View style={styles.sectionTitleWrap}>
          <Text style={styles.sectionTitle}>Opladning & Strøm</Text>
          <Text style={styles.sectionSubtitle}>Ladehastighed, spænding og elpris-beregninger</Text>
        </View>
      </View>

      {/* Charging State Banner */}
      <View
        style={[
          styles.chargingBanner,
          chargingInfo.tone === "active" && styles.chargingBannerActive,
          chargingInfo.tone === "complete" && styles.chargingBannerComplete,
          chargingInfo.tone === "alert" && styles.chargingBannerAlert,
        ]}
      >
        <View
          style={[
            styles.chargingBannerIconCircle,
            chargingInfo.tone === "active" && { backgroundColor: mp.successBg },
            chargingInfo.tone === "complete" && { backgroundColor: mp.blueLight },
            chargingInfo.tone === "alert" && { backgroundColor: mp.dangerBg },
          ]}
        >
          <Feather
            name={
              chargingInfo.tone === "active"
                ? "zap"
                : chargingInfo.tone === "complete"
                ? "check-circle"
                : chargingInfo.tone === "alert"
                ? "alert-circle"
                : "power"
            }
            size={18}
            color={
              chargingInfo.tone === "active"
                ? mp.success
                : chargingInfo.tone === "complete"
                ? mp.blue
                : chargingInfo.tone === "alert"
                ? mp.danger
                : mp.textMuted
            }
          />
        </View>
        <View style={styles.chargingBannerCopy}>
          <Text style={styles.chargingBannerHeadline}>{chargingInfo.label}</Text>
          <Text style={styles.chargingBannerDesc}>{chargingInfo.description}</Text>
        </View>
        <View style={styles.portPill}>
          <Feather
            name={vehicle.chargePortDoorOpen ? "unlock" : "lock"}
            size={12}
            color={vehicle.chargePortDoorOpen ? mp.warning : mp.textMuted}
          />
          <Text style={styles.portPillText}>
            Ladeport: {vehicle.chargePortDoorOpen ? "Åben" : "Lukket"}
          </Text>
        </View>
      </View>

      <View style={styles.tileGrid}>
        <StatTile
          label="Ladeeffekt"
          value={vehicle.chargerPowerKw != null ? formatPrice(vehicle.chargerPowerKw, 1) : "–"}
          unit="kW"
          subtext={
            vehicle.chargerPowerKw && vehicle.chargerPowerKw > 0
              ? `${vehicle.chargerPowerKw >= 50 ? "Hurtiglader (DC)" : "Hjemmelader (AC)"}`
              : "Ingen aktiv ladeeffekt"
          }
          icon="zap"
          tone={vehicle.chargerPowerKw && vehicle.chargerPowerKw > 0 ? "success" : "default"}
        />
        <StatTile
          label="Resterende tid"
          value={estimatedHours != null ? formatDuration(estimatedHours) : "–"}
          subtext={`Indtil ${chargeLimit}% ladegrænse`}
          icon="clock"
        />
        <StatTile
          label="Netspænding"
          value={vehicle.chargerVoltage != null ? `${vehicle.chargerVoltage}` : "–"}
          unit="V"
          subtext={vehicle.chargerVoltage ? (vehicle.chargerVoltage > 250 ? "3-faset installation" : "1-faset installation") : undefined}
          icon="activity"
        />
        <StatTile
          label="Ladestrøm"
          value={vehicle.chargerActualCurrentA != null ? `${vehicle.chargerActualCurrentA}` : "–"}
          unit="A"
          subtext="Aktiv strømstyrke"
          icon="compass"
        />
        <StatTile
          label="Tilført energi"
          value={
            vehicle.chargeEnergyAddedKwh != null ? formatPrice(vehicle.chargeEnergyAddedKwh, 1) : "–"
          }
          unit="kWh"
          subtext="Igangværende/sidste session"
          icon="plus-circle"
        />
        <StatTile
          label="Pris til grænse"
          value={costToLimitKr > 0 ? `${formatPrice(costToLimitKr, 2)}` : "–"}
          unit="kr"
          subtext={currentPriceKr > 0 ? `Spotpris: ${formatPrice(currentPriceKr, 2)} kr/kWh` : "Spotpris mangler"}
          icon="trending-up"
          tone="blue"
        />
      </View>

      {costTo100Kr > 0 ? (
        <View style={styles.costBox}>
          <View style={styles.costBoxLeft}>
            <Text style={styles.costBoxLabel}>Estimeret pris til 100% fuld opladning</Text>
            <Text style={styles.costBoxSub}>Beregnet ud fra din aktuelle elpris</Text>
          </View>
          <Text style={styles.costBoxPrice}>{formatPrice(costTo100Kr, 2)} kr</Text>
        </View>
      ) : null}
    </View>
  );

  // Section 3: Klima
  const renderClimateSection = () => (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIconWrap}>
          <Feather name="thermometer" size={17} color={mp.blue} />
        </View>
        <View style={styles.sectionTitleWrap}>
          <Text style={styles.sectionTitle}>Klima & Temperatur</Text>
          <Text style={styles.sectionSubtitle}>Kabineforhold og forkonditionering</Text>
        </View>
      </View>

      <View style={styles.tileGrid}>
        <StatTile
          label="Kabinetemperatur"
          value={vehicle.insideTempC != null ? vehicle.insideTempC.toFixed(1).replace(".", ",") : "–"}
          unit="°C"
          subtext="Måling i kabinen"
          icon="home"
          tone="blue"
        />
        <StatTile
          label="Udetemperatur"
          value={vehicle.outsideTempC != null ? vehicle.outsideTempC.toFixed(1).replace(".", ",") : "–"}
          unit="°C"
          subtext="Omgivelsestemperatur"
          icon="sun"
        />
        <StatTile
          label="Forkonditionering"
          value={vehicle.isPreconditioning ? "Aktiv" : "Inaktiv"}
          subtext={
            vehicle.isPreconditioning
              ? "Varmer kabine og klargør batteri"
              : "Klimaanlæg i hviletilstand"
          }
          icon="wind"
          tone={vehicle.isPreconditioning ? "success" : "default"}
        />
        <StatTile
          label="Temperaturforskel"
          value={
            vehicle.insideTempC != null && vehicle.outsideTempC != null
              ? (vehicle.insideTempC - vehicle.outsideTempC > 0 ? "+" : "") +
                (vehicle.insideTempC - vehicle.outsideTempC).toFixed(1).replace(".", ",")
              : "–"
          }
          unit="°C"
          subtext="Forskel mellem inde og ude"
          icon="sliders"
        />
      </View>

      <View style={styles.tipBox}>
        <Feather name="shield" size={15} color={mp.blue} />
        <Text style={styles.tipText}>
          Forkonditionering bringer kabinen og batteriet op på optimal driftstemperatur, hvilket giver fuld rækkevidde og hurtigere ladetider.
        </Text>
      </View>
    </View>
  );

  // Section 4: Køretøj
  const renderVehicleSection = () => (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIconWrap}>
          <Feather name="shield" size={17} color={mp.blue} />
        </View>
        <View style={styles.sectionTitleWrap}>
          <Text style={styles.sectionTitle}>Køretøj & Sikkerhed</Text>
          <Text style={styles.sectionSubtitle}>Låsestatus, vægtertilstand og biloplysninger</Text>
        </View>
      </View>

      {/* Security Status Cards */}
      <View style={styles.securityGrid}>
        <View
          style={[
            styles.securityCard,
            vehicle.locked ? styles.securityCardSuccess : styles.securityCardAlert,
          ]}
        >
          <View
            style={[
              styles.securityIconCircle,
              { backgroundColor: vehicle.locked ? mp.successBg : mp.dangerBg },
            ]}
          >
            <Feather
              name={vehicle.locked ? "lock" : "unlock"}
              size={18}
              color={vehicle.locked ? mp.success : mp.danger}
            />
          </View>
          <View style={styles.securityCopy}>
            <Text
              style={[
                styles.securityTitle,
                { color: vehicle.locked ? mp.successText : mp.dangerText },
              ]}
            >
              {vehicle.locked == null ? "Låsestatus ukendt" : vehicle.locked ? "Bilen er låst" : "Bilen er ulåst"}
            </Text>
            <Text style={styles.securitySubtitle}>
              {vehicle.locked ? "Døre og bagagerum er låst" : "Advarsel: Bilen er ikke låst"}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.securityCard,
            vehicle.sentryMode ? styles.securityCardSuccess : styles.securityCardNeutral,
          ]}
        >
          <View
            style={[
              styles.securityIconCircle,
              { backgroundColor: vehicle.sentryMode ? mp.successBg : mp.neutralPill },
            ]}
          >
            <Feather
              name="eye"
              size={18}
              color={vehicle.sentryMode ? mp.success : mp.textMuted}
            />
          </View>
          <View style={styles.securityCopy}>
            <Text
              style={[
                styles.securityTitle,
                { color: vehicle.sentryMode ? mp.successText : mp.textPrimary },
              ]}
            >
              Vægtertilstand: {vehicle.sentryMode ? "Aktiv" : "Slået fra"}
            </Text>
            <Text style={styles.securitySubtitle}>
              {vehicle.sentryMode ? "Overvåger omgivelser med kameraer" : "Kameraovervågning er slukket"}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.tileGrid}>
        <StatTile
          label="Kilometertæller"
          value={vehicle.odometerKm != null ? Math.round(vehicle.odometerKm).toLocaleString("da-DK") : "–"}
          unit="km"
          subtext="Total kørte kilometer"
          icon="map-pin"
        />
        <StatTile
          label="Gear / Tilstand"
          value={formatShiftState(vehicle.shiftState)}
          subtext={vehicle.speedKmh ? `Hastighed: ${Math.round(vehicle.speedKmh)} km/t` : "Holder stille"}
          icon="disc"
        />
        <StatTile
          label="Softwareversion"
          value={vehicle.carVersion ?? "–"}
          subtext="Tesla softwareversion"
          icon="cpu"
        />
        <View style={styles.tile}>
          <View style={styles.tileTopRow}>
            <Text style={styles.tileLabel}>EKSTERIØRFARVE</Text>
            <View style={[styles.colorSwatch, { backgroundColor: exteriorColor.hex }]} />
          </View>
          <Text style={styles.tileValueMedium}>{exteriorColor.label}</Text>
          <Text style={styles.tileSubtext}>Original fabrikslakering</Text>
        </View>
        <StatTile
          label="Fælge"
          value={wheelName}
          subtext="Hjulmontering"
          icon="circle"
        />
        <StatTile
          label="Stelnummer (VIN)"
          value={vehicle.vin ? `${vehicle.vin.slice(0, 7)}...${vehicle.vin.slice(-4)}` : "–"}
          subtext={vehicle.vin ?? undefined}
          icon="file-text"
        />
      </View>
    </View>
  );

  return (
    <View style={styles.wrapper}>
      {/* Back button if opened as full view */}
      {onBack ? (
        <Pressable onPress={onBack} style={styles.backButton}>
          <Feather name="arrow-left" size={16} color={mp.textPrimary} />
          <Text style={styles.backButtonText}>Tilbage til overblik</Text>
        </Pressable>
      ) : null}

      {/* Main Hero Card (Light, Clean, MobilePay inspired) */}
      <View style={styles.heroCard}>
        {/* Top bar with vehicle name, tags and action buttons */}
        <View style={styles.heroHeader}>
          <View style={styles.heroTitles}>
            <View style={styles.liveRow}>
              <View style={styles.livePulseDot} />
              <Text style={styles.liveText}>Forbundet med Tesla</Text>
            </View>
            <Text style={styles.vehicleName}>{vehicle.name || "Tesla"}</Text>
            <View style={styles.tagRow}>
              <View style={styles.heroTag}>
                <Text style={styles.heroTagText}>{vehicle.model || "Model"}</Text>
              </View>
              {vehicle.trim ? (
                <View style={styles.heroTag}>
                  <Text style={styles.heroTagText}>{vehicle.trim}</Text>
                </View>
              ) : null}
              <View style={styles.heroTag}>
                <View style={[styles.colorMiniDot, { backgroundColor: exteriorColor.hex }]} />
                <Text style={styles.heroTagText}>
                  {exteriorColor.label.includes("(")
                    ? exteriorColor.label.split("(")[0]?.trim() ?? exteriorColor.label
                    : exteriorColor.label}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.heroActions}>
            {onToggleDashboard ? (
              <Pressable
                onPress={onToggleDashboard}
                accessibilityLabel={showOnDashboard ? "Skjul fra overblik" : "Vis på overblik"}
                style={[styles.heroIconButton, showOnDashboard && styles.heroIconButtonActive]}
              >
                <Feather
                  name="eye"
                  size={16}
                  color={showOnDashboard ? mp.blue : mp.textMuted}
                />
              </Pressable>
            ) : null}
            <Pressable
              onPress={onRefresh}
              disabled={refreshing}
              accessibilityLabel="Opdater Tesla-status"
              style={[styles.refreshButton, refreshing && styles.refreshButtonActive]}
            >
              <Feather
                name={refreshing ? "loader" : "refresh-cw"}
                size={14}
                color={mp.white}
              />
              <Text style={styles.refreshButtonText}>{refreshing ? "Henter..." : "Opdater"}</Text>
            </Pressable>
          </View>
        </View>

        {/* Battery & Range Quick Display */}
        <View style={styles.batteryHeroBox}>
          <View style={styles.batteryStatsRow}>
            <View style={styles.batteryBigCol}>
              <Text style={styles.batteryLabelText}>AKTUELT BATTERI</Text>
              <View style={styles.batteryNumberRow}>
                <Text style={styles.batteryBigNumber}>
                  {vehicle.batteryLevel != null ? Math.round(vehicle.batteryLevel) : "–"}
                </Text>
                <Text style={styles.batteryPercentSymbol}>%</Text>
              </View>
            </View>

            <View style={styles.rangeBigCol}>
              <Text style={styles.rangeLabelText}>ESTIMERET RÆKKEVIDDE</Text>
              <View style={styles.rangeNumberRow}>
                <Feather name="navigation" size={18} color={mp.blue} style={{ marginRight: 6 }} />
                <Text style={styles.rangeBigNumber}>
                  {vehicle.batteryRangeKm != null ? `${Math.round(vehicle.batteryRangeKm)}` : "–"}
                </Text>
                <Text style={styles.rangeKmSymbol}>km</Text>
              </View>
            </View>
          </View>

          {/* Minimalist Progress Track with Charge Limit Indicator */}
          <View style={styles.batteryTrackContainer}>
            <View style={styles.batteryTrack}>
              <View
                style={[
                  styles.batteryFill,
                  {
                    width: `${Math.min(100, Math.max(3, batteryLevel))}%`,
                    backgroundColor:
                      batteryLevel < 15
                        ? mp.danger
                        : batteryLevel < 25
                        ? mp.warning
                        : mp.blue,
                  },
                ]}
              />
              {/* Charge limit line marker */}
              <View
                style={[
                  styles.limitMarker,
                  { left: `${Math.min(100, Math.max(0, chargeLimit))}%` },
                ]}
              />
            </View>

            <View style={styles.batteryTrackLabels}>
              <Text style={styles.trackLabel}>0%</Text>
              <View
                style={[
                  styles.limitBubble,
                  { left: `${Math.min(90, Math.max(10, chargeLimit))}%` },
                ]}
              >
                <Text style={styles.limitBubbleText}>Mål: {chargeLimit}%</Text>
              </View>
              <Text style={styles.trackLabel}>100%</Text>
            </View>
          </View>

          {/* Quick Glances Footer */}
          <View style={styles.glanceRow}>
            <View style={styles.glanceItem}>
              <Feather
                name={chargingInfo.tone === "active" ? "zap" : "power"}
                size={14}
                color={chargingInfo.tone === "active" ? mp.success : mp.textMuted}
              />
              <Text style={styles.glanceText}>
                {chargingInfo.label}
                {vehicle.chargerPowerKw && vehicle.chargerPowerKw > 0
                  ? ` (${formatPrice(vehicle.chargerPowerKw, 1)} kW)`
                  : ""}
              </Text>
            </View>

            <View style={styles.glanceDivider} />

            <View style={styles.glanceItem}>
              <Feather
                name={vehicle.locked ? "lock" : "unlock"}
                size={14}
                color={vehicle.locked ? mp.success : mp.danger}
              />
              <Text style={styles.glanceText}>{vehicle.locked ? "Låst" : "Ulåst"}</Text>
            </View>

            <View style={styles.glanceDivider} />

            <View style={styles.glanceItem}>
              <Feather name="thermometer" size={14} color={mp.blue} />
              <Text style={styles.glanceText}>
                {vehicle.insideTempC != null
                  ? `${vehicle.insideTempC.toFixed(1).replace(".", ",")} °C`
                  : "–"}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Modern Minimalist Section Selector (MobilePay Segmented Control) */}
      <View style={styles.tabsContainer}>
        {sections.map((sec) => {
          const isActive = selectedSection === sec.id;
          return (
            <Pressable
              key={sec.id}
              onPress={() => setSelectedSection(sec.id)}
              style={[styles.tabButton, isActive && styles.tabButtonActive]}
            >
              <Feather
                name={sec.icon}
                size={14}
                color={isActive ? mp.white : mp.textSecondary}
              />
              <Text style={[styles.tabButtonText, isActive && styles.tabButtonTextActive]}>
                {sec.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Dynamic Section Content */}
      <View style={styles.contentWrap}>
        {selectedSection === "battery" ? renderBatterySection() : null}
        {selectedSection === "charging" ? renderChargingSection() : null}
        {selectedSection === "climate" ? renderClimateSection() : null}
        {selectedSection === "vehicle" ? renderVehicleSection() : null}
        {selectedSection === "all" ? (
          <View style={styles.allSectionsStack}>
            {renderBatterySection()}
            {renderChargingSection()}
            {renderClimateSection()}
            {renderVehicleSection()}
          </View>
        ) : null}
      </View>

      {/* Footer info */}
      <View style={styles.footerRow}>
        <View style={styles.footerLeft}>
          <Feather name="check-circle" size={13} color={mp.success} />
          <Text style={styles.footerText}>
            Opdateret: {formatRelativeTime(vehicle.fetchedAt)}
          </Text>
        </View>
        <Text style={styles.footerSubText}>Sikker Tesla Fleet Telemetri</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    marginTop: 10,
    marginBottom: 28,
    gap: 16,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: mp.card,
    borderWidth: 1,
    borderColor: mp.border,
  },
  backButtonText: {
    fontFamily: "DMSans_500Medium",
    fontSize: 13,
    color: mp.textPrimary,
  },

  // Main Hero Card
  heroCard: {
    backgroundColor: mp.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: mp.border,
    padding: 20,
    gap: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  heroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  heroTitles: {
    flex: 1,
    gap: 6,
  },
  liveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  livePulseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: mp.success,
  },
  liveText: {
    fontFamily: "DMSans_700Bold",
    fontSize: 11,
    color: mp.successText,
    letterSpacing: 0.3,
  },
  vehicleName: {
    fontFamily: "DMSans_700Bold",
    fontSize: 24,
    lineHeight: 28,
    color: mp.textPrimary,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  heroTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: mp.cardSubtle,
    borderWidth: 1,
    borderColor: mp.border,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 9,
  },
  colorMiniDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
  heroTagText: {
    fontFamily: "DMSans_500Medium",
    fontSize: 11,
    color: mp.textSecondary,
  },
  heroActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  heroIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: mp.cardSubtle,
    borderWidth: 1,
    borderColor: mp.border,
    alignItems: "center",
    justifyContent: "center",
  },
  heroIconButtonActive: {
    backgroundColor: mp.blueLight,
    borderColor: mp.blueBorder,
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: mp.blue,
    borderRadius: 19,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  refreshButtonActive: {
    opacity: 0.7,
  },
  refreshButtonText: {
    fontFamily: "DMSans_700Bold",
    fontSize: 12,
    color: mp.white,
  },

  // Battery Box inside Hero
  batteryHeroBox: {
    backgroundColor: mp.cardSubtle,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: mp.borderSubtle,
    padding: 16,
    gap: 16,
  },
  batteryStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  batteryBigCol: {
    gap: 2,
  },
  batteryLabelText: {
    fontFamily: "DMSans_700Bold",
    fontSize: 10,
    letterSpacing: 0.5,
    color: mp.textMuted,
  },
  batteryNumberRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 2,
  },
  batteryBigNumber: {
    fontFamily: "DMSans_700Bold",
    fontSize: 44,
    lineHeight: 48,
    color: mp.textPrimary,
  },
  batteryPercentSymbol: {
    fontFamily: "DMSans_700Bold",
    fontSize: 22,
    color: mp.blue,
  },
  rangeBigCol: {
    alignItems: "flex-end",
    gap: 2,
  },
  rangeLabelText: {
    fontFamily: "DMSans_700Bold",
    fontSize: 10,
    letterSpacing: 0.5,
    color: mp.textMuted,
  },
  rangeNumberRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  rangeBigNumber: {
    fontFamily: "DMSans_700Bold",
    fontSize: 28,
    color: mp.textPrimary,
  },
  rangeKmSymbol: {
    fontFamily: "DMSans_500Medium",
    fontSize: 15,
    color: mp.textSecondary,
    marginLeft: 3,
  },
  batteryTrackContainer: {
    gap: 6,
  },
  batteryTrack: {
    height: 12,
    borderRadius: 6,
    backgroundColor: "#E2E8F0",
    overflow: "hidden",
    position: "relative",
  },
  batteryFill: {
    height: "100%",
    borderRadius: 6,
  },
  limitMarker: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    marginLeft: -1,
    backgroundColor: mp.textPrimary,
    zIndex: 2,
  },
  batteryTrackLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    position: "relative",
    paddingHorizontal: 2,
  },
  trackLabel: {
    fontFamily: "DMSans_500Medium",
    fontSize: 11,
    color: mp.textLight,
  },
  limitBubble: {
    position: "absolute",
    top: 0,
    marginLeft: -28,
    backgroundColor: mp.card,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: mp.border,
  },
  limitBubbleText: {
    fontFamily: "DMSans_700Bold",
    fontSize: 9,
    color: mp.textSecondary,
  },
  glanceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: mp.border,
    flexWrap: "wrap",
    gap: 8,
  },
  glanceItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  glanceDivider: {
    width: 1,
    height: 14,
    backgroundColor: mp.border,
  },
  glanceText: {
    fontFamily: "DMSans_500Medium",
    fontSize: 12,
    color: mp.textPrimary,
  },

  // Segmented control tabs (MobilePay pill switcher)
  tabsContainer: {
    flexDirection: "row",
    backgroundColor: mp.cardSubtle,
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: mp.border,
    gap: 6,
    flexWrap: "wrap",
  },
  tabButton: {
    flex: 1,
    minWidth: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: mp.blue,
    shadowColor: mp.blue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  tabButtonText: {
    fontFamily: "DMSans_700Bold",
    fontSize: 12,
    color: mp.textSecondary,
  },
  tabButtonTextActive: {
    color: mp.white,
  },

  // Section Cards
  contentWrap: {
    gap: 16,
  },
  allSectionsStack: {
    gap: 16,
  },
  sectionCard: {
    backgroundColor: mp.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: mp.border,
    padding: 18,
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sectionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: mp.blueLight,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitleWrap: {
    flex: 1,
  },
  sectionTitle: {
    fontFamily: "DMSans_700Bold",
    fontSize: 16,
    color: mp.textPrimary,
  },
  sectionSubtitle: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: mp.textMuted,
    marginTop: 1,
  },

  // Stat Tile Grid
  tileGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  tile: {
    minWidth: 140,
    flex: 1,
    backgroundColor: mp.cardSubtle,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: mp.borderSubtle,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  tileTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tileLabel: {
    fontFamily: "DMSans_700Bold",
    fontSize: 9,
    letterSpacing: 0.4,
    color: mp.textMuted,
  },
  tileIconCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  tileValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
    marginTop: 2,
  },
  tileValue: {
    fontFamily: "DMSans_700Bold",
    fontSize: 20,
    color: mp.textPrimary,
  },
  tileValueMedium: {
    fontFamily: "DMSans_700Bold",
    fontSize: 14,
    color: mp.textPrimary,
    marginTop: 2,
  },
  tileUnit: {
    fontFamily: "DMSans_700Bold",
    fontSize: 12,
    color: mp.blue,
  },
  tileSubtext: {
    fontFamily: "DMSans_400Regular",
    fontSize: 11,
    color: mp.textLight,
  },
  colorSwatch: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: mp.border,
  },

  // Tip box
  tipBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: mp.blueLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: mp.blueBorder,
    padding: 12,
  },
  tipText: {
    flex: 1,
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    lineHeight: 18,
    color: mp.textSecondary,
  },

  // Charging State Banner
  chargingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: mp.cardSubtle,
    borderWidth: 1,
    borderColor: mp.border,
  },
  chargingBannerActive: {
    backgroundColor: mp.successBg,
    borderColor: mp.successBorder,
  },
  chargingBannerComplete: {
    backgroundColor: mp.blueLight,
    borderColor: mp.blueBorder,
  },
  chargingBannerAlert: {
    backgroundColor: mp.dangerBg,
    borderColor: mp.dangerBorder,
  },
  chargingBannerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: mp.card,
    alignItems: "center",
    justifyContent: "center",
  },
  chargingBannerCopy: {
    flex: 1,
  },
  chargingBannerHeadline: {
    fontFamily: "DMSans_700Bold",
    fontSize: 14,
    color: mp.textPrimary,
  },
  chargingBannerDesc: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: mp.textMuted,
    marginTop: 2,
  },
  portPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: mp.card,
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: mp.border,
  },
  portPillText: {
    fontFamily: "DMSans_500Medium",
    fontSize: 11,
    color: mp.textSecondary,
  },

  // Cost Box
  costBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: mp.blueLight,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: mp.blueBorder,
  },
  costBoxLeft: {
    gap: 2,
  },
  costBoxLabel: {
    fontFamily: "DMSans_700Bold",
    fontSize: 13,
    color: mp.textPrimary,
  },
  costBoxSub: {
    fontFamily: "DMSans_400Regular",
    fontSize: 11,
    color: mp.textMuted,
  },
  costBoxPrice: {
    fontFamily: "DMSans_700Bold",
    fontSize: 18,
    color: mp.blue,
  },

  // Security Cards
  securityGrid: {
    gap: 10,
  },
  securityCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  securityCardSuccess: {
    backgroundColor: mp.successBg,
    borderColor: mp.successBorder,
  },
  securityCardAlert: {
    backgroundColor: mp.dangerBg,
    borderColor: mp.dangerBorder,
  },
  securityCardNeutral: {
    backgroundColor: mp.cardSubtle,
    borderColor: mp.border,
  },
  securityIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  securityCopy: {
    flex: 1,
  },
  securityTitle: {
    fontFamily: "DMSans_700Bold",
    fontSize: 14,
  },
  securitySubtitle: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    color: mp.textMuted,
    marginTop: 2,
  },

  // Footer
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 4,
    marginTop: 4,
  },
  footerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  footerText: {
    fontFamily: "DMSans_500Medium",
    fontSize: 12,
    color: mp.textSecondary,
  },
  footerSubText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 11,
    color: mp.textLight,
  },

  // Empty State Card
  emptyCard: {
    backgroundColor: mp.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: mp.border,
    padding: 28,
    alignItems: "center",
    textAlign: "center",
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: mp.blueLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontFamily: "DMSans_700Bold",
    fontSize: 22,
    color: mp.textPrimary,
  },
  emptySubtitle: {
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    lineHeight: 20,
    color: mp.textSecondary,
    textAlign: "center",
    maxWidth: 460,
  },
  emptyFeatureList: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: mp.cardSubtle,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: mp.borderSubtle,
    padding: 16,
    gap: 12,
    marginVertical: 4,
  },
  emptyFeatureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  featureIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: mp.blueLight,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyFeatureText: {
    fontFamily: "DMSans_500Medium",
    fontSize: 13,
    color: mp.textPrimary,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: mp.blue,
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 6,
  },
  primaryButtonText: {
    fontFamily: "DMSans_700Bold",
    fontSize: 14,
    color: mp.white,
  },
});
`;

fs.writeFileSync("src/components/TeslaDetailsPage.tsx", content, "utf8");
console.log("TeslaDetailsPage.tsx updated successfully");
