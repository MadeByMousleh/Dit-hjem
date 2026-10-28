import {AppText as Text} from './AppText';
import {cardStyles} from '../styles/cards';
import {AppModal as Modal} from './AppModal';
import {HapticPressable as Pressable} from './HapticPressable';
import { useState } from 'react';
import { ScrollView, TextInput, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon } from './AppIcon';
import { colors } from '../styles/theme';
import type { useWasteReminder } from '../hooks/useWasteReminder';

export function WasteReminderSetting({ reminder, styles: s }: { reminder: ReturnType<typeof useWasteReminder>; styles: any }) {
  const { preference, ready, status, update } = reminder;
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState('1');
  const [unit, setUnit] = useState<'hours' | 'days'>('days');
  const [busy, setBusy] = useState(false);
  const valid = /^\d+$/.test(amount) && Number(amount) >= 1 && Number(amount) <= (unit === 'days' ? 7 : 168);
  const change = async (enabled: boolean) => {
    setBusy(true);
    try { await update({ ...preference, enabled }); } finally { setBusy(false); }
  };
  return <>
    <View style={s.settingRow}>
      <Pressable accessibilityRole="button" accessibilityLabel="Indstil påmindelse om affald" style={s.settingInfo} onPress={() => { setAmount(String(preference.amount)); setUnit(preference.unit); setEditing(true); }}>
        <View style={s.settingIcon}><AppIcon name="trash-2" size={17} color={colors.primary} /></View>
        <View style={s.settingCopy}><Text style={s.settingTitle}>Affaldstømning</Text><Text style={s.settingText}>{preference.amount} {preference.unit === 'days' ? (preference.amount === 1 ? 'dag' : 'dage') : (preference.amount === 1 ? 'time' : 'timer')} før tømning</Text></View>
        <AppIcon name="chevron-right" size={18} color={colors.muted} />
      </Pressable>
      <Pressable accessibilityRole="switch" accessibilityLabel="Giv besked før affaldstømning" accessibilityState={{ checked: preference.enabled }} disabled={!ready || busy} onPress={() => void change(!preference.enabled)} style={s.switchHitArea}>
        <View style={[s.settingSwitch, preference.enabled && s.settingSwitchOn]}>{busy ? <ActivityIndicator size="small" color={colors.primary} /> : <View style={[s.settingSwitchThumb, preference.enabled && s.settingSwitchThumbOn]}><AppIcon name={preference.enabled ? 'check' : 'x'} size={14} color={preference.enabled ? colors.primary : colors.muted} /></View>}</View>
      </Pressable>
    </View>
    <Modal visible={editing} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditing(false)}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
        <ScrollView contentContainerStyle={{ padding: 24, gap: 20 }} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Text style={s.editorHeaderTitle}>Notifikation</Text><Pressable accessibilityRole="button" accessibilityLabel="Luk indstillinger" onPress={() => setEditing(false)} style={{ padding: 12 }}><AppIcon name="x" size={22} color={colors.ink} /></Pressable></View>
          <View style={s.editorIcon}><AppIcon name="trash-2" size={23} color={colors.primary} /></View>
          <Text style={s.editorTitle}>Husk affaldstømningen</Text>
          <Text style={s.editorDescription}>Vælg, hvor lang tid før tømning du vil have besked.</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>{(['hours', 'days'] as const).map(value => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: unit === value }} onPress={() => setUnit(value)} style={{ flex: 1, padding: 16, borderRadius: 12, alignItems: 'center', backgroundColor: unit === value ? colors.primary : colors.white }}><Text style={{ fontFamily: 'Nunito_700Bold', color: unit === value ? colors.white : colors.ink }}>{value === 'hours' ? 'Timer' : 'Dage'}</Text></Pressable>)}</View>
          <Text style={s.editorLabel}>TID FØR TØMNING</Text>
          <View style={s.thresholdField}><TextInput accessibilityLabel="Antal timer eller dage før tømning" keyboardType="number-pad" value={amount} onChangeText={setAmount} maxLength={3} selectTextOnFocus style={s.thresholdInput} /><Text style={s.thresholdUnit}>{unit === 'days' ? 'dage' : 'timer'}</Text></View>
          <Text style={s.editorHint}>Vælg 1–{unit === 'days' ? '7 dage' : '168 timer'}. Påmindelsen beregnes fra kl. 07 på tømningsdagen. Selve afhentningstidspunktet kan variere.</Text>
          <Text accessibilityLiveRegion="polite" style={s.editorHint}>{status}</Text>
          <Pressable accessibilityRole="button" disabled={!valid || !ready || busy} style={[s.editorSave, (!valid || !ready || busy) && { opacity: 0.4 }]} onPress={async () => { setBusy(true); try { await update({ ...preference, amount: Number(amount), unit }); setEditing(false); } finally { setBusy(false); } }}><Text style={s.editorSaveText}>Gem tidspunkt</Text></Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  </>;
}
