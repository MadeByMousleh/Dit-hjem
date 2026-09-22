import { useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useEnergyVault } from './EnergyVaultGate';
import { connectPrivateMeter } from '../services/private-electricity';
import { colors } from '../styles/theme';
export function EncryptedEnergyControls({ onSync }: { onSync: () => Promise<void> }) {
  const vault = useEnergyVault();
  const [token, setToken] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function run(action: () => Promise<void>, success: string) { setBusy(true); setMessage(''); try { await action(); setMessage(success); } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Prøv igen.'); } finally { setBusy(false); } }
  const button = { minHeight: 44, justifyContent: 'center' as const };
  return <View style={{ padding: 16, backgroundColor: colors.primarySoft, borderRadius: 16, marginBottom: 18 }}>
    <Text style={{ fontFamily: 'DMSans_700Bold', color: colors.ink }}>Krypteret elhistorik</Text>
    <Text style={{ color: colors.muted, marginTop: 8, lineHeight: 19 }}>Nye elaftaler og målinger krypteres på enheden før synkronisering. Eksisterende serverkopier kræver særskilt oprydning.</Text>
    <Pressable disabled={busy} style={button} onPress={() => void run(onSync, 'Seneste backup er hentet.')}><Text>Synkroniser fra andre enheder</Text></Pressable>
    {Platform.OS !== 'web' ? <>
      <Pressable disabled={busy} style={button} onPress={() => void run(() => vault.remember(), 'Nøglen er gemt i telefonens sikre nøglelager.')}><Text>Husk denne telefon med sikker oplåsning</Text></Pressable>
      <TextInput accessibilityLabel="Eloverblik-token" value={token} onChangeText={setToken} secureTextEntry autoCapitalize="none" autoCorrect={false} placeholder="Din token fra Eloverblik" style={{ minHeight: 48, backgroundColor: colors.white, borderRadius: 10, paddingHorizontal: 12 }} />
      <Pressable disabled={busy || !token.trim()} style={button} onPress={() => void run(async () => { await connectPrivateMeter(vault, token); setToken(''); }, 'Forbindelsen er klar. Vælg Vis mit elforbrug.')}><Text>Forbind direkte til Eloverblik</Text></Pressable>
      <Text style={{ color: colors.muted, lineHeight: 19 }}>Token sendes kun til Eloverblik og huskes kun, mens data er låst op. Den indgår ikke i backup.</Text>
    </> : <Text style={{ color: colors.muted }}>Browseren viser synkroniseret historik. Nye målinger hentes direkte fra mobilappen.</Text>}
    {message ? <Text accessibilityRole="alert" style={{ color: colors.ink, marginTop: 10 }}>{message}</Text> : null}
  </View>;
}
