import { Feather } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { ReactNode, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TeslaConnectionCard } from "../components/TeslaConnectionCard";
import { TeslaDetailsPage } from "../components/TeslaDetailsPage";
import { FamilyPlanner } from "../components/FamilyPlanner";
import { AddressSuggestion } from "../addresses";
import { EvModel } from "../evData";
import { GridSupplier, PricePoint } from "../prices";
import { TeslaVehicle } from "../types/app";

type SecondaryTabScreenProps = {
  activeTab: "home" | "profile" | "dashboard";
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
  teslaShowOnDashboard: boolean;
  connectTesla: () => void;
  refreshTesla: () => Promise<void> | void;
  saveTeslaVisibility: (value: boolean) => void;
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
    teslaShowOnDashboard,
    connectTesla,
    refreshTesla,
    saveTeslaVisibility,
    renderDeviceCard,
    navigation,
  } = props;

  const [showTeslaPage, setShowTeslaPage] = useState(false);

  useEffect(() => {
    if (activeTab !== "home") setShowTeslaPage(false);
  }, [activeTab]);

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
              {!showTeslaPage ? (
                <>
                  <Text style={styles.pageTitle}>Apparater og elbil</Text>
                  <Text style={styles.pageIntro}>Gem dine apparater et sted. Finjuster program, temperatur, lader og batteriniveau, nar du planlaegger.</Text>
                  <TeslaConnectionCard
                    connected={teslaConnected}
                    vehicle={teslaVehicle}
                    points={prices}
                    now={now}
                    evModels={evModels}
                    refreshing={teslaRefreshing}
                    showOnDashboard={teslaShowOnDashboard}
                    onConnect={connectTesla}
                    onRefresh={() => void refreshTesla()}
                    onToggleDashboard={() => saveTeslaVisibility(!teslaShowOnDashboard)}
                    onOpenDetails={() => setShowTeslaPage(true)}
                  />
                  <FamilyPlanner points={prices} now={now} evModels={evModels} styles={styles} colors={colors} DeviceCard={renderDeviceCard} />
                </>
              ) : (
                <>
                  <View style={styles.sectionHeadingRow}>
                    <View>
                      <Text style={styles.eyebrow}>TESLA</Text>
                      <Text style={styles.sectionTitle}>Bil og batteri</Text>
                    </View>
                    <Pressable onPress={() => setShowTeslaPage(false)} style={styles.iconButton}>
                      <Feather name="arrow-left" size={18} color={colors.ink} />
                    </Pressable>
                  </View>
                  <Text style={styles.pageIntro}>Overblik over model, farve, batteri, ladeforhold og bilens essentielle status.</Text>
                  <TeslaDetailsPage vehicle={teslaVehicle} refreshing={teslaRefreshing} onRefresh={() => void refreshTesla()} />
                  <TeslaConnectionCard
                    connected={teslaConnected}
                    vehicle={teslaVehicle}
                    points={prices}
                    now={now}
                    evModels={evModels}
                    refreshing={teslaRefreshing}
                    showOnDashboard={teslaShowOnDashboard}
                    onConnect={connectTesla}
                    onRefresh={() => void refreshTesla()}
                    onToggleDashboard={() => saveTeslaVisibility(!teslaShowOnDashboard)}
                  />
                </>
              )}
            </>
          ) : (
            <>
              <Text style={styles.pageEyebrow}>MIN PROFIL</Text>
              <Text style={styles.pageTitle}>Dine oplysninger</Text>

              <View style={styles.profileCard}>
                <View style={styles.profileAvatar}>
                  <Feather name="user" size={24} color={colors.green} />
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
                    <Feather name="map-pin" size={16} color={colors.green} />
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
                    <ActivityIndicator color={colors.green} size="small" />
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
