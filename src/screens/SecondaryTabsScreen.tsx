import { StatusBar } from "expo-status-bar";
import { Feather } from '@expo/vector-icons';
import { HomeCategories } from '../components/HomeCategories';
import { useDashboardViewState, type DashboardTab } from '../hooks/useDashboardViewState';
import { ReactNode, useEffect } from "react";
import { BackHandler, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TeslaDetailsPage } from "../components/TeslaDetailsPage";
import { ElectricityUsageCard } from "../components/ElectricityUsageCard";
import { ElectricityDetailsCard } from '../components/ElectricityDetailsCard';
import { useElectricityUsage } from "../hooks/useElectricityUsage";
import { FamilyPlanner } from "../components/FamilyPlanner";
import { AddressSuggestion } from "../addresses";
import { EvModel } from "../evData";
import { GridSupplier, PricePoint } from "../prices";
import { TeslaVehicle } from "../types/app";
import { ElectricityPriceCard } from "../components/ElectricityPriceCard";
import { MonthlyUsageCard } from "../components/MonthlyUsageCard";
import { HeatingPage } from '../components/HeatingPage';
import { ProfilePage } from '../components/ProfilePage';
import { useRememberedScroll } from '../hooks/useRememberedScroll';
import type { LowPriceAlertStatus } from '../hooks/useLowPriceAlert';
import type { HighPriceAlertStatus } from '../hooks/useHighPriceAlert';
import type { ConsumptionBudgetAlertStatus } from '../hooks/useConsumptionBudgetAlert';
import type { ChargingWindowAlertStatus } from '../hooks/useChargingWindowAlert';
import type { ConsumptionBudgetUnit } from '../services/low-price-alert';

type SecondaryTabScreenProps = {
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
  const { setActiveTab } = useDashboardViewState();
  useEffect(() => {
    if (props.activeTab === 'home' || props.activeTab === 'profile') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setActiveTab('home');
      return true;
    });
    return () => subscription.remove();
  }, [props.activeTab, setActiveTab]);
  const rememberedScroll = useRememberedScroll(props.activeTab);
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

  if (activeTab === 'profile') return <ProfilePage profileName={profileName} setProfileName={setProfileName} profileEmail={profileEmail}
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

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar style="dark" />
      <ScrollView ref={rememberedScroll.scrollRef} onLayout={rememberedScroll.onLayout} onContentSizeChange={rememberedScroll.onContentSizeChange} onScroll={rememberedScroll.onScroll} scrollEventThrottle={100} style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.container, isMobile && styles.containerMobile]}>
          <View style={styles.header}><Text style={styles.brand}>STRØMBLIK</Text></View>

          {activeTab !== 'home' ? <Pressable accessibilityRole="button" accessibilityLabel="Tilbage til Mit hjem" onPress={() => setActiveTab('home')} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 14 }}><Feather name="arrow-left" size={18} color={colors.primary} /><Text style={{ fontFamily: 'DMSans_700Bold', color: colors.primary }}>Mit hjem</Text></Pressable> : null}
          {activeTab === 'home' ? <HomeCategories onSelect={setActiveTab} /> : null}
          {activeTab === 'electricity' ? <Text style={{ fontFamily: 'Fraunces_600SemiBold', fontSize: 30, color: colors.ink, marginBottom: 16 }}>El</Text> : null}
          {activeTab === "electricity" ? (
            <>
              {electricityUsage.connected === true ? <MonthlyUsageCard data={electricityUsage.monthlyUsage} currentMonthDays={electricityUsage.currentMonthDays} previousMonthDays={electricityUsage.previousMonthDays} loading={electricityUsage.monthlyLoading} error={electricityUsage.monthlyError} agreements={electricityUsage.agreements.records} gridSupplier={selectedSupplier} /> : null}
              <ElectricityUsageCard {...electricityUsage} prices={prices} gridSupplierName={selectedSupplier.name} gridSupplier={selectedSupplier} />
              <ElectricityDetailsCard meters={electricityUsage.meters} />
              <ElectricityPriceCard key={electricityUsage.auth.householdId} householdId={electricityUsage.auth.householdId} agreements={electricityUsage.agreements} />
            </>
          ) : activeTab === "utilities" ? (
            <>
              <HeatingPage key={`heat-${electricityUsage.auth.householdId}`} />
            </>
          ) : activeTab === "car" ? (
            <>
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
          ) : activeTab === 'appliances' ? <FamilyPlanner points={prices} now={now} evModels={evModels} styles={styles} colors={colors} DeviceCard={renderDeviceCard} /> : null}

        </View>
      </ScrollView>
      {navigation}
    </SafeAreaView>
  );
}
