import { AppIcon } from '../components/AppIcon';
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
import { useWasteReminder } from '../hooks/useWasteReminder';
import { WasteCollectionCard } from "../components/WasteCollectionCard";
import { SecondaryTabScreen } from "./SecondaryTabsScreen";
import { useTeslaConnection } from "../hooks/useTeslaConnection";
import { useEnergyPrices } from "../hooks/useEnergyPrices";
import { useWasteCalendar } from "../hooks/useWasteCalendar";
import { useQuickDevices } from "../hooks/useQuickDevices";
import { useProfileAddress } from "../hooks/useProfileAddress";
import { useLowPriceAlert } from "../hooks/useLowPriceAlert";
import { useHighPriceAlert } from "../hooks/useHighPriceAlert";
import { useConsumptionBudgetAlert } from "../hooks/useConsumptionBudgetAlert";
import { useChargingWindowAlert } from "../hooks/useChargingWindowAlert";
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
    lowPriceAlerts,
    setLowPriceAlerts,
    highPriceAlerts,
    setHighPriceAlerts,
    lowPriceAlertThresholdOre,
    setLowPriceAlertThresholdOre,
    highPriceAlertThresholdOre,
    setHighPriceAlertThresholdOre,
    consumptionBudgetAlerts,
    setConsumptionBudgetAlerts,
    consumptionBudgetUnit,
    consumptionBudgetLimit,
    setConsumptionBudget,
    chargingWindowAlerts,
    setChargingWindowAlerts,
    chargingDurationHours,
    chargingReadyByHour,
    setChargingWindow,
    monthlyEnergySummaryAlerts,
    monthlyEnergySummaryHour,
    setMonthlyEnergySummary,
  } = useProfileAddress({ refreshKey: activeTab, gridSuppliers, setSelectedSupplierId });
  const { lowPriceAlertStatus, requestLowPriceAlertPermission } = useLowPriceAlert({ enabled: lowPriceAlerts, points: prices, samplePrices: isSample, thresholdOrePerKwh: lowPriceAlertThresholdOre });
  const { highPriceAlertStatus, requestHighPriceAlertPermission } = useHighPriceAlert({ enabled: highPriceAlerts, points: prices, samplePrices: isSample, thresholdOrePerKwh: highPriceAlertThresholdOre });
  const { devices: quickDevices, expandedId: expandedQuickId, toggleExpanded: toggleQuickExpanded, updateDevice: updateQuickDevice } = useQuickDevices(activeTab);
  const tesla = useTeslaConnection(activeTab);
  const electricityUsage = useElectricityUsage(activeTab === 'electricity', now);
  const { consumptionBudgetAlertStatus, requestConsumptionBudgetAlertPermission } = useConsumptionBudgetAlert({ enabled: consumptionBudgetAlerts, unit: consumptionBudgetUnit, limit: consumptionBudgetLimit, usage: electricityUsage.currentMonthDays, prices, now });
  const { chargingWindowAlertStatus, requestChargingWindowAlertPermission } = useChargingWindowAlert({ enabled: chargingWindowAlerts, points: prices, samplePrices: isSample, durationHours: chargingDurationHours, readyByHour: chargingReadyByHour });

  const renderDeviceCard = (props: any) => <DevicePlanCard {...props} styles={styles} colors={colors} dkTime={dkTime} dkDay={dkDay} />;

  const { events: wasteEvents, error: wasteError, health: wasteHealth } = useWasteCalendar({ municipality: addressMunicipality, postcode: addressPostcode, calendarUrl: wasteCalendarUrl, address });

  const wasteReminder = useWasteReminder(wasteEvents);

  const navigation = <BottomTabs activeTab={activeTab} onSelect={setActiveTab} />;

  const changeLowPriceAlerts = async (enabled: boolean) => {
    if (enabled) await requestLowPriceAlertPermission();
    await setLowPriceAlerts(enabled);
  };
  const changeHighPriceAlerts = async (enabled: boolean) => {
    if (enabled) await requestHighPriceAlertPermission();
    await setHighPriceAlerts(enabled);
  };
  const changeConsumptionBudgetAlerts = async (enabled: boolean) => {
    if (enabled) await requestConsumptionBudgetAlertPermission();
    await setConsumptionBudgetAlerts(enabled);
  };
  const changeChargingWindowAlerts = async (enabled: boolean) => {
    if (enabled) await requestChargingWindowAlertPermission();
    await setChargingWindowAlerts(enabled);
  };
  const changeMonthlyEnergySummaryAlerts = async (enabled: boolean) => {
    await setMonthlyEnergySummary(enabled, monthlyEnergySummaryHour);
  };

  if (activeTab !== "dashboard") return <SecondaryTabScreen key={activeTab} activeTab={activeTab} wasteReminder={wasteReminder} wasteContent={<WasteCollectionCard events={wasteEvents} error={wasteError} wasteHealth={wasteHealth} onOpenProfile={() => setActiveTab('profile')} />} now={now} isMobile={isMobile} styles={styles} colors={colors} profileName={profileName} setProfileName={setProfileName} profileEmail={profileEmail} saveProfile={saveProfile} profileSaved={profileSaved} profileSaving={profileSaving} profileError={profileError} address={address} setAddress={setAddress} addressSelected={addressSelected} addressSuggestions={addressSuggestions} chooseAddress={chooseAddress} addressLookupLoading={addressLookupLoading} addressError={addressError} selectedSupplier={selectedSupplier} lowPriceAlerts={lowPriceAlerts} setLowPriceAlerts={changeLowPriceAlerts} lowPriceAlertStatus={lowPriceAlertStatus} lowPriceAlertThresholdOre={lowPriceAlertThresholdOre} setLowPriceAlertThresholdOre={setLowPriceAlertThresholdOre} highPriceAlerts={highPriceAlerts} setHighPriceAlerts={changeHighPriceAlerts} highPriceAlertStatus={highPriceAlertStatus} highPriceAlertThresholdOre={highPriceAlertThresholdOre} setHighPriceAlertThresholdOre={setHighPriceAlertThresholdOre} consumptionBudgetAlerts={consumptionBudgetAlerts} setConsumptionBudgetAlerts={changeConsumptionBudgetAlerts} consumptionBudgetAlertStatus={consumptionBudgetAlertStatus} consumptionBudgetUnit={consumptionBudgetUnit} consumptionBudgetLimit={consumptionBudgetLimit} setConsumptionBudget={setConsumptionBudget} chargingWindowAlerts={chargingWindowAlerts} setChargingWindowAlerts={changeChargingWindowAlerts} chargingWindowAlertStatus={chargingWindowAlertStatus} chargingDurationHours={chargingDurationHours} chargingReadyByHour={chargingReadyByHour} setChargingWindow={setChargingWindow} monthlyEnergySummaryAlerts={monthlyEnergySummaryAlerts} setMonthlyEnergySummaryAlerts={changeMonthlyEnergySummaryAlerts} monthlyEnergySummaryHour={monthlyEnergySummaryHour} setMonthlyEnergySummary={setMonthlyEnergySummary} prices={prices} evModels={evModels} teslaConnected={tesla.connected} teslaVehicle={tesla.vehicle} teslaRefreshing={tesla.refreshing} teslaChargingCommandPending={tesla.chargingCommandPending} connectTesla={tesla.connect} refreshTesla={tesla.refresh} setTeslaCharging={tesla.setCharging} pairTeslaVirtualKey={tesla.pairVirtualKey} electricityUsage={electricityUsage} renderDeviceCard={renderDeviceCard} navigation={navigation} />;

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
          <View style={styles.header}><Text style={styles.brand}>STRØMBLIK</Text></View>

          {isSample ? (
            <View style={styles.notice}>
              <AppIcon name="wifi-off" size={16} color={colors.coral} />
              <Text style={styles.noticeText}>{loading ? 'Henter priser: eksempelpriser vises imens' : 'Priser kunne ikke hentes: eksempelpriser vises'}</Text>
            </View>
          ) : null}



          <View style={[styles.trendPanel, isMobile && styles.trendPanelMobile]}>
            <View style={styles.sectionHeadingRow}>
              <View>
                <Text style={styles.eyebrow}>TIMEPRISER · OP TIL 7 DAGE</Text>
                <Text style={styles.sectionTitle}>Prisens bevægelse</Text>
              </View>
              {loading ? <ActivityIndicator color={colors.primary} size="small" /> : <AppIcon name="trending-up" size={22} color={colors.coral} />}
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
            <Pressable onPress={() => setActiveTab("home")} style={styles.dashboardSummaryButton}><Text style={styles.dashboardSummaryButtonText}>Åbn Mit hjem</Text><AppIcon name="arrow-right" size={15} color={colors.white} /></Pressable>
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

