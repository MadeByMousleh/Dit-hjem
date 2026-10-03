import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../styles/theme';
import type { DashboardTab } from '../hooks/useDashboardViewState';

const tabs = [
  { id: 'dashboard', label: 'Overblik', icon: 'grid-outline', selectedIcon: 'grid' },
  { id: 'home', label: 'Mit hjem', icon: 'home-outline', selectedIcon: 'home' },
  { id: 'utilities', label: 'Vand og varme', icon: 'water-outline', selectedIcon: 'water' },
  { id: 'car', label: 'Bil', icon: 'car-sport-outline', selectedIcon: 'car-sport' },
  { id: 'profile', label: 'Profil', icon: 'person-outline', selectedIcon: 'person' },
] as const;
type Tab = DashboardTab;

export function BottomTabs({ activeTab, onSelect }: { activeTab: Tab; onSelect: (tab: Tab) => void }) {
  const insets = useSafeAreaInsets();
  return <View style={[s.surface, { paddingBottom: Math.max(insets.bottom, 8), paddingLeft: Math.max(insets.left, 12), paddingRight: Math.max(insets.right, 12) }]}>
    <View accessibilityRole="tablist" style={s.row}>
      {tabs.map(tab => {
        const selected = activeTab === tab.id || (tab.id === 'home' && (activeTab === 'electricity' || activeTab === 'appliances'));
        return <Pressable key={tab.id} accessibilityRole="tab" accessibilityLabel={tab.label} accessibilityState={{ selected }}
          onPress={() => onSelect(tab.id)} style={({ pressed }) => [s.tab, pressed && s.pressed]}>
          <View style={[s.icon, selected && s.selectedIcon]}>
            <Ionicons name={selected ? tab.selectedIcon : tab.icon} size={23} color={selected ? colors.primary : colors.muted} />
          </View>
          <Text numberOfLines={2} style={[s.label, selected && s.selectedLabel]}>{tab.label}</Text>
        </Pressable>;
      })}
    </View>
  </View>;
}

const s = StyleSheet.create({
  surface: { backgroundColor: colors.white, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingTop: 8 },
  row: { flexDirection: 'row', width: '100%', maxWidth: 600, alignSelf: 'center' },
  tab: { flex: 1, minHeight: 68, alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 18 },
  pressed: { backgroundColor: colors.paper, opacity: 0.75 },
  icon: { width: 48, height: 32, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  selectedIcon: { backgroundColor: colors.primarySoft },
  label: { fontFamily: 'DMSans_500Medium', fontSize: 10, lineHeight: 12, textAlign: 'center', color: colors.muted },
  selectedLabel: { fontFamily: 'DMSans_700Bold', color: colors.primary },
});
