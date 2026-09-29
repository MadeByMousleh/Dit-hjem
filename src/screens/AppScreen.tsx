import { useFonts as useDMSans, DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from "@expo-google-fonts/dm-sans";
import { Fraunces_600SemiBold, useFonts as useFraunces } from "@expo-google-fonts/fraunces";
import { Feather, Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { DashboardScreen } from "./DashboardScreen";
import { colors } from "../styles/theme";
import { styles } from "../styles/appStyles";
import { HouseholdSessionProvider, useHouseholdSession } from '../hooks/useHouseholdSession';
import { LoginScreen } from './LoginScreen';
import { EnergyVaultGate } from '../components/EnergyVaultGate';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { fetchPrices } from '../prices';
import { DashboardViewStateProvider } from '../hooks/useDashboardViewState';
import { configureLowPriceAlertPresentation } from '../services/low-price-alert';

function PersistedViewState({ children }: { children: ReactNode }) {
  const auth = useHouseholdSession();
  const lastAccount = useRef('anonymous');
  // Keep navigation through a temporary sign-out, but never share it with a
  // different user or household on the same device.
  if (auth.session?.user.id && auth.householdId) lastAccount.current = `${auth.session.user.id}:${auth.householdId}`;
  return <DashboardViewStateProvider key={lastAccount.current}>{children}</DashboardViewStateProvider>;
}

function AuthenticatedApp() {
  const auth = useHouseholdSession();
  if (auth.initializing) return <View style={styles.loadingScreen}><ActivityIndicator color={colors.primary} /></View>;
  if (!auth.session || !auth.householdId) return <LoginScreen />;
  return <EnergyVaultGate><DashboardScreen key={auth.session.user.id} /></EnergyVaultGate>;
}

export default function AppScreen() {
  const [iconsLoaded, setIconsLoaded] = useState(false);
  useEffect(() => {
    // Warm public default-area prices while fonts, Auth and vault unlock run.
    void fetchPrices('DK1', 'n1_c').catch(() => {});
    void configureLowPriceAlertPresentation();
  }, []);
  useEffect(() => {
    let active = true;
    // BottomTabs uses Ionicons while the rest of the shell uses Feather. Loading
    // both before Auth renders avoids a new account reaching the tabs before its
    // icon font has arrived.
    void Promise.all([Ionicons.loadFont(), Feather.loadFont()])
      .catch(() => { /* The icon components retain their own fallback behavior. */ })
      .finally(() => { if (active) setIconsLoaded(true); });
    return () => { active = false; };
  }, []);
  const [dmLoaded] = useDMSans({ DMSans_400Regular, DMSans_500Medium, DMSans_700Bold });
  const [frauncesLoaded] = useFraunces({ Fraunces_600SemiBold });

  if (!dmLoaded || !frauncesLoaded || !iconsLoaded) {
    return <View style={styles.loadingScreen}><ActivityIndicator color={colors.primary} /></View>;
  }

  return <SafeAreaProvider><HouseholdSessionProvider><PersistedViewState><AuthenticatedApp /></PersistedViewState></HouseholdSessionProvider></SafeAreaProvider>;
}
