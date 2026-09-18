import { Feather } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { WasteEvent, WasteHealth, WASTE_LABELS } from "../waste";
import { colors } from "../styles/theme";
import { styles } from "../styles/appStyles";

export function WasteCollectionCard({ events, error, wasteHealth, showOnDashboard, onToggleDashboard, onOpenProfile }: { events: WasteEvent[]; error: string; wasteHealth: WasteHealth | null; showOnDashboard: boolean; onToggleDashboard: () => void; onOpenProfile?: () => void }) {
  return (
    <View style={styles.wastePanel}>
      <View style={styles.sectionHeadingRow}>
        <View><Text style={styles.pageEyebrow}>AFFALD</Text><Text style={styles.sectionTitle}>Næste afhentning</Text></View>
        <Pressable accessibilityLabel={showOnDashboard ? "Skjul næste afhentning fra overblik" : "Vis næste afhentning på overblik"} onPress={onToggleDashboard} style={[styles.deviceActionButton, showOnDashboard && styles.deviceActionButtonActive]}>
          <Feather name="eye" size={16} color={showOnDashboard ? colors.green : colors.muted} />
        </Pressable>
      </View>
      {events.length ? events.slice(0, 3).map((event) => (
        <View key={event.id} style={styles.wasteEvent}>
          <View style={styles.wasteDate}><Text style={styles.wasteDateDay}>{new Date(`${event.date}T12:00:00`).getDate()}</Text><Text style={styles.wasteDateMonth}>{new Date(`${event.date}T12:00:00`).toLocaleDateString("da-DK", { month: "short" })}</Text></View>
          <View style={styles.wasteEventCopy}><Text style={styles.wasteEventTitle}>{WASTE_LABELS[event.category]}</Text><Text style={styles.wasteEventMeta}>{event.title}</Text></View>
        </View>
      )) : <>
        <Text style={styles.wasteEmpty}>{error || "Tilføj din adresse i Profil for at se affaldsafhentninger."}</Text>
        {!events.length && onOpenProfile ? <Pressable onPress={onOpenProfile} style={styles.wasteAction}><Text style={styles.wasteActionText}>{wasteHealth?.status === "unsupported" ? "Tilføj officiel kalender" : "Åbn Profil"}</Text><Feather name="arrow-right" size={14} color={colors.white} /></Pressable> : null}
      </>}
    </View>
  );
}

