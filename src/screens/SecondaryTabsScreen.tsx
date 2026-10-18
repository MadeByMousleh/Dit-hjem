import { StatusBar } from "expo-status-bar";
import { AppIcon } from '../components/AppIcon';
import { HomeCategories } from '../components/HomeCategories';
import { useDashboardViewState, type DashboardTab } from '../hooks/useDashboardViewState';
import { ReactNode, useEffect, useState } from "react";
import { BackHandler, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TeslaDetailsPage } from "../components/TeslaDetailsPage";
import { ChargerEntry, ChargerPage } from '../components/ChargerPage';
import { ElectricityUsageCard } from "../components/ElectricityUsageCard";
import { ElectricityDetailsCard } from '../components/ElectricityDetailsCard';
import { useElectricityUsage } from "../hooks/useElectricityUsage";
import { FamilyPlanner } from "../components/FamilyPlanner";
import { AddressSuggestion } from "../addresses";
import { EvModel } from "../evData";
import { GridSupplier, PricePoint } from "../prices";
import { TeslaVehicle } from "../types/app";
import { ElectricityPriceCard } from "../components/ElectricityPriceCard";
import { PriceChart } from '../components/PriceChart';
import { MonthlyUsageCard } from "../components/MonthlyUsageCard";
import { HeatingPage } from '../components/HeatingPage';
import { ProfilePage } from '../components/ProfilePage';
import { useRememberedScroll } from '../hooks/useRememberedScroll';
import type { LowPriceAlertStatus } from '../hooks/useLowPriceAlert';
import type { HighPriceAlertStatus } from '../hooks/useHighPriceAlert';
import type { ConsumptionBudgetAlertStatus } from '../hooks/useConsumptionBudgetAlert';
import type { ChargingWindowAlertStatus } from '../hooks/useChargingWindowAlert';
import type { ConsumptionBudgetUnit } from '../services/low-price-alert';
import type { useElectricityWidgets } from '../hooks/useElectricityWidgets';
import { WidgetsEntry, ElectricityWidgetsPage, PinnedElectricityWidgets, type ElectricityWidgetData } from '../components/ElectricityWidgets';
import { SmartThingsEntry, SmartThingsPage } from '../components/SmartThingsPage';
import type { useSmartThingsConnection } from '../hooks/useSmartThingsConnection';

type SecondaryTabScreenProps = {
  smartThings: ReturnType<typeof useSmartThingsConnection>;
  widgetPreferences: ReturnType<typeof useElectricityWidgets>;
  widgetData: ElectricityWidgetData;
  wasteContent: ReactNode;
  wasteReminder: ReturnType<typeof import('../hooks/useWasteReminder').useWasteReminder>;
  activeTab: Exclude<DashboardTab, 'dashboard'>;
  now: number;
  isMobile: boolean;
  styles: any;
  colors: any;
  profileName: string;
  setProfileName: (value: string) => void;
  profileEmail: string;
  saveProfile: () => Promise<void> | void;
  profileSaved: boolean;
  profileSaving: boolean;
  profileError: string;
  address: string;
  setAddress: (value: string) => void;
  addressSelected: boolean;
  addressSuggestions: AddressSuggestion[];
  chooseAddress: (suggestion: AddressSuggestion) => Promise<void> | void;
  addressLookupLoading: boolean;
  addressError: string;
  selectedSupplier: GridSupplier;
  lowPriceAlerts: boolean;
  setLowPriceAlerts: (enabled: boolean) => Promise<void> | void;
  lowPriceAlertStatus: LowPriceAlertStatus;
  lowPriceAlertThresholdOre: number;
  setLowPriceAlertThresholdOre: (value: number) => Promise<void> | void;
  highPriceAlerts: boolean;
  setHighPriceAlerts: (enabled: boolean) => Promise<void> | void;
  highPriceAlertStatus: HighPriceAlertStatus;
  highPriceAlertThresholdOre: number;
  setHighPriceAlertThresholdOre: (value: number) => Promise<void> | void;
  consumptionBudgetAlerts: boolean;
  setConsumptionBudgetAlerts: (enabled: boolean) => Promise<void> | void;
  consumptionBudgetAlertStatus: ConsumptionBudgetAlertStatus;
  consumptionBudgetUnit: ConsumptionBudgetUnit;
  consumptionBudgetLimit: number;
  setConsumptionBudget: (unit: ConsumptionBudgetUnit, limit: number) => Promise<void> | void;
  chargingWindowAlerts: boolean;
  setChargingWindowAlerts: (enabled: boolean) => Promise<void> | void;
  chargingWindowAlertStatus: ChargingWindowAlertStatus;
  chargingDurationHours: number;
  chargingReadyByHour: number;
  setChargingWindow: (durationHours: number, readyByHour: number) => Promise<void> | void;
  monthlyEnergySummaryAlerts: boolean;
  setMonthlyEnergySummaryAlerts: (enabled: boolean) => Promise<void> | void;
  monthlyEnergySummaryHour: number;
  setMonthlyEnergySummary: (enabled: boolean, hour: number) => Promise<void> | void;
  prices: PricePoint[];
  pricesAreSample?: boolean;
  evModels: EvModel[];
  teslaConnected: boolean;
  teslaVehicle: TeslaVehicle | null;
  teslaRefreshing: boolean;
  teslaChargingCommandPending: boolean;
  connectTesla: () => void;
  refreshTesla: () => Promise<void> | void;
  setTeslaCharging: (action: 'start' | 'stop') => Promise<void> | void;
  pairTeslaVirtualKey: () => Promise<void> | void;
  electricityUsage: ReturnType<typeof useElectricityUsage>;
  renderDeviceCard: (props: any) => ReactNode;
  navigation: ReactNode;
};

export function SecondaryTabScreen(props: SecondaryTabScreenProps) {
  const { setActiveTab, openWidget, widgetDestination } = useDashboardViewState();
  const [priceScrubbing, setPriceScrubbing] = useState(false);
  useEffect(() => {
    if (props.activeTab === 'home' || props.activeTab === 'profile') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setActiveTab(props.activeTab === 'smartthings' ? 'appliances' : props.activeTab === 'charger' ? 'car' : props.activeTab === 'electricity-widgets' ? 'electricity' : 'home');
      return true;
    });
    return () => subscription.remove();
  }, [props.activeTab, setActiveTab]);
  const rememberedScroll = useRememberedScroll(props.activeTab);
  useEffect(() => {
    if (widgetDestination) rememberedScroll.scrollRef?.current?.scrollTo({ y: 0, animated: false });
  }, [widgetDestination]);
  const {
    activeTab,
    now,
    isMobile,
    styles,
    colors,
    profileName,
    setProfileName,
    profileEmail,
    saveProfile,
    profileSaved,
    profileSaving,
    profileError,
    address,
    setAddress,
    addressSelected,
    addressSuggestions,
    chooseAddress,
    addressLookupLoading,
    addressError,
    selectedSupplier,
    lowPriceAlerts,
    setLowPriceAlerts,
    lowPriceAlertStatus,
    lowPriceAlertThresholdOre,
    setLowPriceAlertThresholdOre,
    highPriceAlerts,
    setHighPriceAlerts,
    highPriceAlertStatus,
    highPriceAlertThresholdOre,
    setHighPriceAlertThresholdOre,
    consumptionBudgetAlerts,
    setConsumptionBudgetAlerts,
    consumptionBudgetAlertStatus,
    consumptionBudgetUnit,
    consumptionBudgetLimit,
    setConsumptionBudget,
    chargingWindowAlerts,
    setChargingWindowAlerts,
    chargingWindowAlertStatus,
    chargingDurationHours,
    chargingReadyByHour,
    setChargingWindow,
    monthlyEnergySummaryAlerts,
    setMonthlyEnergySummaryAlerts,
    monthlyEnergySummaryHour,
    setMonthlyEnergySummary,
    prices,
    evModels,
    teslaConnected,
    teslaVehicle,
    teslaRefreshing,
    teslaChargingCommandPending,
    connectTesla,
    refreshTesla,
    setTeslaCharging,
    pairTeslaVirtualKey,
    electricityUsage,
    renderDeviceCard,
    navigation,
  } = props;

  if (activeTab === 'profile') return <ProfilePage openBudgetOnMount={widgetDestination?.section === 'budget'} wasteReminder={props.wasteReminder} profileName={profileName} setProfileName={setProfileName} profileEmail={profileEmail}
    profileSaved={profileSaved} profileSaving={profileSaving} profileError={profileError} saveProfile={saveProfile}
    address={address} setAddress={setAddress} addressSelected={addressSelected} addressSuggestions={addressSuggestions}
    chooseAddress={chooseAddress} addressLookupLoading={addressLookupLoading} addressError={addressError}
    selectedSupplier={selectedSupplier} lowPriceAlerts={lowPriceAlerts} setLowPriceAlerts={setLowPriceAlerts}
    lowPriceAlertStatus={lowPriceAlertStatus} lowPriceAlertThresholdOre={lowPriceAlertThresholdOre} setLowPriceAlertThresholdOre={setLowPriceAlertThresholdOre}
    highPriceAlerts={highPriceAlerts} setHighPriceAlerts={setHighPriceAlerts} highPriceAlertStatus={highPriceAlertStatus}
    highPriceAlertThresholdOre={highPriceAlertThresholdOre} setHighPriceAlertThresholdOre={setHighPriceAlertThresholdOre}
    consumptionBudgetAlerts={consumptionBudgetAlerts} setConsumptionBudgetAlerts={setConsumptionBudgetAlerts} consumptionBudgetAlertStatus={consumptionBudgetAlertStatus}
    consumptionBudgetUnit={consumptionBudgetUnit} consumptionBudgetLimit={consumptionBudgetLimit} setConsumptionBudget={setConsumptionBudget}
    chargingWindowAlerts={chargingWindowAlerts} setChargingWindowAlerts={setChargingWindowAlerts} chargingWindowAlertStatus={chargingWindowAlertStatus}
    chargingDurationHours={chargingDurationHours} chargingReadyByHour={chargingReadyByHour} setChargingWindow={setChargingWindow}
    monthlyEnergySummaryAlerts={monthlyEnergySummaryAlerts} setMonthlyEnergySummaryAlerts={setMonthlyEnergySummaryAlerts} monthlyEnergySummaryHour={monthlyEnergySummaryHour} setMonthlyEnergySummary={setMonthlyEnergySummary} navigation={navigation} />;

  const usageCard = <ElectricityUsageCard {...electricityUsage} prices={prices} gridSupplierName={selectedSupplier?.name} gridSupplier={selectedSupplier} />;
  const priceCard = <View style={{ backgroundColor: colors.white, borderRadius: 24, padding: 24, marginBottom: 20 }}><Text style={{ fontFamily: 'Nunito_700Bold', fontSize: 20, color: colors.ink, marginBottom: 16 }}>Elpriser</Text>{props.pricesAreSample ? <Text style={{ color: colors.muted }}>Aktuelle priser er utilgængelige. Prøv igen senere.</Text> : <PriceChart points={prices} now={now} onScrubChange={setPriceScrubbing} />}</View>;
  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar style="dark" />
      <ScrollView ref={rememberedScroll.scrollRef} scrollEnabled={!priceScrubbing} onLayout={rememberedScroll.onLayout} onContentSizeChange={rememberedScroll.onContentSizeChange} onScroll={rememberedScroll.onScroll} scrollEventThrottle={100} style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.container, isMobile && styles.containerMobile]}>
          <View style={styles.header}><Text style={styles.brand}>STRØMBLIK</Text></View>

          {activeTab !== 'home' ? <Pressable accessibilityRole="button" accessibilityLabel={activeTab === 'smartthings' ? 'Tilbage til Apparater' : activeTab === 'charger' ? 'Tilbage til Bil' : activeTab === 'electricity-widgets' ? 'Tilbage til El' : 'Tilbage til Mit hjem'} onPress={() => setActiveTab(activeTab === 'smartthings' ? 'appliances' : activeTab === 'charger' ? 'car' : activeTab === 'electricity-widgets' ? 'electricity' : 'home')} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14 }}><AppIcon name="arrow-left" size={18} color={colors.primary} /><Text style={{ fontFamily: 'Nunito_700Bold', color: colors.primary }}>{activeTab === 'smartthings' ? 'Apparater' : activeTab === 'charger' ? 'Bil' : activeTab === 'electricity-widgets' ? 'El' : 'Mit hjem'}</Text></Pressable> : null}
          {activeTab === 'charger' ? <ChargerPage /> : null}
          {activeTab === 'electricity-widgets' ? <ElectricityWidgetsPage preferences={props.widgetPreferences} data={props.widgetData} /> : null}
          {activeTab === 'smartthings' ? <SmartThingsPage connection={props.smartThings} /> : null}
          {activeTab === 'waste' ? <><Text style={{ fontFamily: 'Nunito_600SemiBold', fontSize: 30, color: colors.ink, marginBottom: 8 }}>Affald</Text><Text style={{ fontFamily: 'Nunito_400Regular', color: colors.muted, marginBottom: 24 }}>Din kalender for de kommende tømninger.</Text>{props.wasteContent}</> : null}
          {activeTab === 'home' ? <HomeCategories onSelect={setActiveTab} /> : null}
          {activeTab === 'electricity' ? <Text style={{ fontFamily: 'Nunito_600SemiBold', fontSize: 30, color: colors.ink, marginBottom: 16 }}>El</Text> : null}
          {activeTab === "electricity" ? (
            <>
              {widgetDestination?.section === 'usage' ? usageCard : widgetDestination?.section === 'prices' ? priceCard : null}
              <WidgetsEntry onOpen={() => setActiveTab('electricity-widgets')} />
              <PinnedElectricityWidgets location="electricity" preferences={props.widgetPreferences} data={props.widgetData} onManage={() => setActiveTab('electricity-widgets')} onOpen={openWidget} />
              {electricityUsage.connected === true ? <MonthlyUsageCard data={electricityUsage.monthlyUsage} currentMonthDays={electricityUsage.currentMonthDays} previousMonthDays={electricityUsage.previousMonthDays} loading={electricityUsage.monthlyLoading} error={electricityUsage.monthlyError} agreements={electricityUsage.agreements.records} gridSupplier={selectedSupplier} /> : null}
              {widgetDestination?.section !== 'usage' ? usageCard : null}
              {widgetDestination?.section !== 'prices' ? priceCard : null}
              <ElectricityDetailsCard meters={electricityUsage.meters} />
              <ElectricityPriceCard key={electricityUsage.auth.householdId} householdId={electricityUsage.auth.householdId} agreements={electricityUsage.agreements} />
            </>
          ) : activeTab === "utilities" ? (
            <>
              <HeatingPage key={`heat-${electricityUsage.auth.householdId}`} />
            </>
          ) : activeTab === "car" ? (
            <>
              <ChargerEntry onOpen={() => setActiveTab('charger')} />
              <TeslaDetailsPage
                vehicle={teslaVehicle}
                refreshing={teslaRefreshing}
                chargingCommandPending={teslaChargingCommandPending}
                onRefresh={() => void refreshTesla()}
                connected={teslaConnected}
                onConnect={connectTesla}
                onSetCharging={setTeslaCharging}
                onPairVirtualKey={pairTeslaVirtualKey}
                points={prices}
                now={now}
                evModels={evModels}
              />
            </>
          ) : activeTab === 'appliances' ? <><SmartThingsEntry onOpen={() => setActiveTab('smartthings')} /><FamilyPlanner points={prices} now={now} evModels={evModels} styles={styles} colors={colors} DeviceCard={renderDeviceCard} /></> : null}

        </View>
      </ScrollView>
      {navigation}
    </SafeAreaView>
  );
}
