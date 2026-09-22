import { Feather } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { ReactNode } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TeslaDetailsPage } from "../components/TeslaDetailsPage";
import { ElectricityUsageCard } from "../components/ElectricityUsageCard";
import { useElectricityUsage } from "../hooks/useElectricityUsage";
import { FamilyPlanner } from "../components/FamilyPlanner";
import { AddressSuggestion } from "../addresses";
import { EvModel } from "../evData";
import { GridSupplier, PricePoint } from "../prices";
import { TeslaVehicle } from "../types/app";
import { ElectricityPriceCard } from "../components/ElectricityPriceCard";
import { EncryptedEnergyControls } from '../components/EncryptedEnergyControls';

type SecondaryTabScreenProps = {
  activeTab: "home" | "car" | "profile" | "dashboard";
  now: number;
  load: (refresh?: boolean) => Promise<void> | void;
  isMobile: boolean;
  styles: any;
  colors: any;
  profileName: string;
  setProfileName: (value: string) => void;
  profileEmail: string;
  setProfileEmail: (value: string) => void;
  saveProfile: () => Promise<void> | void;
  profileSaved: boolean;
  address: string;
  setAddress: (value: string) => void;
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
    setProfileEmail,
    saveProfile,
    profileSaved,
    address,
    setAddress,
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

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.container, isMobile && styles.containerMobile]}>
          <View style={styles.header}>
            <View>
              <Text style={styles.brand}>STROMBLIK</Text>
              <Text style={styles.date}>{new Intl.DateTimeFormat("da-DK", { timeZone: "Europe/Copenhagen", weekday: "long", day: "numeric", month: "short" }).format(new Date(now))}</Text>
            </View>
            <Pressable accessibilityLabel="Opdater priser" onPress={() => void load(true)} style={styles.iconButton}>
              <Feather name="refresh-cw" size={19} color={colors.ink} />
            </Pressable>
          </View>

          {activeTab === "home" ? (
            <>
              <Text style={styles.pageEyebrow}>MIT HJEM</Text>
              <Text style={styles.pageTitle}>Mit hjem</Text>
              <Text style={styles.pageIntro}>Se dit faktiske elforbrug og planlæg dine apparater.</Text>
              <ElectricityUsageCard {...electricityUsage} />
              <EncryptedEnergyControls onSync={async () => { await electricityUsage.agreements.refresh(); electricityUsage.disconnect(); await electricityUsage.loadBackground(); }} />
              <ElectricityPriceCard key={electricityUsage.auth.householdId} householdId={electricityUsage.auth.householdId} agreements={electricityUsage.agreements} />
              <FamilyPlanner points={prices} now={now} evModels={evModels} styles={styles} colors={colors} DeviceCard={renderDeviceCard} />
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
          ) : (
            <>
              <Text style={styles.pageEyebrow}>MIN PROFIL</Text>
              <Text style={styles.pageTitle}>Dine oplysninger</Text>

              <View style={styles.profileCard}>
                <View style={styles.profileAvatar}>
                  <Feather name="user" size={24} color={colors.primary} />
                </View>
                <TextInput
                  accessibilityLabel="Navn"
                  placeholder="Dit navn"
                  placeholderTextColor={colors.muted}
                  value={profileName}
                  onChangeText={setProfileName}
                  style={styles.profileInput}
                />
                <TextInput
                  accessibilityLabel="Email"
                  placeholder="din@email.dk"
                  placeholderTextColor={colors.muted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={profileEmail}
                  onChangeText={setProfileEmail}
                  style={styles.profileInput}
                />
                <Pressable onPress={() => void saveProfile()} style={styles.profileSaveButton}>
                  <Text style={styles.profileSaveText}>{profileSaved ? "Gemt" : "Gem profil"}</Text>
                </Pressable>
              </View>

              <Text style={styles.pageEyebrow}>MIN ADRESSE</Text>
              <Text style={styles.sectionTitle}>Find mit netselskab</Text>
              <Text style={styles.pageIntro}>Indtast din adresse, sa bruger appen automatisk det rigtige netselskab pa dashboardet.</Text>

              <View style={styles.profileAddressCard}>
                <View style={styles.addressSearchWrap}>
                  <View style={styles.addressIconWrap}>
                    <Feather name="map-pin" size={16} color={colors.primary} />
                  </View>
                  <TextInput
                    accessibilityLabel="Adresse"
                    placeholder="Sog efter adresse"
                    placeholderTextColor={colors.muted}
                    value={address}
                    onChangeText={setAddress}
                    style={styles.addressInput}
                  />
                </View>

                {addressLookupLoading ? (
                  <View style={styles.currentSupplierRow}>
                    <ActivityIndicator color={colors.primary} size="small" />
                    <Text style={styles.addressSuggestionText}>Finder netselskab...</Text>
                  </View>
                ) : null}

                {addressSuggestions.length ? (
                  <View style={styles.addressSuggestions}>
                    {addressSuggestions.map((suggestion) => (
                      <Pressable key={suggestion.id} onPress={() => void chooseAddress(suggestion)} style={styles.addressSuggestion}>
                        <Text style={styles.addressSuggestionText}>{suggestion.text}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}

                {addressError ? <Text style={styles.addressError}>{addressError}</Text> : null}
                <View style={styles.currentSupplierRow}>
                  <Text style={styles.currentSupplierLabel}>VALGT NETSELSKAB</Text>
                  <Text style={styles.currentSupplierName}>{selectedSupplier.name}</Text>
                </View>
              </View>
            </>
          )}

          {navigation}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
