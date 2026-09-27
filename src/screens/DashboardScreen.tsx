import { Feather } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
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
import { useState } from 'react';
import { FamilyPlanner as ExtractedFamilyPlanner } from "../components/FamilyPlanner";
import { DevicePlanCard } from "../components/DevicePlanCard";
import { PriceChart } from "../components/PriceChart";
import { BottomTabs } from "../components/BottomTabs";
import { WasteCollectionCard } from "../components/WasteCollectionCard";
import { SecondaryTabScreen } from "./SecondaryTabsScreen";
import { useTeslaConnection } from "../hooks/useTeslaConnection";
import { useEnergyPrices } from "../hooks/useEnergyPrices";
import { useWasteCalendar } from "../hooks/useWasteCalendar";
import { useQuickDevices } from "../hooks/useQuickDevices";
import { useProfileAddress } from "../hooks/useProfileAddress";
import { useEvModels } from "../hooks/useEvModels";
import { useElectricityUsage } from "../hooks/useElectricityUsage";
import { useDashboardViewState } from "../hooks/useDashboardViewState";
import { useRememberedScroll } from "../hooks/useRememberedScroll";
import { formatPrice } from "../utils/formatting";
import { colors, dkDay, dkTime } from "../styles/theme";
import { styles } from "../styles/appStyles";

function Dashboard() {
  const { width } = useWindowDimensions();
  const isMobile = width < 520;
  const { gridSuppliers, selectedSupplier, setSelectedSupplierId, now, prices, loading, refreshing, isSample, load } = useEnergyPrices();
  const area = selectedSupplier.area;
  const { activeTab, setActiveTab } = useDashboardViewState();
  const [chartScrubbing, setChartScrubbing] = useState(false);
  const rememberedScroll = useRememberedScroll('dashboard', activeTab === 'dashboard');
  const evModels = useEvModels();
  const {
    profileName,
    setProfileName,
    profileEmail,
    profileSaved,
    profileSaving,
    profileError,
    saveProfile,
    address,
    setAddress,
    addressSelected,
    addressSuggestions,
    chooseAddress,
    addressLookupLoading,
    addressError,
    addressMunicipality,
    addressPostcode,
    wasteCalendarUrl,
    wasteShowOnDashboard,
  } = useProfileAddress({ refreshKey: activeTab, gridSuppliers, setSelectedSupplierId });
  const { devices: quickDevices, expandedId: expandedQuickId, toggleExpanded: toggleQuickExpanded, updateDevice: updateQuickDevice } = useQuickDevices(activeTab);
  const tesla = useTeslaConnection(activeTab);
  const electricityUsage = useElectricityUsage(activeTab === 'home', now);

  const renderDeviceCard = (props: any) => <DevicePlanCard {...props} styles={styles} colors={colors} dkTime={dkTime} dkDay={dkDay} />;

  const { events: wasteEvents, error: wasteError, health: wasteHealth } = useWasteCalendar({ municipality: addressMunicipality, postcode: addressPostcode, calendarUrl: wasteCalendarUrl, address });

  const navigation = <BottomTabs activeTab={activeTab} onSelect={setActiveTab} />;

  if (activeTab !== "dashboard") return <SecondaryTabScreen key={activeTab} activeTab={activeTab} now={now} load={load} isMobile={isMobile} styles={styles} colors={colors} profileName={profileName} setProfileName={setProfileName} profileEmail={profileEmail} saveProfile={saveProfile} profileSaved={profileSaved} profileSaving={profileSaving} profileError={profileError} address={address} setAddress={setAddress} addressSelected={addressSelected} addressSuggestions={addressSuggestions} chooseAddress={chooseAddress} addressLookupLoading={addressLookupLoading} addressError={addressError} selectedSupplier={selectedSupplier} prices={prices} evModels={evModels} teslaConnected={tesla.connected} teslaVehicle={tesla.vehicle} teslaRefreshing={tesla.refreshing} connectTesla={tesla.connect} refreshTesla={tesla.refresh} electricityUsage={electricityUsage} renderDeviceCard={renderDeviceCard} navigation={navigation} />;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar style="dark" />
      <ScrollView
        ref={rememberedScroll.scrollRef}
        onLayout={rememberedScroll.onLayout}
        onContentSizeChange={rememberedScroll.onContentSizeChange}
        onScroll={rememberedScroll.onScroll}
        scrollEventThrottle={100}
        style={styles.dashboardScroll}
        contentContainerStyle={[styles.scrollContent, styles.scrollContentGrow]}
        nestedScrollEnabled
        scrollEnabled={!chartScrubbing}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.primary} />}
      >
        <View style={[styles.container, isMobile && styles.containerMobile]}>
          <View style={styles.header}>
            <View>
              <Text style={styles.brand}>STRØMBLIK</Text>
              <Text style={styles.date}>{dkDay.format(new Date(now))}</Text>
            </View>
            <Pressable accessibilityLabel="Opdater priser" onPress={() => void load(true)} style={styles.iconButton}>
              <Feather name="refresh-cw" size={19} color={colors.primary} />
            </Pressable>
          </View>

          <View style={styles.dashboardContext}><Text style={styles.dashboardContextLabel}>PRISER FRA</Text><Text style={styles.dashboardContextValue}>{selectedSupplier.name} · {area}</Text></View>

          {isSample ? (
            <View style={styles.notice}>
              <Feather name="wifi-off" size={16} color={colors.coral} />
              <Text style={styles.noticeText}>{loading ? 'Henter priser: eksempelpriser vises imens' : 'Priser kunne ikke hentes: eksempelpriser vises'}</Text>
            </View>
          ) : null}

          <View style={[styles.trendPanel, isMobile && styles.trendPanelMobile]}>
            <View style={styles.sectionHeadingRow}>
              <View>
                <Text style={styles.eyebrow}>TIMEPRISER · OP TIL 7 DAGE</Text>
                <Text style={styles.sectionTitle}>Prisens bevægelse</Text>
              </View>
              {loading ? <ActivityIndicator color={colors.primary} size="small" /> : <Feather name="trending-up" size={22} color={colors.coral} />}
            </View>
            <PriceChart points={prices} now={now} onScrubChange={setChartScrubbing} />
          </View>

          <View style={styles.dashboardDevicesSummary}>
            <Text style={styles.pageEyebrow}>MIT HJEM</Text>
            <Text style={styles.dashboardSummaryText}>Dine apparater ligger samlet i Mit hjem. Bilstatus finder du under Bil.</Text>
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
                    onToggle={() => toggleQuickExpanded(device.id)}
                    onChange={(changes) => updateQuickDevice(device.id, changes)}
                  />
                ))}
              </View>
            ) : <Text style={styles.dashboardSummaryText}>Vælg “Vis på overblik” på en enhed i Mit hjem for hurtig adgang her.</Text>}
            <Pressable onPress={() => setActiveTab("home")} style={styles.dashboardSummaryButton}><Text style={styles.dashboardSummaryButtonText}>Åbn Mit hjem</Text><Feather name="arrow-right" size={15} color={colors.white} /></Pressable>
          </View>


        </View>
      </ScrollView>
      {navigation}
    </SafeAreaView>
  );
}

export function DashboardScreen() {
  return <Dashboard />;
}

