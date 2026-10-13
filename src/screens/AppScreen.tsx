import { useFonts, Nunito_400Regular, Nunito_500Medium, Nunito_600SemiBold, Nunito_700Bold } from "@expo-google-fonts/nunito";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { DashboardScreen } from "./DashboardScreen";
import { colors } from "../styles/theme";
import { styles } from "../styles/appStyles";
import { HouseholdSessionProvider, useHouseholdSession } from '../hooks/useHouseholdSession';
import { LoginScreen } from './LoginScreen';
import { EnergyVaultGate } from '../components/EnergyVaultGate';
import { type ReactNode, useEffect, useRef } from 'react';
import { fetchPrices } from '../prices';
import { DashboardViewStateProvider } from '../hooks/useDashboardViewState';
import { configureLowPriceAlertPresentation } from '../services/low-price-alert';
import { AccountSetup } from './AccountSetup';
import { useState } from 'react';

// Temporary preview override: remove after the onboarding flow has been reviewed.
const FORCE_ONBOARDING_PREVIEW = true;

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
  const [finishedFor, setFinishedFor] = useState('');
  useEffect(() => {
    if (!auth.session) setFinishedFor('');
  }, [auth.session]);
  if (auth.initializing) return <View style={styles.loadingScreen}><ActivityIndicator color={colors.primary} /></View>;
  if (!auth.session || !auth.householdId) return <LoginScreen />;
  const accountKey = `${auth.session.user.id}:${auth.householdId}:${auth.session.user.last_sign_in_at ?? ''}`;
  const optedOut = auth.session.user.user_metadata?.onboarding_do_not_show_again === true;
  const needsSetup = auth.session.user.user_metadata?.onboarding_version !== 2;
  const showSetup = finishedFor !== accountKey && (needsSetup || (FORCE_ONBOARDING_PREVIEW && !optedOut));
  return <EnergyVaultGate>{showSetup ? <AccountSetup previewMode={FORCE_ONBOARDING_PREVIEW} onFinish={() => setFinishedFor(accountKey)} /> : <DashboardScreen key={auth.session.user.id} />}</EnergyVaultGate>;
}

export default function AppScreen() {
  useEffect(() => {
    // Warm public default-area prices while fonts, Auth and vault unlock run.
    void fetchPrices('DK1', 'n1_c').catch(() => {});
    void configureLowPriceAlertPresentation();
  }, []);
  const [fontsLoaded] = useFonts({ Nunito_400Regular, Nunito_500Medium, Nunito_600SemiBold, Nunito_700Bold });

  if (!fontsLoaded) {
    return <View style={styles.loadingScreen}><ActivityIndicator color={colors.primary} /></View>;
  }

  return <SafeAreaProvider><HouseholdSessionProvider><PersistedViewState><AuthenticatedApp /></PersistedViewState></HouseholdSessionProvider></SafeAreaProvider>;
}
