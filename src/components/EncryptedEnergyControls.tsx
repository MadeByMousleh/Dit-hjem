import {AppText as Text} from './AppText';
import {Disclosure} from './Disclosure';
import {cardStyles} from '../styles/cards';
import {HapticPressable as Pressable} from './HapticPressable';
import { useEffect } from 'react';
import { ActivityIndicator, Linking, View } from 'react-native';
import { useEnergyVault } from './EnergyVaultGate';
import { usePowerSetup } from '../hooks/usePowerSetup';
import { colors } from '../styles/theme';
import {EloverblikDataInformation} from './EloverblikDataInformation';

export function EncryptedEnergyControls({ onConnected, compact=false }: { onConnected?: () => void; compact?:boolean }) {
  const vault=useEnergyVault();
  const setup = usePowerSetup(vault);
  useEffect(() => { if (setup.state === 'done') onConnected?.(); }, [setup.state, onConnected]);
  return <View style={{ marginTop: 16, gap: 10 }}>
    {compact?<Text style={cardStyles.note}>Forbind Eloverblik sikkert med MitID.</Text>:<Text style={{ color: colors.muted, lineHeight: 22 }}>Forbind med MitID hos Eloverblik. En allerede tilknyttet fuldmagt genbruges automatisk.</Text>}
    <Pressable accessibilityRole="button" disabled={setup.busy} onPress={() => void (setup.state === 'pending' || setup.state === 'done' ? setup.check() : setup.connect())} style={{ minHeight: 52, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', opacity: setup.busy ? 0.5 : 1 }}>
      {setup.busy ? <ActivityIndicator color={colors.white} /> : <Text style={{ color: colors.white, fontFamily: 'Nunito_700Bold' }}>{setup.state === 'done' ? 'Forbundet' : setup.state === 'pending' ? 'Kontrollér godkendelse' : compact?'Se dit forbrug':'Forbind med MitID'}</Text>}
    </Pressable>
    {setup.state === 'pending' ? <Pressable accessibilityRole="button" disabled={setup.busy} onPress={() => void setup.connect()} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: colors.primary }}>Åbn Eloverblik igen</Text></Pressable> : null}
    {setup.message || setup.error ? <Text accessibilityLiveRegion="polite" style={{ color: setup.error ? colors.error : colors.ink }}>{setup.error || setup.message}</Text> : null}
    <EloverblikDataInformation meterIds={vault.data.meters.map(meter=>meter.metering_point_id)} />
    {!compact||setup.error?<ExistingAuthorizationHelp />:null}
  </View>;
}

export function ExistingAuthorizationHelp() {
  return <Disclosure title="Problemer med forbindelsen?">
    <Text style={{ color: colors.ink, fontFamily: 'Nunito_700Bold', fontSize: 14 }}>Siger Eloverblik, at fuldmagten allerede findes?</Text>
    <Text style={{ color: colors.muted, lineHeight: 21, fontSize: 13 }}>Tryk først på Kontrollér godkendelse. Hvis fuldmagten er oprettet via et gammelt fælles link, kan vi ikke automatisk knytte den til din konto. Fjern kun fuldmagten til vores virksomhed hos Eloverblik, og vend tilbage for at oprette den via appen. Andre fuldmagter skal bevares.</Text>
    <Pressable accessibilityRole="link" onPress={() => void Linking.openURL('https://eloverblik.dk').catch(() => {})} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: colors.primary, fontFamily: 'Nunito_700Bold' }}>Åbn Eloverblik ↗</Text></Pressable>
  </Disclosure>;
}
