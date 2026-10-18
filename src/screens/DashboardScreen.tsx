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
import { useRef, useState } from 'react';
import { FamilyPlanner as ExtractedFamilyPlanner } from "../components/FamilyPlanner";
import { DevicePlanCard } from "../components/DevicePlanCard";
import { BottomTabs } from "../components/BottomTabs";
import { useWasteReminder } from '../hooks/useWasteReminder';
import { WasteCollectionCard } from "../components/WasteCollectionCard";
import { SecondaryTabScreen } from "./SecondaryTabsScreen";
import { useTeslaConnection } from "../hooks/useTeslaConnection";
import { useEnergyPrices } from "../hooks/useEnergyPrices";
import { useWasteCalendar } from "../hooks/useWasteCalendar";
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
import { useHouseholdSession } from '../hooks/useHouseholdSession';
import { useElectricityWidgets } from '../hooks/useElectricityWidgets';
import { PinnedElectricityWidgets, useElectricityWidgetData } from '../components/ElectricityWidgets';
import { useSmartThingsConnection } from '../hooks/useSmartThingsConnection';

function Dashboard() {
  const { width } = useWindowDimensions();
  const isMobile = width < 520;
  const { gridSuppliers, selectedSupplier, setSelectedSupplierId, now, prices, loading, refreshing, isSample, load } = useEnergyPrices();
  const { activeTab, setActiveTab, rememberScroll, openWidget } = useDashboardViewState();
  const [chartScrubbing, setChartScrubbing] = useState(false);
  const [widgetDragging, setWidgetDragging] = useState(false);
  const widgetDismiss = useRef<(() => void) | null>(null);
  const widgetScrollOffset = useRef(0), widgetMaxScroll = useRef(0), widgetViewportHeight = useRef(0), widgetContentHeight = useRef(0);
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
  const tesla = useTeslaConnection(activeTab);
  const smartThings = useSmartThingsConnection(activeTab === 'smartthings');
  const widgetAuth = useHouseholdSession();
  const widgetPreferences = useElectricityWidgets(widgetAuth.session?.user.id ?? '', widgetAuth.householdId);
  const showUsageWidgets = activeTab === 'dashboard' && widgetPreferences.pins.dashboard.some(id => ['latest', 'month', 'budget', 'usageChart'].includes(id));
  const electricityUsage = useElectricityUsage(activeTab === 'electricity' || activeTab === 'electricity-widgets' || showUsageWidgets, now);
  const widgetData = useElectricityWidgetData({ usage: electricityUsage, prices, isSample, supplier: selectedSupplier, now, unit: consumptionBudgetUnit, limit: consumptionBudgetLimit, enabled: activeTab === 'electricity' || activeTab === 'electricity-widgets' || showUsageWidgets });
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

  if (activeTab !== "dashboard") return <SecondaryTabScreen pricesAreSample={isSample} smartThings={smartThings} widgetPreferences={widgetPreferences} widgetData={widgetData} key={activeTab} activeTab={activeTab} wasteReminder={wasteReminder} wasteContent={<WasteCollectionCard events={wasteEvents} error={wasteError} wasteHealth={wasteHealth} onOpenProfile={() => setActiveTab('profile')} />} now={now} isMobile={isMobile} styles={styles} colors={colors} profileName={profileName} setProfileName={setProfileName} profileEmail={profileEmail} saveProfile={saveProfile} profileSaved={profileSaved} profileSaving={profileSaving} profileError={profileError} address={address} setAddress={setAddress} addressSelected={addressSelected} addressSuggestions={addressSuggestions} chooseAddress={chooseAddress} addressLookupLoading={addressLookupLoading} addressError={addressError} selectedSupplier={selectedSupplier} lowPriceAlerts={lowPriceAlerts} setLowPriceAlerts={changeLowPriceAlerts} lowPriceAlertStatus={lowPriceAlertStatus} lowPriceAlertThresholdOre={lowPriceAlertThresholdOre} setLowPriceAlertThresholdOre={setLowPriceAlertThresholdOre} highPriceAlerts={highPriceAlerts} setHighPriceAlerts={changeHighPriceAlerts} highPriceAlertStatus={highPriceAlertStatus} highPriceAlertThresholdOre={highPriceAlertThresholdOre} setHighPriceAlertThresholdOre={setHighPriceAlertThresholdOre} consumptionBudgetAlerts={consumptionBudgetAlerts} setConsumptionBudgetAlerts={changeConsumptionBudgetAlerts} consumptionBudgetAlertStatus={consumptionBudgetAlertStatus} consumptionBudgetUnit={consumptionBudgetUnit} consumptionBudgetLimit={consumptionBudgetLimit} setConsumptionBudget={setConsumptionBudget} chargingWindowAlerts={chargingWindowAlerts} setChargingWindowAlerts={changeChargingWindowAlerts} chargingWindowAlertStatus={chargingWindowAlertStatus} chargingDurationHours={chargingDurationHours} chargingReadyByHour={chargingReadyByHour} setChargingWindow={setChargingWindow} monthlyEnergySummaryAlerts={monthlyEnergySummaryAlerts} setMonthlyEnergySummaryAlerts={changeMonthlyEnergySummaryAlerts} monthlyEnergySummaryHour={monthlyEnergySummaryHour} setMonthlyEnergySummary={setMonthlyEnergySummary} prices={prices} evModels={evModels} teslaConnected={tesla.connected} teslaVehicle={tesla.vehicle} teslaRefreshing={tesla.refreshing} teslaChargingCommandPending={tesla.chargingCommandPending} connectTesla={tesla.connect} refreshTesla={tesla.refresh} setTeslaCharging={tesla.setCharging} pairTeslaVirtualKey={tesla.pairVirtualKey} electricityUsage={electricityUsage} renderDeviceCard={renderDeviceCard} navigation={navigation} />;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]} onTouchStart={() => widgetDismiss.current?.()}>
      <StatusBar style="dark" />
      <ScrollView
        ref={rememberedScroll.scrollRef}
        onLayout={event => { widgetViewportHeight.current = event.nativeEvent.layout.height; widgetMaxScroll.current = Math.max(0, widgetContentHeight.current - widgetViewportHeight.current); rememberedScroll.onLayout(event); }}
        onContentSizeChange={(width, height) => { widgetContentHeight.current = height; widgetMaxScroll.current = Math.max(0, height - widgetViewportHeight.current); rememberedScroll.onContentSizeChange(width, height); }}
        onScroll={event => { widgetScrollOffset.current = event.nativeEvent.contentOffset.y; if (!widgetDragging) rememberedScroll.onScroll(event); }}
        scrollEventThrottle={widgetDragging ? 16 : 100}
        style={styles.dashboardScroll}
        contentContainerStyle={[styles.scrollContent, styles.scrollContentGrow]}
        nestedScrollEnabled
        removeClippedSubviews={false}
        scrollEnabled={!chartScrubbing && !widgetDragging}
        refreshControl={<RefreshControl enabled={!widgetDragging} refreshing={refreshing} onRefresh={() => { if (!widgetDragging) void load(true); }} tintColor={colors.primary} />}
      >
        <View style={[styles.container, isMobile && styles.containerMobile]}>
          <View style={styles.header}><Text style={styles.brand}>STRØMBLIK</Text></View>

          {isSample ? (
            <View style={styles.notice}>
              <AppIcon name="wifi-off" size={16} color={colors.coral} />
              <Text style={styles.noticeText}>{loading ? 'Henter priser: eksempelpriser vises imens' : 'Priser kunne ikke hentes: eksempelpriser vises'}</Text>
            </View>
          ) : null}



          <PinnedElectricityWidgets location="dashboard" preferences={widgetPreferences} data={widgetData} onManage={() => setActiveTab('electricity-widgets')} onOpen={openWidget}
            dismissRef={widgetDismiss}
            onScrubChange={setChartScrubbing}
            dragScroll={{ ref: rememberedScroll.scrollRef, offset: widgetScrollOffset, maxOffset: widgetMaxScroll }}
            onDragChange={dragging => { setWidgetDragging(dragging); if (!dragging) rememberScroll('dashboard', widgetScrollOffset.current); }} />
          {!widgetPreferences.pins.dashboard.length ? <Pressable accessibilityRole="button" onPress={() => setActiveTab('electricity-widgets')} style={styles.dashboardSummaryButton}><Text style={styles.dashboardSummaryButtonText}>Vælg widgets til dit overblik</Text><AppIcon name="plus" size={18} color={colors.white} /></Pressable> : null}


        </View>
      </ScrollView>
      {navigation}
    </SafeAreaView>
  );
}

export function DashboardScreen() {
  return <Dashboard />;
}

