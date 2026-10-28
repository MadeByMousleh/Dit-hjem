import {AppText as Text} from './AppText';
import {cardStyles} from '../styles/cards';
import {HapticPressable as Pressable} from './HapticPressable';
import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EnergyVault } from '../services/energy-vault';
import { useHouseholdSession } from '../hooks/useHouseholdSession';
import { colors } from '../styles/theme';

const Context = createContext<EnergyVault | null>(null);

export function useEnergyVault() {
  const vault = useContext(Context);
  if (!vault) throw new Error('Eldata er ikke klar endnu.');
  return vault;
}

export function EnergyVaultGate({ children }: { children: ReactNode }) {
  const auth = useHouseholdSession();
  return <VaultSession key={`${auth.session!.user.id}:${auth.householdId}`} householdId={auth.householdId} userId={auth.session!.user.id}>{children}</VaultSession>;
}

function VaultSession({ householdId, userId, children }: { householdId: string; userId: string; children: ReactNode }) {
  const vaultRef = useRef<EnergyVault | null>(null);
  const [ready, setReady] = useState(false);
  const [migrationRequired, setMigrationRequired] = useState(false);
  const [legacyKey, setLegacyKey] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  const open = async (vault: EnergyVault) => {
    const result = await vault.unlockAutomatically();
    if (vaultRef.current !== vault) return;
    setMigrationRequired(result === 'migration-required');
    setReady(result === 'ready');
  };
  useEffect(() => {
    const vault = new EnergyVault(householdId, userId);
    vaultRef.current = vault;
    void open(vault).catch(cause => { if (vaultRef.current === vault) setError(cause instanceof Error ? cause.message : 'Dine data kunne ikke åbnes.'); }).finally(() => { if (vaultRef.current === vault) setBusy(false); });
    return () => { vaultRef.current = null; vault.close(); };
  }, [householdId, userId]);
  async function migrate() {
    const vault = vaultRef.current;
    if (busy || !legacyKey.trim() || !vault) return;
    setBusy(true); setError('');
    try { await vault.completeLegacyMigration(legacyKey); if (vaultRef.current === vault) { setLegacyKey(''); setMigrationRequired(false); setReady(true); } }
    catch (cause) { if (vaultRef.current === vault) setError(cause instanceof Error ? cause.message : 'Overførslen kunne ikke gennemføres.'); }
    finally { if (vaultRef.current === vault) setBusy(false); }
  }
  async function retry() {
    const vault = vaultRef.current;
    if (busy || !vault) return;
    setBusy(true); setError('');
    try { await open(vault); }
    catch (cause) { if (vaultRef.current === vault) setError(cause instanceof Error ? cause.message : 'Prøv igen.'); }
    finally { if (vaultRef.current === vault) setBusy(false); }
  }
  if (ready && vaultRef.current) return <Context.Provider value={vaultRef.current}>{children}</Context.Provider>;
  return <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled"><View style={styles.card}>
    {busy ? <><ActivityIndicator color={colors.primary} /><Text style={styles.title}>Gør dit hjem klar</Text><Text style={styles.copy}>Vi åbner dine energidata sikkert.</Text></> : migrationRequired ? <>
      <Text style={styles.title}>Én sidste overførsel</Text>
      <Text style={styles.copy}>Din gamle krypterede backup bruger en nøgle, som endnu ikke er knyttet sikkert til din konto. Indtast den én sidste gang. Herefter åbner dine data automatisk, når du logger ind.</Text>
      <TextInput accessibilityLabel="Tidligere gendannelsesnøgle" value={legacyKey} onChangeText={setLegacyKey} secureTextEntry autoCapitalize="none" autoCorrect={false} placeholder="Indtast din tidligere nøgle" style={styles.input} />
      <Pressable disabled={!legacyKey.trim()} onPress={() => void migrate()} style={[styles.button, !legacyKey.trim() && styles.disabled]}><Text style={styles.buttonText}>Overfør og fortsæt</Text></Pressable>
    </> : <>
      <Text style={styles.title}>Dine data kunne ikke åbnes</Text><Text style={styles.copy}>{error || 'Prøv igen om et øjeblik.'}</Text>
      <Pressable disabled={busy} onPress={() => void retry()} style={styles.button}><Text style={styles.buttonText}>Prøv igen</Text></Pressable>
    </>}
    {error && (busy || migrationRequired) ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
  </View></ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.paper }, container: { flexGrow: 1, justifyContent: 'center', padding: 20 }, card: { width: '100%', maxWidth: 520, alignSelf: 'center', padding:20, backgroundColor: colors.white, borderRadius: 24 },
  title: { marginTop: 16, fontFamily: 'Nunito_600SemiBold', fontSize: 28, color: colors.ink }, copy: { marginTop: 12, fontFamily: 'Nunito_400Regular', fontSize: 15, lineHeight: 22, color: colors.muted },
  input: {fontFamily:'Nunito_500Medium',fontSize:16, minHeight: 48, borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 12, marginTop: 20, color: colors.ink }, button: { minHeight: 48, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.primary, borderRadius: 24, marginTop: 16 },
  disabled: { opacity: 0.5 }, buttonText: { fontFamily: 'Nunito_700Bold', color: colors.white }, error: { marginTop: 14, color: colors.coral, lineHeight: 20 },
});
