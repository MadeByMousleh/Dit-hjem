import { AppIcon } from './AppIcon';
import { Pressable, Text, View, StyleSheet } from "react-native";


import { WasteEvent, WasteHealth, WASTE_LABELS } from "../waste";
import { colors } from "../styles/theme";
import { styles } from "../styles/appStyles";

export function WasteCollectionCard({ events, error, wasteHealth, onOpenProfile }: { events: WasteEvent[]; error: string; wasteHealth: WasteHealth | null; onOpenProfile?: () => void }) {
  return (
    <View style={styles.wastePanel}>
      <View style={styles.sectionHeadingRow}>
        <View><Text style={styles.pageEyebrow}>AFFALD · {wasteHealth?.provider || 'DIN ADRESSE'}</Text><Text style={styles.sectionTitle}>Næste afhentning</Text></View>
        <View style={s.icon}><AppIcon name="trash-2" size={22} color={colors.primary} /></View>
      </View>
      {events.length ? events.map((event) => (
        <View key={event.id} style={styles.wasteEvent}>
          <View style={styles.wasteDate}><Text style={styles.wasteDateDay}>{new Date(`${event.date}T12:00:00`).getDate()}</Text><Text style={styles.wasteDateMonth}>{new Date(`${event.date}T12:00:00`).toLocaleDateString("da-DK", { month: "short" })}</Text></View>
          <View style={styles.wasteEventCopy}><Text style={styles.wasteEventTitle}>{WASTE_LABELS[event.category]}</Text><Text style={styles.wasteEventMeta}>{event.title}</Text></View>
          <Text style={s.weekday}>{new Date(`${event.date}T12:00:00`).toLocaleDateString('da-DK', { weekday: 'short' })}</Text>
        </View>
      )) : <>
        <Text style={styles.wasteEmpty}>{error || "Tilføj din adresse i Profil for at se affaldsafhentninger."}</Text>
        {onOpenProfile ? <Pressable accessibilityRole="button" onPress={onOpenProfile} style={styles.wasteAction}><Text style={styles.wasteActionText}>Åbn Profil</Text><AppIcon name="arrow-right" size={14} color={colors.white} /></Pressable> : null}
      </>}

    </View>
  );
}

const s = StyleSheet.create({
  icon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  weekday: { fontFamily: 'Nunito_500Medium', fontSize: 12, color: colors.muted },
});
