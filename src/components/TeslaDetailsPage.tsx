import { Feather } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { EvModel } from "../evData";
import { PricePoint } from "../prices";
import { TeslaVehicle } from "../types/app";
import { formatDuration, formatPrice } from "../utils/formatting";

const theme = {
  bg: "#0B1A17",
  card: "#112622",
  cardSubtle: "#16312B",
  cardBorder: "#1E423A",
  cardBorderSubtle: "#285248",
  inkLight: "#F8FAF8",
  inkMuted: "#8DA89F",
  inkDim: "#5C766E",
  emerald: "#10B981",
  emeraldDark: "#0B694F",
  emeraldBg: "rgba(16, 185, 129, 0.12)",
  emeraldBorder: "rgba(16, 185, 129, 0.35)",
  coral: "#E87555",
  coralBg: "rgba(232, 117, 85, 0.14)",
  coralBorder: "rgba(232, 117, 85, 0.35)",
  amber: "#F2CA6B",
  amberBg: "rgba(242, 202, 107, 0.14)",
  amberBorder: "rgba(242, 202, 107, 0.35)",
  blue: "#38BDF8",
  blueBg: "rgba(56, 189, 248, 0.14)",
  blueBorder: "rgba(56, 189, 248, 0.35)",
  pillBg: "rgba(255, 255, 255, 0.06)",
  pillBorder: "rgba(255, 255, 255, 0.12)",
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
  if (!color) return { label: "Standard lakering", hex: "#71717A" };
  const map: Record<string, { label: string; hex: string }> = {
    SolidBlack: { label: "Massiv sort (Solid Black)", hex: "#18181B" },
    Black: { label: "Sort", hex: "#18181B" },
    PearlWhite: { label: "Perlehvid flerlags (Pearl White)", hex: "#F4F4F5" },
    White: { label: "Hvid", hex: "#F4F4F5" },
    MidnightSilver: { label: "Midnatssølv metallisk", hex: "#4B5563" },
    MidnightSilverMetallic: { label: "Midnatssølv metallisk", hex: "#4B5563" },
    StealthGrey: { label: "Stealth Grey metallisk", hex: "#374151" },
    DeepBlue: { label: "Dybblå metallisk (Deep Blue)", hex: "#1D4ED8" },
    DeepBlueMetallic: { label: "Dybblå metallisk", hex: "#1D4ED8" },
    Blue: { label: "Blå", hex: "#1D4ED8" },
    RedMultiCoat: { label: "Rød flerlags (Red Multi-Coat)", hex: "#DC2626" },
    UltraRed: { label: "Ultra Red", hex: "#B91C1C" },
    Red: { label: "Rød", hex: "#DC2626" },
    Quicksilver: { label: "Quicksilver metallisk", hex: "#9CA3AF" },
  };
  return map[color] ?? { label: color.replace(/([a-z])([A-Z])/g, "$1 $2"), hex: "#71717A" };
}

function formatWheelType(wheel: string | null | undefined): string {
  if (!wheel) return "Standardmontering";
  const map: Record<string, string> = {
    Pinwheel18: "18\" Aero-fælge",
    Pinwheel: "18\" Aero-fælge",
    Stiletto19: "19\" Sportsfælge",
    Sport19: "19\" Sportsfælge",
    Gemini19: "19\" Gemini-fælge",
    Gemini: "19\" Gemini-fælge",
    Induction20: "20\" Induction-fælge",
    Induction: "20\" Induction-fælge",
    Uberturbine21: "21\" Überturbine-fælge",
    Uberturbine20: "20\" Überturbine-fælge",
    Cyberstream20: "20\" Cyberstream-fælge",
  };
  return map[wheel] ?? wheel.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function formatChargingState(state: string | null | undefined): {
  label: string;
  tone: "active" | "complete" | "idle" | "alert";
  description: string;
} {
  if (!state) return { label: "Ukendt status", tone: "idle", description: "Ingen aktiv ladeforbindelse rapporteret" };
  switch (state) {
    case "Charging":
      return { label: "Oplader nu", tone: "active", description: "Bilen modtager aktivt strøm fra laderen" };
    case "Complete":
      return { label: "Fuldt opladet", tone: "complete", description: "Opladning er gennemført til den indstillede ladegrænse" };
    case "Disconnected":
      return { label: "Ikke tilsluttet", tone: "idle", description: "Ladekablet er ikke koblet til bilens ladeport" };
    case "NoPower":
      return { label: "Ingen strøm på lader", tone: "alert", description: "Kablet er i bilen, men ladeboksen leverer ikke strøm" };
    case "Stopped":
      return { label: "Opladning stoppet", tone: "alert", description: "Opladningssessionen er midlertidigt afbrudt" };
    case "Starting":
      return { label: "Starter opladning", tone: "active", description: "Lader og bil forhandler strømstyrke" };
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

function ValueTile({
  label,
  value,
  unit,
  subtext,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  unit?: string;
  subtext?: string;
  icon?: keyof typeof Feather.glyphMap;
  accent?: "emerald" | "coral" | "amber" | "blue" | "default";
}) {
  const getAccentColor = () => {
    switch (accent) {
      case "emerald":
        return theme.emerald;
      case "coral":
        return theme.coral;
      case "amber":
        return theme.amber;
      case "blue":
        return theme.blue;
      default:
        return theme.inkMuted;
    }
  };

  return (
    <View style={styles.tile}>
      <View style={styles.tileTopRow}>
        <Text style={styles.tileLabel}>{label.toUpperCase()}</Text>
        {icon ? <Feather name={icon} size={13} color={getAccentColor()} /> : null}
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

  if (!vehicle) {
    return (
      <View style={styles.wrapper}>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Feather name="zap" size={32} color={theme.emerald} />
          </View>
          <Text style={styles.emptyTitle}>Forbind din Tesla</Text>
          <Text style={styles.emptySubtitle}>
            Få direkte adgang til live batteriniveau, estimeret rækkevidde, ladeovervågning og automatisk beregning af
            ladeomkostninger efter dine aktuelle elpriser.
          </Text>

          <View style={styles.emptyFeatureList}>
            <View style={styles.emptyFeatureItem}>
              <Feather name="battery-charging" size={16} color={theme.emerald} />
              <Text style={styles.emptyFeatureText}>Live batteriniveau og nøjagtig rest-rækkevidde</Text>
            </View>
            <View style={styles.emptyFeatureItem}>
              <Feather name="trending-up" size={16} color={theme.emerald} />
              <Text style={styles.emptyFeatureText}>Prisberegning for fuld opladning til dagens billigste spotpriser</Text>
            </View>
            <View style={styles.emptyFeatureItem}>
              <Feather name="thermometer" size={16} color={theme.emerald} />
              <Text style={styles.emptyFeatureText}>Kabinetemperatur og styring af forkonditionering</Text>
            </View>
            <View style={styles.emptyFeatureItem}>
              <Feather name="shield" size={16} color={theme.emerald} />
              <Text style={styles.emptyFeatureText}>Låsestatus og Vægtertilstand (Sentry Mode) overblik</Text>
            </View>
          </View>

          {onConnect ? (
            <Pressable onPress={onConnect} style={styles.primaryButton}>
              <Feather name="external-link" size={16} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Forbind Tesla-konto</Text>
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

  // Charging state and styling
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

  const renderBatterySection = () => (
    <View style={styles.sectionCard}>
      <View style={styles.sectionCardHeader}>
        <View style={styles.sectionCardIconWrap}>
          <Feather name="battery-charging" size={16} color={theme.emerald} />
        </View>
        <View style={styles.sectionCardTitleWrap}>
          <Text style={styles.sectionCardTitle}>Batteristatus & Rækkevidde</Text>
          <Text style={styles.sectionCardSubtitle}>Kapacitet, rækkeviddeestimater og ladegrænse</Text>
        </View>
      </View>

      <View style={styles.tileGrid}>
        <ValueTile
          label="Batteriniveau"
          value={vehicle.batteryLevel != null ? `${Math.round(vehicle.batteryLevel)}` : "–"}
          unit="%"
          subtext={
            vehicle.batteryLevel != null && vehicle.batteryLevel > chargeLimit
              ? `Over ladegrænse (${chargeLimit}%)`
              : `Mål: ${chargeLimit}%`
          }
          icon="battery"
          accent="emerald"
        />
        <ValueTile
          label="Ladegrænse"
          value={vehicle.chargeLimitSoc != null ? `${vehicle.chargeLimitSoc}` : "–"}
          unit="%"
          subtext="Anbefalet til daglig kørsel"
          icon="target"
          accent="blue"
        />
        <ValueTile
          label="Rækkevidde (WLTP)"
          value={vehicle.batteryRangeKm != null ? `${Math.round(vehicle.batteryRangeKm)}` : "–"}
          unit="km"
          subtext="Normeret beregning"
          icon="navigation"
        />
        <ValueTile
          label="Estimeret rækkevidde"
          value={
            vehicle.estimatedBatteryRangeKm != null
              ? `${Math.round(vehicle.estimatedBatteryRangeKm)}`
              : vehicle.batteryRangeKm != null
              ? `${Math.round(vehicle.batteryRangeKm * 0.93)}`
              : "–"
          }
          unit="km"
          subtext="Baseret på kørselshistorik"
          icon="activity"
        />
        <ValueTile
          label="Batterikapacitet"
          value={formatPrice(batteryKwh, 1)}
          unit="kWh"
          subtext={matchedModel ? `${matchedModel.modelName} ${matchedModel.name}` : "Estimeret pakke"}
          icon="layers"
        />
        <ValueTile
          label="Mangler til grænse"
          value={formatPrice(neededKwhToLimit, 1)}
          unit="kWh"
          subtext={`Til ${chargeLimit}% SOC (inkl. ladetab)`}
          icon="arrow-up-circle"
          accent="amber"
        />
      </View>

      <View style={styles.infoBanner}>
        <Feather name="info" size={14} color={theme.emerald} />
        <Text style={styles.infoBannerText}>
          {chargeLimit <= 80
            ? "Ladegrænsen er sat optimalt til 80%, hvilket forlænger batteriets levetid markant i hverdagen."
            : "Tip: Tesla anbefaler normalt en ladegrænse på 80% til daglig brug, og 100% før længere bilture."}
        </Text>
      </View>
    </View>
  );

  const renderChargingSection = () => (
    <View style={styles.sectionCard}>
      <View style={styles.sectionCardHeader}>
        <View style={styles.sectionCardIconWrap}>
          <Feather name="zap" size={16} color={theme.amber} />
        </View>
        <View style={styles.sectionCardTitleWrap}>
          <Text style={styles.sectionCardTitle}>Opladning & Effekt</Text>
          <Text style={styles.sectionCardSubtitle}>Ladehastighed, forbrug og omkostningsestimat</Text>
        </View>
      </View>

      {/* Charging State Banner */}
      <View
        style={[
          styles.chargingStateCard,
          chargingInfo.tone === "active" && styles.chargingStateCardActive,
          chargingInfo.tone === "complete" && styles.chargingStateCardComplete,
          chargingInfo.tone === "alert" && styles.chargingStateCardAlert,
        ]}
      >
        <View style={styles.chargingStateIconWrap}>
          <Feather
            name={
              chargingInfo.tone === "active"
                ? "zap"
                : chargingInfo.tone === "complete"
                ? "check-circle"
                : chargingInfo.tone === "alert"
                ? "alert-triangle"
                : "power"
            }
            size={18}
            color={
              chargingInfo.tone === "active"
                ? theme.emerald
                : chargingInfo.tone === "complete"
                ? theme.emerald
                : chargingInfo.tone === "alert"
                ? theme.coral
                : theme.inkMuted
            }
          />
        </View>
        <View style={styles.chargingStateCopy}>
          <Text style={styles.chargingStateHeadline}>{chargingInfo.label}</Text>
          <Text style={styles.chargingStateDesc}>{chargingInfo.description}</Text>
        </View>
        <View style={styles.chargePortBadge}>
          <Feather
            name={vehicle.chargePortDoorOpen ? "unlock" : "lock"}
            size={12}
            color={vehicle.chargePortDoorOpen ? theme.amber : theme.inkMuted}
          />
          <Text style={styles.chargePortText}>
            Ladeport: {vehicle.chargePortDoorOpen ? "Åben" : "Lukket"}
          </Text>
        </View>
      </View>

      <View style={styles.tileGrid}>
        <ValueTile
          label="Ladeeffekt"
          value={vehicle.chargerPowerKw != null ? formatPrice(vehicle.chargerPowerKw, 1) : "–"}
          unit="kW"
          subtext={
            vehicle.chargerPowerKw && vehicle.chargerPowerKw > 0
              ? `${vehicle.chargerPowerKw >= 50 ? "Hurtiglader (DC)" : "Normalladning (AC)"}`
              : "Ingen aktiv ladeeffekt"
          }
          icon="zap"
          accent={vehicle.chargerPowerKw && vehicle.chargerPowerKw > 0 ? "emerald" : "default"}
        />
        <ValueTile
          label="Resterende tid"
          value={estimatedHours != null ? formatDuration(estimatedHours) : "–"}
          subtext={`Indtil ${chargeLimit}% ladegrænse`}
          icon="clock"
        />
        <ValueTile
          label="Netspænding"
          value={vehicle.chargerVoltage != null ? `${vehicle.chargerVoltage}` : "–"}
          unit="V"
          subtext={vehicle.chargerVoltage ? (vehicle.chargerVoltage > 250 ? "3-faset net" : "1-faset net") : undefined}
          icon="activity"
        />
        <ValueTile
          label="Ladestrøm"
          value={vehicle.chargerActualCurrentA != null ? `${vehicle.chargerActualCurrentA}` : "–"}
          unit="A"
          subtext="Aktiv strømstyrke"
          icon="compass"
        />
        <ValueTile
          label="Tilført energi"
          value={
            vehicle.chargeEnergyAddedKwh != null ? formatPrice(vehicle.chargeEnergyAddedKwh, 1) : "–"
          }
          unit="kWh"
          subtext="Igangværende/sidste session"
          icon="plus-circle"
        />
        <ValueTile
          label="Pris til grænse"
          value={costToLimitKr > 0 ? `${formatPrice(costToLimitKr, 2)}` : "–"}
          unit="kr"
          subtext={currentPriceKr > 0 ? `Ved nu-pris (${formatPrice(currentPriceKr, 2)} kr/kWh)` : "Spotpris mangler"}
          icon="trending-up"
          accent="emerald"
        />
      </View>

      {costTo100Kr > 0 ? (
        <View style={styles.costSummaryRow}>
          <Text style={styles.costSummaryLabel}>Estimeret omkostning til 100% fuld opladning (ved nu-pris):</Text>
          <Text style={styles.costSummaryValue}>{formatPrice(costTo100Kr, 2)} kr</Text>
        </View>
      ) : null}
    </View>
  );

  const renderClimateSection = () => (
    <View style={styles.sectionCard}>
      <View style={styles.sectionCardHeader}>
        <View style={styles.sectionCardIconWrap}>
          <Feather name="thermometer" size={16} color={theme.blue} />
        </View>
        <View style={styles.sectionCardTitleWrap}>
          <Text style={styles.sectionCardTitle}>Klimastyring & Temperatur</Text>
          <Text style={styles.sectionCardSubtitle}>Kabineforhold og forkonditionering</Text>
        </View>
      </View>

      <View style={styles.tileGrid}>
        <ValueTile
          label="Kabinetemperatur"
          value={vehicle.insideTempC != null ? vehicle.insideTempC.toFixed(1).replace(".", ",") : "–"}
          unit="°C"
          subtext="Sensormåling inde i bilen"
          icon="home"
          accent="blue"
        />
        <ValueTile
          label="Udetemperatur"
          value={vehicle.outsideTempC != null ? vehicle.outsideTempC.toFixed(1).replace(".", ",") : "–"}
          unit="°C"
          subtext="Omgivelsestemperatur"
          icon="sun"
        />
        <ValueTile
          label="Forkonditionering"
          value={vehicle.isPreconditioning ? "Aktiv" : "Inaktiv"}
          subtext={
            vehicle.isPreconditioning
              ? "Varmer kabine og klargør batteri"
              : "Klimaanlæg i hviletilstand"
          }
          icon="wind"
          accent={vehicle.isPreconditioning ? "emerald" : "default"}
        />
        <ValueTile
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

      <View style={styles.infoBanner}>
        <Feather name="shield" size={14} color={theme.blue} />
        <Text style={styles.infoBannerText}>
          Forkonditionering bringer både kabinen og højspændingsbatteriet op på den mest optimale driftstemperatur, så
          du opnår fuld rækkevidde og hurtigere ladetider om vinteren.
        </Text>
      </View>
    </View>
  );

  const renderVehicleSection = () => (
    <View style={styles.sectionCard}>
      <View style={styles.sectionCardHeader}>
        <View style={styles.sectionCardIconWrap}>
          <Feather name="shield" size={16} color={theme.emerald} />
        </View>
        <View style={styles.sectionCardTitleWrap}>
          <Text style={styles.sectionCardTitle}>Køretøj, Sikkerhed & Udstyr</Text>
          <Text style={styles.sectionCardSubtitle}>Lås, vægtertilstand og systemspecifikationer</Text>
        </View>
      </View>

      {/* Security Status Highlight */}
      <View style={styles.securityRow}>
        <View
          style={[
            styles.securityPill,
            vehicle.locked ? styles.securityPillSuccess : styles.securityPillAlert,
          ]}
        >
          <Feather
            name={vehicle.locked ? "lock" : "unlock"}
            size={16}
            color={vehicle.locked ? theme.emerald : theme.coral}
          />
          <View>
            <Text
              style={[
                styles.securityPillTitle,
                { color: vehicle.locked ? theme.emerald : theme.coral },
              ]}
            >
              {vehicle.locked == null ? "Låsestatus ukendt" : vehicle.locked ? "Bilen er låst" : "Bilen er ulåst"}
            </Text>
            <Text style={styles.securityPillSubtitle}>
              {vehicle.locked ? "Alle døre og bagagerum er sikret" : "Advarsel: Bilen er ikke låst"}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.securityPill,
            vehicle.sentryMode ? styles.securityPillSuccess : styles.securityPillNeutral,
          ]}
        >
          <Feather
            name="eye"
            size={16}
            color={vehicle.sentryMode ? theme.emerald : theme.inkMuted}
          />
          <View>
            <Text
              style={[
                styles.securityPillTitle,
                { color: vehicle.sentryMode ? theme.emerald : theme.inkMuted },
              ]}
            >
              Vægtertilstand: {vehicle.sentryMode ? "Aktiv" : "Slået fra"}
            </Text>
            <Text style={styles.securityPillSubtitle}>
              {vehicle.sentryMode ? "Overvåger omgivelser med kameraer" : "Kameraovervågning er slukket"}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.tileGrid}>
        <ValueTile
          label="Kilometertæller"
          value={vehicle.odometerKm != null ? Math.round(vehicle.odometerKm).toLocaleString("da-DK") : "–"}
          unit="km"
          subtext="Total kørte kilometer"
          icon="map-pin"
        />
        <ValueTile
          label="Gear / Tilstand"
          value={formatShiftState(vehicle.shiftState)}
          subtext={vehicle.speedKmh ? `Hastighed: ${Math.round(vehicle.speedKmh)} km/t` : "Bilen holder stille"}
          icon="disc"
        />
        <ValueTile
          label="Softwareversion"
          value={vehicle.carVersion ?? "–"}
          subtext="Tesla OS firmware"
          icon="cpu"
        />
        <View style={styles.tile}>
          <View style={styles.tileTopRow}>
            <Text style={styles.tileLabel}>EKSTERIØRFARVE</Text>
            <View style={[styles.colorSwatch, { backgroundColor: exteriorColor.hex }]} />
          </View>
          <Text style={styles.tileValueSmall}>{exteriorColor.label}</Text>
          <Text style={styles.tileSubtext}>Fabrikslakering</Text>
        </View>
        <ValueTile
          label="Fælge"
          value={wheelName}
          subtext="Hjulmontering"
          icon="circle"
        />
        <ValueTile
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
      {/* Back button if used as full page view */}
      {onBack ? (
        <Pressable onPress={onBack} style={styles.backButton}>
          <Feather name="arrow-left" size={16} color={theme.inkLight} />
          <Text style={styles.backButtonText}>Tilbage til overblik</Text>
        </Pressable>
      ) : null}

      {/* Main Luxury Hero Card */}
      <View style={styles.heroCard}>
        {/* Top bar with vehicle name, tags and controls */}
        <View style={styles.heroHeader}>
          <View style={styles.heroTitles}>
            <View style={styles.brandRow}>
              <Text style={styles.heroEyebrow}>TESLA FLEET CONNECT</Text>
              <View style={styles.liveBadge}>
                <View style={styles.livePulseDot} />
                <Text style={styles.liveBadgeText}>Online</Text>
              </View>
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
                  color={showOnDashboard ? theme.emerald : theme.inkMuted}
                />
              </Pressable>
            ) : null}
            <Pressable
              onPress={onRefresh}
              disabled={refreshing}
              accessibilityLabel="Opdater Tesla-telemetri"
              style={[styles.refreshButton, refreshing && styles.refreshButtonActive]}
            >
              <Feather
                name={refreshing ? "loader" : "refresh-cw"}
                size={14}
                color={theme.inkLight}
              />
              <Text style={styles.refreshButtonText}>{refreshing ? "Henter..." : "Opdater"}</Text>
            </Pressable>
          </View>
        </View>

        {/* Battery Gauge Hero Display */}
        <View style={styles.batteryHeroWrap}>
          <View style={styles.batteryHeaderRow}>
            <View style={styles.batteryBigRow}>
              <Text style={styles.batteryPercentNumber}>
                {vehicle.batteryLevel != null ? Math.round(vehicle.batteryLevel) : "–"}
              </Text>
              <Text style={styles.batteryPercentSign}>%</Text>
            </View>
            <View style={styles.batteryRangeColumn}>
              <View style={styles.batteryRangeRow}>
                <Feather name="navigation" size={14} color={theme.emerald} />
                <Text style={styles.batteryRangeValue}>
                  {vehicle.batteryRangeKm != null ? `${Math.round(vehicle.batteryRangeKm)} km` : "–"}
                </Text>
              </View>
              <Text style={styles.batteryRangeLabel}>Estimeret rækkevidde</Text>
            </View>
          </View>

          {/* Visual Battery Progress Bar with Charge Limit Tick */}
          <View style={styles.batteryGaugeContainer}>
            <View style={styles.batteryGaugeTrack}>
              <View
                style={[
                  styles.batteryGaugeFill,
                  {
                    width: `${Math.min(100, Math.max(4, batteryLevel))}%`,
                    backgroundColor:
                      batteryLevel < 15
                        ? theme.coral
                        : batteryLevel < 25
                        ? theme.amber
                        : theme.emerald,
                  },
                ]}
              />
              {/* Charge limit marker */}
              <View
                style={[
                  styles.chargeLimitMarker,
                  { left: `${Math.min(100, Math.max(0, chargeLimit))}%` },
                ]}
              >
                <View style={styles.chargeLimitLine} />
              </View>
            </View>
            <View style={styles.batteryGaugeScale}>
              <Text style={styles.scaleText}>0%</Text>
              <View
                style={[
                  styles.scaleLimitBadge,
                  { left: `${Math.min(92, Math.max(8, chargeLimit))}%` },
                ]}
              >
                <Text style={styles.scaleLimitText}>Grænse {chargeLimit}%</Text>
              </View>
              <Text style={styles.scaleText}>100%</Text>
            </View>
          </View>

          {/* Glance Status Row */}
          <View style={styles.glanceRow}>
            <View style={styles.glanceItem}>
              <Feather
                name={chargingInfo.tone === "active" ? "zap" : "power"}
                size={13}
                color={chargingInfo.tone === "active" ? theme.emerald : theme.inkMuted}
              />
              <Text style={styles.glanceText}>
                {chargingInfo.label}
                {vehicle.chargerPowerKw && vehicle.chargerPowerKw > 0
                  ? ` · ${formatPrice(vehicle.chargerPowerKw, 1)} kW`
                  : ""}
              </Text>
            </View>
            <View style={styles.glanceDivider} />
            <View style={styles.glanceItem}>
              <Feather
                name={vehicle.locked ? "lock" : "unlock"}
                size={13}
                color={vehicle.locked ? theme.emerald : theme.coral}
              />
              <Text style={styles.glanceText}>{vehicle.locked ? "Låst" : "Ulåst"}</Text>
            </View>
            <View style={styles.glanceDivider} />
            <View style={styles.glanceItem}>
              <Feather name="thermometer" size={13} color={theme.blue} />
              <Text style={styles.glanceText}>
                {vehicle.insideTempC != null
                  ? `${vehicle.insideTempC.toFixed(1).replace(".", ",")} °C`
                  : "–"}
              </Text>
            </View>
            <View style={styles.glanceDivider} />
            <View style={styles.glanceItem}>
              <Feather
                name="eye"
                size={13}
                color={vehicle.sentryMode ? theme.emerald : theme.inkMuted}
              />
              <Text style={styles.glanceText}>
                {vehicle.sentryMode ? "Sentry aktiv" : "Sentry fra"}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Interactive Section Switcher Tabs */}
      <View style={styles.sectionTabsWrap}>
        <Text style={styles.sectionTabsHeading}>VÆLG SEKTION</Text>
        <View style={styles.sectionTabsRow}>
          {sections.map((sec) => {
            const isActive = selectedSection === sec.id;
            return (
              <Pressable
                key={sec.id}
                onPress={() => setSelectedSection(sec.id)}
                style={[styles.sectionTab, isActive && styles.sectionTabActive]}
              >
                <Feather
                  name={sec.icon}
                  size={14}
                  color={isActive ? theme.emerald : theme.inkMuted}
                />
                <Text style={[styles.sectionTabText, isActive && styles.sectionTabTextActive]}>
                  {sec.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Dynamic Section Display */}
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

      {/* Meta Footer */}
      <View style={styles.metaFooter}>
        <View style={styles.metaLeft}>
          <Feather name="clock" size={12} color={theme.inkDim} />
          <Text style={styles.metaText}>
            Senest synkroniseret: {formatRelativeTime(vehicle.fetchedAt)}
          </Text>
        </View>
        <Text style={styles.metaRight}>Tesla Fleet Telemetry · Sikker OAuth 2.0</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    marginTop: 12,
    marginBottom: 24,
    gap: 14,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  backButtonText: {
    fontFamily: "DMSans_500Medium",
    fontSize: 13,
    color: theme.inkLight,
  },
  heroCard: {
    backgroundColor: theme.bg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    padding: 18,
    gap: 18,
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
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  heroEyebrow: {
    fontFamily: "DMSans_700Bold",
    fontSize: 10,
    letterSpacing: 0.6,
    color: theme.inkMuted,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 10,
    backgroundColor: theme.emeraldBg,
    borderWidth: 1,
    borderColor: theme.emeraldBorder,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.emerald,
  },
  liveBadgeText: {
    fontFamily: "DMSans_700Bold",
    fontSize: 9,
    color: theme.emerald,
  },
  vehicleName: {
    fontFamily: "Fraunces_600SemiBold",
    fontSize: 24,
    lineHeight: 28,
    color: theme.inkLight,
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
    gap: 5,
    backgroundColor: theme.pillBg,
    borderWidth: 1,
    borderColor: theme.pillBorder,
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  colorMiniDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  heroTagText: {
    fontFamily: "DMSans_500Medium",
    fontSize: 11,
    color: theme.inkLight,
  },
  heroActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  heroIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.pillBg,
    borderWidth: 1,
    borderColor: theme.pillBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  heroIconButtonActive: {
    backgroundColor: theme.emeraldBg,
    borderColor: theme.emeraldBorder,
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: theme.emeraldDark,
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: theme.emerald,
  },
  refreshButtonActive: {
    opacity: 0.7,
  },
  refreshButtonText: {
    fontFamily: "DMSans_700Bold",
    fontSize: 12,
    color: theme.inkLight,
  },
  batteryHeroWrap: {
    backgroundColor: theme.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    padding: 16,
    gap: 14,
  },
  batteryHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  batteryBigRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 3,
  },
  batteryPercentNumber: {
    fontFamily: "Fraunces_600SemiBold",
    fontSize: 42,
    lineHeight: 46,
    color: theme.inkLight,
  },
  batteryPercentSign: {
    fontFamily: "DMSans_700Bold",
    fontSize: 20,
    color: theme.emerald,
  },
  batteryRangeColumn: {
    alignItems: "flex-end",
  },
  batteryRangeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  batteryRangeValue: {
    fontFamily: "DMSans_700Bold",
    fontSize: 18,
    color: theme.inkLight,
  },
  batteryRangeLabel: {
    fontFamily: "DMSans_400Regular",
    fontSize: 11,
    color: theme.inkMuted,
    marginTop: 2,
  },
  batteryGaugeContainer: {
    gap: 6,
  },
  batteryGaugeTrack: {
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.cardSubtle,
    borderWidth: 1,
    borderColor: theme.cardBorderSubtle,
    overflow: "hidden",
    position: "relative",
  },
  batteryGaugeFill: {
    height: "100%",
    borderRadius: 9,
  },
  chargeLimitMarker: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    marginLeft: -1,
    backgroundColor: "#FFFFFF",
    zIndex: 2,
  },
  chargeLimitLine: {
    width: 2,
    height: "100%",
    backgroundColor: "#FFFFFF",
  },
  batteryGaugeScale: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    position: "relative",
    paddingHorizontal: 2,
  },
  scaleText: {
    fontFamily: "DMSans_500Medium",
    fontSize: 10,
    color: theme.inkDim,
  },
  scaleLimitBadge: {
    position: "absolute",
    top: 0,
    marginLeft: -32,
    backgroundColor: theme.cardSubtle,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.cardBorderSubtle,
  },
  scaleLimitText: {
    fontFamily: "DMSans_700Bold",
    fontSize: 9,
    color: theme.inkLight,
  },
  glanceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.cardBorderSubtle,
    gap: 8,
  },
  glanceItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  glanceDivider: {
    width: 1,
    height: 12,
    backgroundColor: theme.cardBorderSubtle,
  },
  glanceText: {
    fontFamily: "DMSans_500Medium",
    fontSize: 11,
    color: theme.inkLight,
  },
  sectionTabsWrap: {
    gap: 8,
  },
  sectionTabsHeading: {
    fontFamily: "DMSans_700Bold",
    fontSize: 10,
    letterSpacing: 0.5,
    color: theme.inkMuted,
    paddingLeft: 4,
  },
  sectionTabsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  sectionTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: 18,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.cardBorder,
  },
  sectionTabActive: {
    backgroundColor: theme.emeraldDark,
    borderColor: theme.emerald,
  },
  sectionTabText: {
    fontFamily: "DMSans_700Bold",
    fontSize: 12,
    color: theme.inkMuted,
  },
  sectionTabTextActive: {
    color: theme.inkLight,
  },
  contentWrap: {
    gap: 14,
  },
  allSectionsStack: {
    gap: 16,
  },
  sectionCard: {
    backgroundColor: theme.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    padding: 16,
    gap: 14,
  },
  sectionCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sectionCardIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: theme.cardSubtle,
    borderWidth: 1,
    borderColor: theme.cardBorderSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionCardTitleWrap: {
    flex: 1,
  },
  sectionCardTitle: {
    fontFamily: "DMSans_700Bold",
    fontSize: 15,
    color: theme.inkLight,
  },
  sectionCardSubtitle: {
    fontFamily: "DMSans_400Regular",
    fontSize: 11,
    color: theme.inkMuted,
    marginTop: 1,
  },
  tileGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 9,
  },
  tile: {
    minWidth: 140,
    flex: 1,
    backgroundColor: theme.bg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.cardBorderSubtle,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 3,
  },
  tileTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tileLabel: {
    fontFamily: "DMSans_700Bold",
    fontSize: 9,
    letterSpacing: 0.3,
    color: theme.inkMuted,
  },
  tileValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
    marginTop: 2,
  },
  tileValue: {
    fontFamily: "Fraunces_600SemiBold",
    fontSize: 19,
    color: theme.inkLight,
  },
  tileValueSmall: {
    fontFamily: "DMSans_700Bold",
    fontSize: 13,
    color: theme.inkLight,
    marginTop: 4,
  },
  tileUnit: {
    fontFamily: "DMSans_700Bold",
    fontSize: 12,
    color: theme.emerald,
  },
  tileSubtext: {
    fontFamily: "DMSans_400Regular",
    fontSize: 10,
    color: theme.inkDim,
    marginTop: 1,
  },
  colorSwatch: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: theme.cardSubtle,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.cardBorderSubtle,
    padding: 10,
  },
  infoBannerText: {
    flex: 1,
    fontFamily: "DMSans_400Regular",
    fontSize: 11,
    lineHeight: 16,
    color: theme.inkMuted,
  },
  chargingStateCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 9,
    backgroundColor: theme.bg,
    borderWidth: 1,
    borderColor: theme.cardBorderSubtle,
  },
  chargingStateCardActive: {
    borderColor: theme.emeraldBorder,
    backgroundColor: theme.emeraldBg,
  },
  chargingStateCardComplete: {
    borderColor: theme.emeraldBorder,
    backgroundColor: theme.emeraldBg,
  },
  chargingStateCardAlert: {
    borderColor: theme.coralBorder,
    backgroundColor: theme.coralBg,
  },
  chargingStateIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.card,
    alignItems: "center",
    justifyContent: "center",
  },
  chargingStateCopy: {
    flex: 1,
  },
  chargingStateHeadline: {
    fontFamily: "DMSans_700Bold",
    fontSize: 14,
    color: theme.inkLight,
  },
  chargingStateDesc: {
    fontFamily: "DMSans_400Regular",
    fontSize: 11,
    color: theme.inkMuted,
    marginTop: 2,
  },
  chargePortBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: theme.card,
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: theme.cardBorderSubtle,
  },
  chargePortText: {
    fontFamily: "DMSans_500Medium",
    fontSize: 11,
    color: theme.inkLight,
  },
  costSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: theme.bg,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.cardBorderSubtle,
  },
  costSummaryLabel: {
    fontFamily: "DMSans_500Medium",
    fontSize: 11,
    color: theme.inkMuted,
  },
  costSummaryValue: {
    fontFamily: "DMSans_700Bold",
    fontSize: 13,
    color: theme.emerald,
  },
  securityRow: {
    gap: 9,
  },
  securityPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  securityPillSuccess: {
    backgroundColor: theme.emeraldBg,
    borderColor: theme.emeraldBorder,
  },
  securityPillAlert: {
    backgroundColor: theme.coralBg,
    borderColor: theme.coralBorder,
  },
  securityPillNeutral: {
    backgroundColor: theme.bg,
    borderColor: theme.cardBorderSubtle,
  },
  securityPillTitle: {
    fontFamily: "DMSans_700Bold",
    fontSize: 13,
  },
  securityPillSubtitle: {
    fontFamily: "DMSans_400Regular",
    fontSize: 11,
    color: theme.inkMuted,
    marginTop: 2,
  },
  metaFooter: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 4,
    gap: 8,
  },
  metaLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    fontFamily: "DMSans_400Regular",
    fontSize: 11,
    color: theme.inkDim,
  },
  metaRight: {
    fontFamily: "DMSans_400Regular",
    fontSize: 11,
    color: theme.inkDim,
  },
  emptyContainer: {
    backgroundColor: theme.bg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    padding: 24,
    alignItems: "center",
    textAlign: "center",
    gap: 14,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontFamily: "Fraunces_600SemiBold",
    fontSize: 22,
    color: theme.inkLight,
  },
  emptySubtitle: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    lineHeight: 19,
    color: theme.inkMuted,
    textAlign: "center",
    maxWidth: 480,
  },
  emptyFeatureList: {
    width: "100%",
    maxWidth: 480,
    backgroundColor: theme.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    padding: 14,
    gap: 10,
    marginVertical: 4,
  },
  emptyFeatureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  emptyFeatureText: {
    fontFamily: "DMSans_500Medium",
    fontSize: 12,
    color: theme.inkLight,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: theme.emeraldDark,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 6,
    borderWidth: 1,
    borderColor: theme.emerald,
  },
  primaryButtonText: {
    fontFamily: "DMSans_700Bold",
    fontSize: 13,
    color: "#FFFFFF",
  },
});

