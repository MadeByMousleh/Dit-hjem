import { Feather } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useElectricityUsage } from "../hooks/useElectricityUsage";
import { colors } from "../styles/theme";

import { ElectricityUsageChart } from "./ElectricityUsageChart";
import { BackgroundUsageCard } from './BackgroundUsageCard';

type Props = ReturnType<typeof useElectricityUsage>;

export function ElectricityUsageCard(props: Props) {
  const { auth, loading, error, load, disconnect, opened } = props;
  return (
    <View style={styles.card}>
      <View style={styles.heading}>
        <View style={styles.icon}><Feather name="zap" size={20} color={colors.primary} /></View>
        <View style={styles.headingCopy}>
          <Text style={styles.title}>Dit faktiske elforbrug</Text>
          <Text style={styles.subtitle}>Data fra Eloverblik</Text>
        </View>
      </View>

      {auth.authLoading ? <ActivityIndicator style={{ marginTop: 20 }} color={colors.primary} /> : null}
        {auth.households.length > 1 ? <View style={styles.actions}>{auth.households.map(household => <Pressable key={household.id} accessibilityRole="button" accessibilityState={{ selected: auth.householdId === household.id }} onPress={() => { disconnect(); auth.setHouseholdId(household.id); }} style={styles.secondaryButton}><Text style={styles.secondaryText}>{auth.householdId === household.id ? '✓ ' : ''}{household.name}</Text></Pressable>)}</View> : null}
        {auth.householdId ? <BackgroundUsageCard key={auth.householdId} data={props.background} loading={props.backgroundLoading} error={props.backgroundError} onRefresh={() => void props.loadBackground()} /> : null}
        {auth.householdId ? opened ? <>
          <ElectricityUsageChart {...props} />
          <View style={styles.actions}>
            <Pressable onPress={() => void load()} disabled={loading} style={styles.secondaryButton}><Text style={styles.secondaryText}>{loading ? "Henter…" : "Opdater"}</Text></Pressable>
            <Pressable onPress={disconnect} style={styles.secondaryButton}><Text style={styles.secondaryText}>Luk forbrug</Text></Pressable>
          </View>
        </> : <>
          <Text style={styles.intro}>Se din husstands registrerede elforbrug pr. år, måned, dag eller time.</Text>
          <Pressable onPress={() => void load()} disabled={loading} style={styles.primaryButton}><Text style={styles.primaryText}>Vis mit elforbrug</Text></Pressable>
        </> : null}
        <Pressable onPress={() => { disconnect(); void auth.signOut(); }} style={styles.link}><Text style={styles.linkText}>Log ud</Text></Pressable>
      {auth.authError ? <Text style={styles.error}>{auth.authError}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 18, marginBottom: 18, borderRadius: 22, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  heading: { flexDirection: "row", alignItems: "center", gap: 12 }, icon: { width: 42, height: 42, borderRadius: 15, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }, headingCopy: { flex: 1 },
  title: { fontFamily: "DMSans_700Bold", fontSize: 16, color: colors.ink }, subtitle: { fontFamily: "DMSans_400Regular", fontSize: 12, color: colors.muted, marginTop: 2 },
  period: { fontFamily: "DMSans_700Bold", fontSize: 10, color: colors.muted, letterSpacing: 0.6, marginTop: 18 }, valueRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 3 }, value: { fontFamily: "Fraunces_600SemiBold", fontSize: 36, color: colors.ink }, unit: { fontFamily: "DMSans_700Bold", fontSize: 16, color: colors.primary }, detail: { fontFamily: "DMSans_500Medium", fontSize: 12, color: colors.ink, marginTop: 5 },
  intro: { fontFamily: "DMSans_400Regular", fontSize: 13, lineHeight: 19, color: colors.muted, marginTop: 16 }, input: { minHeight: 46, paddingHorizontal: 13, borderRadius: 12, borderWidth: 1, borderColor: colors.line, color: colors.ink, backgroundColor: colors.paper, marginTop: 14 }, primaryButton: { minHeight: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginTop: 12 }, disabled: { opacity: 0.5 }, primaryText: { fontFamily: "DMSans_700Bold", fontSize: 13, color: colors.white }, link: { alignSelf: "flex-start", marginTop: 14 }, linkText: { fontFamily: "DMSans_700Bold", fontSize: 12, color: colors.primary }, note: { fontFamily: "DMSans_400Regular", fontSize: 11, lineHeight: 16, color: colors.muted, marginTop: 12 }, actions: { flexDirection: "row", gap: 10, marginTop: 14 }, secondaryButton: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.primarySoft }, secondaryText: { fontFamily: "DMSans_700Bold", fontSize: 12, color: colors.ink }, error: { fontFamily: "DMSans_500Medium", fontSize: 12, lineHeight: 17, color: colors.coral, marginTop: 12 },
});
