import { useState } from 'react';
import { Linking, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useEnergyVault } from './EnergyVaultGate';
import { connectPrivateMeter } from '../services/private-electricity';
import { colors } from '../styles/theme';

export function EncryptedEnergyControls({ onConnected }: { onConnected?: () => void }) {
  const vault = useEnergyVault();
  const [token, setToken] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>, success: string) {
    if (busy) return;
    setBusy(true); setMessage('');
    try { await action(); setMessage(success); }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Prøv igen.'); }
    finally { setBusy(false); }
  }

  return <View style={{ marginTop: 16 }}>
    {Platform.OS === 'web' ? <Text style={{ color: colors.muted, marginBottom: 10 }}>Forbindelsen huskes kun, indtil du genindlæser eller forlader siden.</Text> : null}
    <>
      <Text style={{ color: colors.muted, lineHeight: 19 }}>Hent din token hos Eloverblik, og indsæt den her.</Text>
      <Pressable disabled={busy} onPress={() => void Linking.openURL('https://eloverblik.dk/')} style={{ minHeight: 44, justifyContent: 'center', marginTop: 5 }}><Text style={{ color: colors.primary, fontFamily: 'DMSans_700Bold' }}>Åbn Eloverblik</Text></Pressable>
      <TextInput accessibilityLabel="Eloverblik-token" value={token} onChangeText={setToken} editable={!busy} secureTextEntry autoCapitalize="none" autoCorrect={false} placeholder="Indsæt din Eloverblik-token" placeholderTextColor={colors.muted} style={{ minHeight: 48, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 12, color: colors.ink }} />
      <Pressable disabled={busy || !token.trim()} onPress={() => void run(async () => { await connectPrivateMeter(vault, token); setToken(''); onConnected?.(); }, 'Eloverblik er nu forbundet.')} style={{ minHeight: 46, borderRadius: 23, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 10, opacity: busy || !token.trim() ? 0.5 : 1 }}><Text style={{ color: colors.white, fontFamily: 'DMSans_700Bold' }}>{busy ? 'Forbinder…' : 'Forbind'}</Text></Pressable>
    </>
    {message ? <Text accessibilityRole="alert" style={{ color: colors.ink, marginTop: 10 }}>{message}</Text> : null}
  </View>;
}
