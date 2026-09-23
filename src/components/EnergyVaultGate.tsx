import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { ActivityIndicator, Alert, AppState, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EnergyVault, generateKey, recoveryKey, parseRecoveryKey } from '../services/energy-vault';
import type { VaultHistory } from '../services/energy-vault';
import { useHouseholdSession } from '../hooks/useHouseholdSession';
import { colors } from '../styles/theme';

const Context = createContext<EnergyVault | null>(null);
export function useEnergyVault() {
  const vault = useContext(Context);
  if (!vault) throw new Error('Eldata er låst.');
  return vault;
}
export function EnergyVaultGate({ children }: { children: ReactNode }) {
  const auth = useHouseholdSession();
  const [epoch, setEpoch] = useState(0);
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => { if (state === 'background') setEpoch(value => value + 1); });
    return () => listener.remove();
  }, []);
  return <VaultSession key={`${auth.session!.user.id}:${auth.householdId}:${epoch}`} householdId={auth.householdId} userId={auth.session!.user.id}>{children}</VaultSession>;
}
function VaultSession({ householdId, userId, children }: { householdId: string; userId: string; children: ReactNode }) {
  const auth = useHouseholdSession();
  const [vault] = useState(() => new EnergyVault(householdId, userId));
  const [exists, setExists] = useState<boolean | null>(null);
  const [generated, setGenerated] = useState('');
  const [input, setInput] = useState('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [history, setHistory] = useState<VaultHistory | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  useEffect(() => {
    let active = true;
    vault.exists().then(value => { if (active) setExists(value); }).catch(() => { if (active) setError('Backup kunne ikke hentes. Kontrollér forbindelsen og prøv igen.'); });
    return () => { active = false; };
  }, [vault, attempt]);
  useEffect(() => {
    if (!exists || Platform.OS === 'web') return;
    let active = true;
    let attempted = false;
    const unlock = async () => {
      if (attempted || AppState.currentState !== 'active') return;
      attempted = true;
      setBusy(true);
      try {
        const unlocked = await vault.unlockRemembered();
        if (active && unlocked) setReady(true);
      } catch {
        if (active) setError('Sikker oplåsning blev ikke gennemført. Prøv igen eller brug din gendannelsesnøgle.');
      } finally {
        if (active) setBusy(false);
      }
    };
    void unlock();
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void unlock(); });
    return () => { active = false; listener.remove(); };
  }, [exists, vault]);
  useEffect(() => () => vault.close(), [vault]);
  async function rememberPhone() {
    if (Platform.OS === 'web') return;
    try { await vault.remember(); }
    catch {
      Alert.alert('Telefonen kunne ikke huskes', 'Dine data er låst op, men nøglen kunne ikke gemmes sikkert. Kontrollér, at biometri er sat op på telefonen. Behold din gendannelsesnøgle; du skal bruge den ved næste oplåsning.');
    }
  }
  async function run(action: () => Promise<void>) { if (busy) return; setBusy(true); setError(''); try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Handlingen mislykkedes.'); } finally { setBusy(false); } }
  if (ready) return <Context.Provider value={vault}>{children}</Context.Provider>;
  return <SafeAreaView style={s.page}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.container}><View style={s.card}>
    <Text style={s.title}>{exists === false ? 'Beskyt dine eldata' : 'Lås dine eldata op'}</Text>
    <Text style={s.copy}>Din konto giver adgang til backup. Din personlige gendannelsesnøgle låser indholdet op — også på en ny telefon.</Text>
    {Platform.OS !== 'web' ? <Text style={s.copy}>Denne telefon huskes automatisk med sikker nøglelagring. Næste gang bruger du biometri. Behold din gendannelsesnøgle til en ny telefon.</Text> : null}
    {exists === null ? <>{!error ? <ActivityIndicator color={colors.primary} /> : null}<Pressable style={s.secondary} onPress={() => { setError(''); setAttempt(value => value + 1); }}><Text>Prøv igen</Text></Pressable></> : exists ? <>
      <TextInput accessibilityLabel="Gendannelsesnøgle" value={input} onChangeText={setInput} secureTextEntry autoCapitalize="none" autoCorrect={false} placeholder="Indtast din gendannelsesnøgle" style={s.input} />
      <Pressable disabled={busy || !input.trim()} style={s.button} onPress={() => void run(async () => { await vault.unlock(input); setInput(''); await rememberPhone(); setReady(true); })}><Text style={s.buttonText}>Lås op og synkroniser</Text></Pressable>
      {Platform.OS !== 'web' ? <Pressable disabled={busy} style={s.secondary} onPress={() => void run(async () => { if (!await vault.unlockRemembered()) throw new Error('Ingen nøgle er gemt på denne telefon. Brug din gendannelsesnøgle.'); setReady(true); })}><Text>Brug telefonens sikre nøglelager</Text></Pressable> : null}
      <Pressable disabled={busy} style={s.secondary} onPress={() => void run(async () => { setSelectedVersion(null); setHistory(await vault.history()); })}><Text>Kan du ikke åbne backup? Se tidligere versioner</Text></Pressable>
      {history ? <View>
        <Text style={s.copy}>Vælg en gemt version, hvis den seneste backup er beskadiget. Gendannelsesnøglen ovenfor er nødvendig. Tidspunkterne er serverens registreringer.</Text>
        {!history.versions.length ? <Text style={s.copy}>Ingen gemte versioner fundet.</Text> : null}
        {history.versions.map(version => <Pressable key={version.revision} disabled={busy} accessibilityRole="radio" accessibilityState={{ checked: selectedVersion === version.revision }} style={[s.input, { justifyContent: 'center', backgroundColor: selectedVersion === version.revision ? colors.paper : colors.white }]} onPress={() => setSelectedVersion(version.revision)}>
          <Text>Version {version.revision} · {new Date(version.saved_at).toLocaleString('da-DK')}</Text>
        </Pressable>)}
        {history.hasMore ? <Pressable disabled={busy} style={s.secondary} onPress={() => void run(async () => {
          const page = await vault.history(history.versions[history.versions.length - 1]?.revision);
          setHistory({ ...page, versions: [...history.versions, ...page.versions] }); setSelectedVersion(null);
        })}><Text>Vis ældre versioner</Text></Pressable> : null}
        {selectedVersion !== null ? <>
          <Text style={s.copy}>Gendan version {selectedVersion} som ny aktuel backup? Ændringer efter denne version vil ikke være med i den gendannede historik. Alle gemte versioner bevares. Handlingen erstatter den aktuelle version {history.currentRevision}.</Text>
          <Pressable disabled={busy || !input.trim()} style={s.button} onPress={() => void run(async () => {
            await vault.restoreVersion(input, selectedVersion, history.currentRevision);
            await rememberPhone();
            setInput(''); setHistory(null); setSelectedVersion(null); setReady(true);
          })}><Text style={s.buttonText}>Bekræft gendannelse af version {selectedVersion}</Text></Pressable>
        </> : null}
        <Pressable disabled={busy} style={s.secondary} onPress={() => { setHistory(null); setSelectedVersion(null); }}><Text>Annuller gendannelse</Text></Pressable>
      </View> : null}
    </> : <>
      <Text style={s.copy}>Gem nøglen i din passwordmanager eller på papir. Hvis både nøglen og alle godkendte telefoner mistes, kan vi ikke gendanne dine krypterede data.</Text>
      <Text style={s.copy}>Eksisterende eldata kopieres til en krypteret backup. Tidligere ukrypterede serverkopier slettes ikke automatisk; overgangen er først fuldført, når de og den gamle Eloverblik-adgang er fjernet.</Text>
      {!generated ? <Pressable disabled={busy} style={s.button} onPress={() => void run(async () => { const key = await generateKey(); setGenerated(recoveryKey(key)); key.fill(0); })}><Text style={s.buttonText}>Opret gendannelsesnøgle</Text></Pressable> : <>
        <Text selectable style={s.key}>{generated}</Text>
        <Text style={s.copy}>Indtast nøglen igen fra din gemte kopi for at bekræfte, at du kan gendanne på en ny telefon.</Text>
        <TextInput accessibilityLabel="Bekræft gendannelsesnøgle" value={input} onChangeText={setInput} secureTextEntry autoCapitalize="none" autoCorrect={false} style={s.input} />
        <Pressable disabled={busy || !input.trim()} style={s.button} onPress={() => void run(async () => {
          const confirmed = parseRecoveryKey(input); const matches = recoveryKey(confirmed) === generated; confirmed.fill(0);
          if (!matches) throw new Error('Nøglerne er ikke ens. Kontrollér din gemte kopi.');
          try { await vault.enroll(input); }
          catch (cause) { try { if (await vault.exists()) setExists(true); } catch {} throw cause; }
          setGenerated(''); setInput(''); await rememberPhone(); setReady(true);
        })}><Text style={s.buttonText}>Bekræft og krypter backup</Text></Pressable>
      </>}
    </>}
    {busy ? <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} /> : null}
    {error ? <Text accessibilityRole="alert" style={[s.copy, { color: colors.coral }]}>{error}</Text> : null}
    <Pressable disabled={busy} style={s.secondary} onPress={() => void auth.signOut()}><Text>Log ud</Text></Pressable>
  </View></ScrollView></SafeAreaView>;
}
const s = StyleSheet.create({ page: { flex: 1, backgroundColor: colors.paper }, container: { flexGrow: 1, justifyContent: 'center', padding: 20 }, card: { width: '100%', maxWidth: 520, alignSelf: 'center', padding: 24, backgroundColor: colors.white, borderRadius: 22 }, title: { fontFamily: 'Fraunces_600SemiBold', fontSize: 28, color: colors.ink }, copy: { fontFamily: 'DMSans_400Regular', fontSize: 13, lineHeight: 21, color: colors.muted, marginTop: 14 }, input: { minHeight: 48, borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 12, marginTop: 16, color: colors.ink }, button: { minHeight: 48, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.primary, borderRadius: 24, marginTop: 16 }, buttonText: { fontFamily: 'DMSans_700Bold', color: colors.white }, secondary: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 8 }, key: { color: colors.ink, fontFamily: 'DMSans_700Bold', fontSize: 17, lineHeight: 28, padding: 14, backgroundColor: colors.paper, marginTop: 16, borderRadius: 12 } });
