import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from './AppIcon';
import { colors } from '../styles/theme';

export function ChargerEntry({ onOpen }: { onOpen: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel="Åbn ladeboks" onPress={onOpen} style={({ pressed }) => [s.entry, pressed && s.pressed]}>
    <View style={s.icon}><AppIcon name="battery-charging" size={24} color={colors.primary} /></View>
    <View style={s.entryCopy}><Text style={s.entryTitle}>Ladeboks</Text><Text style={s.copy}>Opladning hjemme</Text></View>
    <AppIcon name="chevron-right" size={20} color={colors.primary} />
  </Pressable>;
}

// Navigation/UI only until an actual charger model and paired EEBUS transport
// are verified. Never treat a screen tap or a configured address as a connection.
export function ChargerPage() {
  return <View style={s.page}>
    <View><Text style={s.eyebrow}>OPLADNING HJEMME</Text><Text style={s.title}>Ladeboks</Text><Text style={s.subtitle}>Styr opladningen fra dit hjem.</Text></View>
    <View style={s.card}>
      <View style={s.statusRow}><View style={s.icon}><AppIcon name="battery-charging" size={26} color={colors.primary} /></View><View style={s.entryCopy}><Text style={s.entryTitle}>Din ladeboks</Text><Text accessibilityLiveRegion="polite" style={s.copy}>Ikke forbundet</Text></View></View>
      <Text style={s.protocol}>EEBUS · Lokal forbindelse</Text>
      <Text style={s.description}>Ladeboksens model og understøttelse af EEBUS skal bekræftes, før den kan parres.</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Start opladning" accessibilityHint="Kræver en parret ladeboks med understøttet ladestyring" accessibilityState={{ disabled: true }} disabled style={s.disabledButton}>
        <AppIcon name="zap" size={20} color={colors.muted} /><Text style={s.disabledText}>Start opladning</Text>
      </Pressable>
      <Text style={s.note}>Opladning kan først startes, når forbindelsen er klar.</Text>
    </View>
    <View style={s.localNote}><AppIcon name="lock" size={20} color={colors.primary} /><Text style={[s.copy, s.entryCopy]}>Lokal styring kræver en kompatibel ladeboks og sikker parring på hjemmenetværket.</Text></View>
  </View>;
}

const s = StyleSheet.create({
  page: { gap: 24 },
  eyebrow: { fontFamily: 'Nunito_700Bold', fontSize: 11, letterSpacing: 0.8, color: colors.muted },
  title: { fontFamily: 'Nunito_600SemiBold', fontSize: 30, lineHeight: 36, color: colors.ink, marginTop: 8 },
  subtitle: { fontFamily: 'Nunito_400Regular', fontSize: 16, lineHeight: 24, color: colors.muted, marginTop: 8 },
  entry: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.white, borderRadius: 24, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: colors.line },
  pressed: { opacity: 0.75 },
  icon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  entryCopy: { flex: 1 },
  entryTitle: { fontFamily: 'Nunito_700Bold', fontSize: 18, lineHeight: 24, color: colors.ink },
  copy: { fontFamily: 'Nunito_400Regular', fontSize: 14, lineHeight: 20, color: colors.muted },
  card: { backgroundColor: colors.white, borderRadius: 24, borderWidth: 1, borderColor: colors.line, padding: 24, gap: 16 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  protocol: { fontFamily: 'Nunito_500Medium', fontSize: 12, color: colors.primary },
  description: { fontFamily: 'Nunito_400Regular', fontSize: 16, lineHeight: 24, color: colors.ink },
  disabledButton: { minHeight: 52, borderRadius: 24, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, backgroundColor: colors.paper },
  disabledText: { fontFamily: 'Nunito_700Bold', fontSize: 16, color: colors.muted },
  note: { fontFamily: 'Nunito_400Regular', fontSize: 12, lineHeight: 18, color: colors.muted },
  localNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
});
