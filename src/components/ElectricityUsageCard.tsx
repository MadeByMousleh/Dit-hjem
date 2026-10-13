import { AppIcon } from './AppIcon';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useElectricityUsage } from "../hooks/useElectricityUsage";
import type { GridSupplier, PricePoint } from '../prices';
import { colors } from "../styles/theme";

import { ElectricityUsageChart } from "./ElectricityUsageChart";
import { EncryptedEnergyControls } from './EncryptedEnergyControls';

type Props = ReturnType<typeof useElectricityUsage> & { prices: PricePoint[]; gridSupplierName: string; gridSupplier: GridSupplier };

export function ElectricityUsageCard(props: Props) {
  const { auth, connected } = props;
  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <View style={styles.icon}><AppIcon name="zap" size={20} color={colors.primary} /></View>
        <View style={styles.headingCopy}>
          <Text style={styles.title}>Dit faktiske elforbrug</Text>
          <Text style={styles.subtitle}>Data fra Eloverblik</Text>
        </View>
      </View>
      {(connected === null && !props.connectionError) || auth.authLoading ? <ActivityIndicator style={{ marginTop: 20 }} color={colors.primary} /> : null}
      {props.connectionError ? <View><Text accessibilityRole="alert" style={styles.error}>{props.connectionError}</Text><Pressable accessibilityRole="button" onPress={() => void props.connectionReady()} style={styles.secondaryButton}><Text style={styles.secondaryText}>Prøv igen</Text></Pressable></View> : null}
      {connected === false && !props.connectionError ? <EncryptedEnergyControls onConnected={props.connectionReady} /> : null}
      {connected === true ? <>
        {auth.households.length > 1 ? <View style={styles.actions}>{auth.households.map(household => <Pressable key={household.id} accessibilityRole="button" accessibilityState={{ selected: auth.householdId === household.id }} onPress={() => auth.setHouseholdId(household.id)} style={styles.secondaryButton}><Text style={styles.secondaryText}>{auth.householdId === household.id ? '✓ ' : ''}{household.name}</Text></Pressable>)}</View> : null}
        <ElectricityUsageChart {...props} />
      </> : null}
      {auth.authError ? <Text style={styles.error}>{auth.authError}</Text> : null}
      {props.error ? <Text style={styles.error}>{props.error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 24, marginBottom: 24, borderRadius: 24, backgroundColor: colors.white },
  heading: { flexDirection: "row", alignItems: "center", gap: 12 }, icon: { width: 42, height: 42, borderRadius: 15, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }, headingCopy: { flex: 1 },
  title: { fontFamily: "Nunito_700Bold", fontSize: 17, color: colors.ink, letterSpacing: -0.2 }, subtitle: { fontFamily: "Nunito_500Medium", fontSize: 10, color: colors.muted, marginTop: 3 },
  period: { fontFamily: "Nunito_700Bold", fontSize: 10, color: colors.muted, letterSpacing: 0.6, marginTop: 18 }, valueRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 3 }, value: { fontFamily: "Nunito_600SemiBold", fontSize: 36, color: colors.ink }, unit: { fontFamily: "Nunito_700Bold", fontSize: 16, color: colors.primary }, detail: { fontFamily: "Nunito_500Medium", fontSize: 12, color: colors.ink, marginTop: 5 },
  intro: { fontFamily: "Nunito_400Regular", fontSize: 13, lineHeight: 19, color: colors.muted, marginTop: 16 }, input: { minHeight: 46, paddingHorizontal: 13, borderRadius: 12, borderWidth: 1, borderColor: colors.line, color: colors.ink, backgroundColor: colors.paper, marginTop: 14 }, primaryButton: { minHeight: 48, borderRadius: 22, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginTop: 12 }, disabled: { opacity: 0.5 }, primaryText: { fontFamily: "Nunito_700Bold", fontSize: 13, color: colors.white }, link: { alignSelf: "flex-start", marginTop: 14 }, linkText: { fontFamily: "Nunito_700Bold", fontSize: 12, color: colors.primary }, note: { fontFamily: "Nunito_400Regular", fontSize: 11, lineHeight: 16, color: colors.muted, marginTop: 12 }, actions: { flexDirection: "row", gap: 10, marginTop: 14 }, secondaryButton: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.primarySoft }, secondaryText: { fontFamily: "Nunito_700Bold", fontSize: 12, color: colors.ink }, error: { fontFamily: "Nunito_500Medium", fontSize: 12, lineHeight: 17, color: colors.coral, marginTop: 12 },
});
