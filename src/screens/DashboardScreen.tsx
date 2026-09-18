import { Feather } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PricePoint } from "../prices";
import { AddressSuggestion, searchAddresses } from "../addresses";
import { EvModel, fetchOpenEvModels } from "../evData";
import { TeslaConnectionCard } from "../components/TeslaConnectionCard";
import { FamilyPlanner as ExtractedFamilyPlanner } from "../components/FamilyPlanner";
import { DevicePlanCard } from "../components/DevicePlanCard";
import { PriceChart } from "../components/PriceChart";
import { WasteCollectionCard } from "../components/WasteCollectionCard";
import { SecondaryTabScreen } from "./SecondaryTabScreen";
import { useTeslaConnection } from "../hooks/useTeslaConnection";
import { useEnergyPrices } from "../hooks/useEnergyPrices";
import { useEforsyning } from "../hooks/useEforsyning";
import { useWasteCalendar } from "../hooks/useWasteCalendar";
import { DEVICES_STORAGE_KEY, PROFILE_STORAGE_KEY, loadDevices, loadProfile, saveDevices, saveProfile as saveStoredProfile, updateProfile } from "../services/storage";
import { HouseholdDevice } from "../types/app";
import { formatPrice } from "../utils/formatting";
import { colors, dkDay, dkTime } from "../styles/theme";
import { styles } from "../styles/appStyles";

const EFORSYNING_API_URL = "http://localhost:8787";
type DeviceKind = HouseholdDevice["kind"];

function Dashboard() {
  const { width } = useWindowDimensions();
  const isMobile = width < 520;
  const { gridSuppliers, selectedSupplier, setSelectedSupplierId, now, prices, loading, refreshing, isSample, load } = useEnergyPrices();
  const [address, setAddress] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [addressLookupLoading, setAddressLookupLoading] = useState(false);
  const [addressError, setAddressError] = useState("");
  const area = selectedSupplier.area;
  const { data: eforsyning, username: eforsyningUsername, setUsername: setEforsyningUsername, password: eforsyningPassword, setPassword: setEforsyningPassword, supplierId: eforsyningSupplierId, setSupplierId: setEforsyningSupplierId, loading: eforsyningLoading, error: eforsyningError, login: loginToEforsyning } = useEforsyning();
  const [evModels, setEvModels] = useState<EvModel[]>([]);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [quickDevices, setQuickDevices] = useState<HouseholdDevice[]>([]);
  const [expandedQuickId, setExpandedQuickId] = useState<number | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const [addressMunicipality, setAddressMunicipality] = useState<string | undefined>();
  const [addressPostcode, setAddressPostcode] = useState<string | undefined>();
  const [wasteCalendarUrl, setWasteCalendarUrl] = useState("");
  const [wasteShowOnDashboard, setWasteShowOnDashboard] = useState(false);
  const [activeTab, setActiveTab] = useState<"dashboard" | "home" | "profile">("dashboard");
  const tesla = useTeslaConnection(activeTab);

  useEffect(() => {
    fetchOpenEvModels().then(setEvModels).catch(() => undefined);
  }, []);

  const renderDeviceCard = (props: any) => <DevicePlanCard {...props} styles={styles} colors={colors} dkTime={dkTime} dkDay={dkDay} />;

  useEffect(() => {
    loadProfile().then((profile) => {
      if (!profile) return;
      setProfileName(profile.name ?? "");
      setProfileEmail(profile.email ?? "");
      setAddress(profile.address ?? "");
      setAddressMunicipality(profile.municipalityCode);
      setAddressPostcode(profile.postcode);
      setWasteCalendarUrl(profile.wasteCalendarUrl ?? "");
      setWasteShowOnDashboard(profile.wasteShowOnDashboard ?? false);
    }).catch(() => undefined);
    loadDevices().then((savedDevices) => {
      if (savedDevices) setQuickDevices(savedDevices);
    }).catch(() => undefined);
  }, [activeTab]);

  const { events: wasteEvents, error: wasteError, health: wasteHealth } = useWasteCalendar({ municipality: addressMunicipality, postcode: addressPostcode, calendarUrl: wasteCalendarUrl, address });

  const saveProfile = async () => {
    await saveStoredProfile({ name: profileName, email: profileEmail, address, municipalityCode: addressMunicipality, postcode: addressPostcode, wasteCalendarUrl, wasteShowOnDashboard });
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
    void saveStoredProfile({ name: profileName, email: profileEmail, address: suggestion.text, municipalityCode: suggestion.municipalityCode, postcode: suggestion.postcode });
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
      }
      else setAddressError(`${result.name} blev fundet, men findes ikke i prislisten endnu.`);
    } catch (error) {
      setAddressError(error instanceof Error ? error.message : "Netselskabet kunne ikke findes");
    } finally {
      setAddressLookupLoading(false);
    }
  };

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

  if (activeTab !== "dashboard") return <SecondaryTabScreen activeTab={activeTab} now={now} load={load} isMobile={isMobile} styles={styles} colors={colors} profileName={profileName} setProfileName={setProfileName} profileEmail={profileEmail} setProfileEmail={setProfileEmail} saveProfile={saveProfile} profileSaved={profileSaved} address={address} setAddress={setAddress} addressSuggestions={addressSuggestions} chooseAddress={chooseAddress} addressLookupLoading={addressLookupLoading} addressError={addressError} selectedSupplier={selectedSupplier} prices={prices} evModels={evModels} teslaConnected={tesla.connected} teslaVehicle={tesla.vehicle} teslaRefreshing={tesla.refreshing} teslaShowOnDashboard={tesla.showOnDashboard} connectTesla={tesla.connect} refreshTesla={tesla.refresh} saveTeslaVisibility={tesla.setDashboardVisibility} renderDeviceCard={renderDeviceCard} navigation={navigation} />;

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
            {tesla.showOnDashboard ? <TeslaConnectionCard connected={tesla.connected} vehicle={tesla.vehicle} points={prices} now={now} evModels={evModels} refreshing={tesla.refreshing} showOnDashboard={tesla.showOnDashboard} onConnect={tesla.connect} onRefresh={() => void tesla.refresh()} onToggleDashboard={() => tesla.setDashboardVisibility(false)} /> : null}
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
                      void saveDevices(next);
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
    </SafeAreaView>
  );
}

export function DashboardScreen() {
  return <Dashboard />;
}

