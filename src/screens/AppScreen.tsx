import { useFonts as useDMSans, DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from "@expo-google-fonts/dm-sans";
import { Fraunces_600SemiBold, useFonts as useFraunces } from "@expo-google-fonts/fraunces";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { DashboardScreen } from "./DashboardScreen";
import { colors } from "../styles/theme";
import { styles } from "../styles/appStyles";
import { HouseholdSessionProvider, useHouseholdSession } from '../hooks/useHouseholdSession';
import { LoginScreen } from './LoginScreen';
import { EnergyVaultGate } from '../components/EnergyVaultGate';

function AuthenticatedApp() {
  const auth = useHouseholdSession();
  if (auth.initializing) return <View style={styles.loadingScreen}><ActivityIndicator color={colors.primary} /></View>;
  if (!auth.session || !auth.householdId) return <LoginScreen />;
  return <EnergyVaultGate><DashboardScreen key={auth.session.user.id} /></EnergyVaultGate>;
}

export default function AppScreen() {
  const [dmLoaded] = useDMSans({ DMSans_400Regular, DMSans_500Medium, DMSans_700Bold });
  const [frauncesLoaded] = useFraunces({ Fraunces_600SemiBold });

  if (!dmLoaded || !frauncesLoaded) {
    return <View style={styles.loadingScreen}><ActivityIndicator color={colors.primary} /></View>;
  }

  return <SafeAreaProvider><HouseholdSessionProvider><AuthenticatedApp /></HouseholdSessionProvider></SafeAreaProvider>;
}
