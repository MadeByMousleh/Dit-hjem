import { Feather } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
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

type SecondaryTabScreenProps = {
  activeTab: "home" | "utilities" | "car" | "profile";
  now: number;
  load: (refresh?: boolean) => Promise<void> | void;
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
  prices: PricePoint[];
  evModels: EvModel[];
  teslaConnected: boolean;
  teslaVehicle: TeslaVehicle | null;
  teslaRefreshing: boolean;
  connectTesla: () => void;
  refreshTesla: () => Promise<void> | void;
  electricityUsage: ReturnType<typeof useElectricityUsage>;
  renderDeviceCard: (props: any) => ReactNode;
  navigation: ReactNode;
};

export function SecondaryTabScreen(props: SecondaryTabScreenProps) {
  const rememberedScroll = useRememberedScroll(props.activeTab);
  const {
    activeTab,
    now,
    load,
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
    prices,
    evModels,
    teslaConnected,
    teslaVehicle,
    teslaRefreshing,
    connectTesla,
    refreshTesla,
    electricityUsage,
    renderDeviceCard,
    navigation,
  } = props;

  if (activeTab === 'profile') return <ProfilePage profileName={profileName} setProfileName={setProfileName} profileEmail={profileEmail}
    profileSaved={profileSaved} profileSaving={profileSaving} profileError={profileError} saveProfile={saveProfile}
    address={address} setAddress={setAddress} addressSelected={addressSelected} addressSuggestions={addressSuggestions}
    chooseAddress={chooseAddress} addressLookupLoading={addressLookupLoading} addressError={addressError}
    selectedSupplier={selectedSupplier} navigation={navigation} />;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar style="dark" />
      <ScrollView ref={rememberedScroll.scrollRef} onLayout={rememberedScroll.onLayout} onContentSizeChange={rememberedScroll.onContentSizeChange} onScroll={rememberedScroll.onScroll} scrollEventThrottle={100} style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.container, isMobile && styles.containerMobile]}>
          <View style={styles.header}>
            <View>
              <Text style={styles.brand}>STROMBLIK</Text>
              <Text style={styles.date}>{new Intl.DateTimeFormat("da-DK", { timeZone: "Europe/Copenhagen", weekday: "long", day: "numeric", month: "short" }).format(new Date(now))}</Text>
            </View>
            {activeTab !== "utilities" ? <Pressable accessibilityLabel="Opdater priser" onPress={() => void load(true)} style={styles.iconButton}>
              <Feather name="refresh-cw" size={19} color={colors.ink} />
            </Pressable> : null}
          </View>

          {activeTab === "home" ? (
            <>
              <Text style={styles.pageEyebrow}>MIT HJEM</Text>
              <Text style={styles.pageTitle}>Mit hjem</Text>
              <Text style={styles.pageIntro}>Se dit faktiske elforbrug og planlæg dine apparater.</Text>
              {electricityUsage.connected === true ? <MonthlyUsageCard data={electricityUsage.monthlyUsage} currentMonthDays={electricityUsage.currentMonthDays} previousMonthDays={electricityUsage.previousMonthDays} loading={electricityUsage.monthlyLoading} error={electricityUsage.monthlyError} agreements={electricityUsage.agreements.records} gridSupplier={selectedSupplier} /> : null}
              <ElectricityUsageCard {...electricityUsage} prices={prices} gridSupplierName={selectedSupplier.name} gridSupplier={selectedSupplier} />
              <ElectricityDetailsCard meters={electricityUsage.meters} />
              <ElectricityPriceCard key={electricityUsage.auth.householdId} householdId={electricityUsage.auth.householdId} agreements={electricityUsage.agreements} />
              <FamilyPlanner points={prices} now={now} evModels={evModels} styles={styles} colors={colors} DeviceCard={renderDeviceCard} />
            </>
          ) : activeTab === "utilities" ? (
            <>
              <Text style={styles.pageEyebrow}>VAND OG VARME</Text>
              <Text style={styles.pageTitle}>Vand og varme</Text>
              <HeatingPage key={`heat-${electricityUsage.auth.householdId}`} />
            </>
          ) : activeTab === "car" ? (
            <>
              <Text style={styles.pageEyebrow}>MIN BIL</Text>
              <Text style={styles.pageTitle}>Tesla</Text>
              <Text style={styles.pageIntro}>Batteri, opladning, klima og bilstatus samlet ét sted.</Text>
              <TeslaDetailsPage
                vehicle={teslaVehicle}
                refreshing={teslaRefreshing}
                onRefresh={() => void refreshTesla()}
                connected={teslaConnected}
                onConnect={connectTesla}
                points={prices}
                now={now}
                evModels={evModels}
              />
            </>
          ) : null}

        </View>
      </ScrollView>
      {navigation}
    </SafeAreaView>
  );
}
