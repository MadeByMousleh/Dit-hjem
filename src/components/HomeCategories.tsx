import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DashboardTab } from '../hooks/useDashboardViewState';
import { colors } from '../styles/theme';

const categories = [
  { page: 'electricity', title: 'El', description: 'Forbrug, priser og din elaftale', icon: 'zap', tint: colors.primarySoft },
  { page: 'utilities', title: 'Varme', description: 'Varmeforbrug og temperatur', icon: 'thermometer', tint: '#FCE7DF' },
  { page: 'car', title: 'Bil', description: 'Batteri, opladning og ladeplan', icon: 'truck', tint: '#E7E2FF' },
  { page: 'appliances', title: 'Apparater', description: 'Dine apparater og de bedste tidspunkter', icon: 'sliders', tint: '#E1F0F4' },
] as const;

export function HomeCategories({ onSelect }: { onSelect: (page: DashboardTab) => void }) {
  return <View style={s.content}>
    <View style={s.heading}><Text style={s.eyebrow}>DIT HJEM, SAMLET</Text><Text style={s.title}>Mit hjem</Text><Text style={s.subtitle}>Vælg det, du vil se nærmere på.</Text></View>
    <View style={s.grid}>{categories.map(category => <Pressable key={category.page} accessibilityRole="button" accessibilityLabel={`Åbn ${category.title}`} onPress={() => onSelect(category.page)} style={({ pressed }) => [s.card, pressed && s.pressed]}>
      <View style={s.top}><View style={[s.icon, { backgroundColor: category.tint }]}><Feather name={category.icon} size={25} color={colors.ink} /></View><Feather name="arrow-up-right" size={19} color={colors.muted} /></View>
      <Text style={s.cardTitle}>{category.title}</Text><Text style={s.description}>{category.description}</Text>
      <View style={s.footer}><Text style={s.open}>Se {category.title.toLowerCase()}</Text><Feather name="arrow-right" size={16} color={colors.primary} /></View>
    </Pressable>)}</View>
  </View>;
}

const s = StyleSheet.create({
  content: { gap: 24, paddingBottom: 20 },
  heading: { gap: 7 },
  eyebrow: { fontFamily: 'DMSans_700Bold', fontSize: 10, letterSpacing: 1.5, color: colors.primary },
  title: { fontFamily: 'Fraunces_600SemiBold', fontSize: 34, color: colors.ink },
  subtitle: { fontFamily: 'DMSans_400Regular', fontSize: 14, color: colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { flexGrow: 1, flexBasis: '45%', minWidth: 140, padding: 18, borderRadius: 24, backgroundColor: colors.white, borderWidth: 1, borderColor: '#E8E8EE', gap: 10 },
  pressed: { opacity: 0.75, backgroundColor: '#F0F2FF' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  icon: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontFamily: 'DMSans_700Bold', fontSize: 22, color: colors.ink },
  description: { fontFamily: 'DMSans_400Regular', fontSize: 12, lineHeight: 18, color: colors.muted, minHeight: 36 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  open: { fontFamily: 'DMSans_700Bold', fontSize: 12, color: colors.primary },
});
