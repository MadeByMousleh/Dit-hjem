import {AppText as Text} from './AppText';
import {cardStyles} from '../styles/cards';
import {HapticPressable as Pressable} from './HapticPressable';
import {isPausedHomeTab} from '../utils/pausedHomeFeatures';
import { AppIcon } from './AppIcon';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import type { DashboardTab } from '../hooks/useDashboardViewState';
import { colors } from '../styles/theme';

const categories = [
  { page: 'property', title: 'Boligen', description: 'Boligen, tag og matrikel', icon: 'home', tint: colors.primarySoft },
  { page: 'electricity', title: 'El', description: 'Forbrug, mønstre og din elaftale', icon: 'zap', tint: colors.primarySoft },
  { page: 'utilities', title: 'Varme', description: 'Varmeforbrug og temperatur', icon: 'thermometer', tint: colors.primarySoft },
  { page: 'car', title: 'Bil', description: 'Batteri, opladning og ladeplan', icon: 'truck', tint: colors.primarySoft },
  { page: 'appliances', title: 'Apparater', description: 'Dine apparater og de bedste tidspunkter', icon: 'sliders', tint: colors.primarySoft },
  { page: 'waste', title: 'Affald', description: 'Dine næste tømninger og affaldskalender', icon: 'trash-2', tint: colors.primarySoft },
  {page:'family',title:'Familie',description:'Medlemmer og invitationer',icon:'user',tint:colors.primarySoft},
] as const;

export function HomeCategories({ onSelect }: { onSelect: (page: DashboardTab) => void }) {
  const { width } = useWindowDimensions();
  const compact = width < 600;

  return <View style={s.content}>
    <View style={s.heading}><Text style={s.eyebrow}>DIT HJEM, SAMLET</Text><Text style={[s.title, compact && s.titleCompact]}>Mit hjem</Text><Text style={s.subtitle}>Vælg det, du vil se nærmere på.</Text></View>
    <View style={[s.grid, compact && s.gridCompact]}>{categories.filter(category => !isPausedHomeTab(category.page)).map(category => <Pressable key={category.page} accessibilityRole="button" accessibilityLabel={`Åbn ${category.title}`} onPress={() => onSelect(category.page)} style={({ pressed }) => [s.card, compact && s.cardCompact, pressed && s.pressed]}>
      <View style={[s.top, compact && s.topCompact]}><View style={[s.icon, compact && s.iconCompact, { backgroundColor: category.tint }]}><AppIcon name={category.icon} size={compact ? 22 : 25} color={colors.ink} /></View>{!compact ? <AppIcon name="arrow-up-right" size={19} color={colors.muted} /> : null}</View>
      <View style={s.copy}><Text style={[s.cardTitle, compact && s.cardTitleCompact]}>{category.title}</Text><Text style={[s.description, compact && s.descriptionCompact]}>{category.description}</Text></View>
      {compact ? <AppIcon name="arrow-right" size={20} color={colors.primary} /> : <View style={s.footer}><Text style={s.open}>Se {category.title.toLowerCase()}</Text><AppIcon name="arrow-right" size={16} color={colors.primary} /></View>}
    </Pressable>)}</View>
  </View>;
}

const s = StyleSheet.create({
  content: { gap: 24, paddingBottom: 20 },
  heading: { gap: 7 },
  eyebrow: { fontFamily: 'Nunito_700Bold', fontSize:12, letterSpacing: 1.5, color: colors.primary },
  title: { fontFamily: 'Nunito_600SemiBold', fontSize: 34, color: colors.ink },
  subtitle: { fontFamily: 'Nunito_400Regular', fontSize: 14, color: colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  gridCompact: { flexDirection: 'column', flexWrap: 'nowrap', gap: 12 },
  card: { flexGrow: 1, flexBasis: '45%', minWidth: 140, padding:20, borderRadius: 24, backgroundColor: colors.white, borderWidth: 1, borderColor: '#E8E8EE', gap: 14 },
  cardCompact: { width: '100%', minWidth: 0, flexGrow: 0, flexBasis: 'auto', minHeight: 88, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  pressed: { opacity: 0.75, backgroundColor: '#F0F2FF' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  topCompact: { marginBottom: 0 },
  icon: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  iconCompact: { width: 44, height: 44, borderRadius: 16 },
  copy: { flexShrink: 1 },
  cardTitle: { fontFamily: 'Nunito_700Bold', fontSize: 22, color: colors.ink },
  cardTitleCompact: { fontSize: 18, lineHeight: 23 },
  description: { fontFamily: 'Nunito_400Regular', fontSize: 14, lineHeight: 21, color: colors.muted, minHeight: 42 },
  descriptionCompact: { minHeight: 0, fontSize: 13, lineHeight: 18, marginTop: 2 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  open: { fontFamily: 'Nunito_700Bold', fontSize: 12, color: colors.primary },
  titleCompact: { fontSize: 30, lineHeight: 36 },
});
