import { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppIcon } from './AppIcon';
import { colors } from '../styles/theme';
import type { useSmartThingsConnection } from '../hooks/useSmartThingsConnection';
import type { SmartThingsDevice } from '../services/smartthings';
import { applianceInfo, programLabel } from '../utils/applianceEnergy';

type Connection = ReturnType<typeof useSmartThingsConnection>;
const energyText = (info: ReturnType<typeof applianceInfo>) => info.estimate
  ? `${info.estimate.min.toLocaleString('da-DK', { maximumFractionDigits: 2 })}${info.estimate.max !== info.estimate.min ? `–${info.estimate.max.toLocaleString('da-DK', { maximumFractionDigits: 2 })}` : ''} kWh`
  : 'Intet estimat';
function powerStatus(device: SmartThingsDevice, component: string) {
  if (device.statusError) return 'Status utilgængelig';
  if (device.health === 'OFFLINE') return 'Offline';
  const value = device.status?.[component]?.switch?.switch?.value;
  return value === 'on' ? 'Tændt' : value === 'off' ? 'Slukket' : 'Status ukendt';
}
function confirm(title: string, message: string, action: () => void) {
  if (Platform.OS === 'web') { if (window.confirm(message)) action(); }
  else Alert.alert(title, message, [{ text: 'Annuller', style: 'cancel' }, { text: 'Bekræft', onPress: action }]);
}
export function SmartThingsEntry({ onOpen }: { onOpen: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel="Åbn SmartThings" onPress={onOpen} style={s.card}>
    <View style={s.row}><AppIcon name="home" size={26} color={colors.primary} /><View style={s.grow}><Text style={s.title}>SmartThings</Text><Text style={s.copy}>Dine apparater</Text></View><AppIcon name="chevron-right" size={20} color={colors.primary} /></View>
  </Pressable>;
}
export function ApplianceDetail({ device, component, connection, draft, onSelect }: { device: SmartThingsDevice; component: string; connection: Connection; draft: string; onSelect: (program: string) => void }) {
  const info = applianceInfo(device, component, draft || undefined);
  const reported = applianceInfo(device, component);
  const capabilities = device.components.find(c => c.id === component)?.capabilities ?? [];
  const value = device.status?.[component]?.switch?.switch?.value;
  const disabled = !!connection.pending || connection.connecting || connection.loading || device.statusError || device.health === 'OFFLINE';
  const current = !draft || draft === reported.program;
  const ready = ['Klar', 'Inaktiv', 'Færdig'].includes(reported.operation ?? '');
  const canStart = capabilities.includes('signalahead13665.startstopprogramv2') && current && !!reported.program && value === 'on' && ready;
  return <View style={s.detail}>
    <Text style={s.title}>{device.label}</Text>
    <Text style={s.copy}>{[device.manufacturer, device.model].filter(Boolean).join(' · ')}</Text>
    <Text style={s.power}>{powerStatus(device, component)}{!device.statusError && reported.operation ? ` · ${reported.operation}` : ''}</Text>
    <Text style={s.copy}>{current ? 'Valgt program' : 'Programvalg · ikke sendt endnu'}</Text><Text style={s.title}>{info.programName}</Text>
    <View style={s.energy}><Text style={s.power}>{energyText(info)}</Text><Text style={s.copy}>Estimeret {info.estimate?.period ?? 'forbrug'}</Text></View>
    {info.programIds.length ? <View style={s.programs}>{info.programIds.map(id => <Pressable key={id} accessibilityRole="radio" accessibilityLabel={programLabel(id)} accessibilityState={{ checked: info.program === id, disabled }} disabled={disabled} onPress={() => onSelect(id)} style={[s.program, info.program === id && s.selected]}><Text style={[s.buttonTextDark, s.grow]}>{programLabel(id)}</Text>{info.program === id ? <AppIcon name="check" size={18} color={colors.primary} /> : null}</Pressable>)}</View> : null}
    {!current && info.programCapability ? <Pressable accessibilityRole="button" disabled={disabled} style={[s.button, disabled && s.disabled]} onPress={() => void connection.setProgram(device.id, component, info.programCapability!, draft)}><Text style={s.buttonText}>Vælg program</Text></Pressable> : null}
    {capabilities.includes('switch') ? <View style={s.actions}>{(['on', 'off'] as const).map(command => <Pressable key={command} accessibilityRole="button" accessibilityLabel={`${command === 'on' ? 'Tænd' : 'Sluk'} ${device.label}`} accessibilityState={{ disabled: disabled || value === command }} disabled={disabled || value === command} style={[s.secondary, (disabled || value === command) && s.disabled]} onPress={() => void connection.setSwitch(device.id, component, command)}><Text style={s.buttonTextDark}>{command === 'on' ? 'Tænd' : 'Sluk'}</Text></Pressable>)}</View> : null}
    {capabilities.includes('signalahead13665.startstopprogramv2') ? <Pressable accessibilityRole="button" disabled={disabled || !canStart} accessibilityState={{ disabled: disabled || !canStart }} style={[s.button, (disabled || !canStart) && s.disabled]} onPress={() => confirm('Start program', `Start ${reported.programName} på ${device.label}?`, () => void connection.startProgram(device.id, component, reported.program!))}><Text style={s.buttonText}>Start program</Text></Pressable> : null}
    {!!connection.pending ? <ActivityIndicator color={colors.primary} /> : null}
    {connection.error ? <Text accessibilityRole="alert" style={s.error}>{connection.error}</Text> : null}
    {connection.notice ? <Text accessibilityLiveRegion="polite" style={s.copy}>{connection.notice}</Text> : null}
    {info.estimate ? <View style={s.explanation}><Text style={s.copy}>{info.estimate.basis}. {info.estimate.assumption} Ikke målt forbrug.</Text>{info.estimate.source ? <Pressable accessibilityRole="link" onPress={() => { void Linking.openURL(info.estimate!.source).catch(() => Alert.alert('Kilden kunne ikke åbnes')); }}><Text style={s.buttonTextDark}>Se kilde</Text></Pressable> : null}</View> : null}
    {reported.timestamp ? <Text style={s.copy}>Senest rapporteret: {new Date(reported.timestamp).toLocaleString('da-DK')}</Text> : null}
    <Pressable accessibilityRole="button" disabled={disabled} style={s.secondary} onPress={() => void connection.refresh()}><Text style={s.buttonTextDark}>Opdater status</Text></Pressable>
  </View>;
}
export function SmartThingsPage({ connection }: { connection: Connection }) {
  const { connected, devices, loading, connecting, pending, error } = connection;
  const [selection, setSelection] = useState<{ user: string; id: string; component: string; program: string } | null>(null);
  const locked = connecting || !!pending || loading;
  const selected = selection?.user === connection.user ? devices.find(d => d.id === selection.id) : undefined;
  return <View>
    <View style={s.heading}><Text style={s.pageTitle}>Dine apparater</Text><Pressable accessibilityRole="button" accessibilityLabel="Opdater SmartThings-status" disabled={locked} onPress={() => void connection.refresh()} style={s.refresh}>{loading ? <ActivityIndicator color={colors.primary} /> : <AppIcon name="refresh-cw" size={22} color={colors.primary} />}</Pressable></View>
    {!connected ? <Pressable accessibilityRole="button" disabled={locked} onPress={() => void connection.connect()} style={s.button}><Text style={s.buttonText}>{connecting ? 'Åbner…' : 'Forbind SmartThings'}</Text></Pressable> : null}
    {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
    {connected && !devices.length && !loading ? <Text style={s.copy}>Ingen apparater fundet.</Text> : null}
    {connection.truncated ? <Text style={s.copy}>De første 100 enheder vises.</Text> : null}
    {devices.flatMap(device => device.components.map(component => {
      const info = applianceInfo(device, component.id);
      return <Pressable key={`${device.id}:${component.id}`} accessibilityRole="button" accessibilityLabel={`Åbn ${device.label}${device.components.length > 1 ? ` ${component.label}` : ''}`} onPress={() => setSelection({ user: connection.user, id: device.id, component: component.id, program: info.program ?? info.programIds[0] ?? '' })} style={s.card}>
        <View style={s.row}><AppIcon name={['oven', 'microwave', 'airFryer'].includes(info.category) ? 'oven' : ['washer', 'dryer', 'washerDryer'].includes(info.category) ? 'washing-machine' : ['fridge', 'freezer'].includes(info.category) ? 'refrigerator' : info.category === 'dishwasher' ? 'droplet' : 'power'} size={28} color={colors.primary} /><View style={s.grow}><Text style={s.title}>{device.label}</Text><Text style={s.copy}>{info.kind}{device.components.length > 1 ? ` · ${component.label}` : ''}</Text></View><AppIcon name="chevron-right" size={20} color={colors.primary} /></View>
        <Text style={s.buttonTextDark}>{powerStatus(device, component.id)}{!device.statusError && info.operation ? ` · ${info.operation}` : ''}</Text>
        {info.program ? <Text style={s.copy}>{info.programName}</Text> : null}
        {info.estimate ? <View style={s.row}><AppIcon name="zap" size={16} color={colors.primary} /><Text style={s.copy}>Est. {energyText(info)} {info.estimate.period}</Text></View> : null}
      </Pressable>;
    }))}
    <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelection(null)} presentationStyle="pageSheet"><View style={s.modal}><View style={s.heading}><Text style={s.title}>Apparat</Text><Pressable accessibilityRole="button" accessibilityLabel="Luk apparat" onPress={() => setSelection(null)} style={s.refresh}><AppIcon name="x" size={24} color={colors.primary} /></Pressable></View><ScrollView contentContainerStyle={s.scroll}>{selected && selection ? <ApplianceDetail device={selected} component={selection.component} connection={connection} draft={selection.program} onSelect={program => setSelection({ ...selection, program })} /> : null}</ScrollView></View></Modal>
    {connected ? <Pressable accessibilityRole="button" disabled={locked} style={s.footer} onPress={() => confirm('Fjern forbindelse', 'Fjern den gemte SmartThings-forbindelse?', () => void connection.disconnect())}><Text style={s.copy}>Fjern forbindelse</Text></Pressable> : null}
  </View>;
}
const s = StyleSheet.create({
  grow: { flex: 1 }, row: { flexDirection: 'row', alignItems: 'center', gap: 12 }, heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  pageTitle: { fontFamily: 'Nunito_600SemiBold', fontSize: 28, color: colors.ink }, title: { fontFamily: 'Nunito_700Bold', fontSize: 18, color: colors.ink },
  copy: { fontFamily: 'Nunito_400Regular', fontSize: 14, lineHeight: 21, color: colors.muted }, power: { fontFamily: 'Nunito_700Bold', fontSize: 23, color: colors.ink },
  card: { backgroundColor: colors.white, borderRadius: 24, padding: 22, marginBottom: 16, gap: 10 }, detail: { gap: 14 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, button: { backgroundColor: colors.primary, borderRadius: 20, padding: 16, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontFamily: 'Nunito_700Bold', color: colors.white, fontSize: 15 }, buttonTextDark: { fontFamily: 'Nunito_700Bold', color: colors.primary, fontSize: 15 },
  secondary: { backgroundColor: colors.primarySoft, borderRadius: 20, padding: 16, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  error: { fontFamily: 'Nunito_400Regular', color: colors.error, fontSize: 14, marginBottom: 12 }, disabled: { opacity: 0.45 },
  energy: { backgroundColor: colors.primarySoft, borderRadius: 18, padding: 18, gap: 4 }, programs: { gap: 8 }, program: { borderWidth: 1, borderColor: colors.line, borderRadius: 16, minHeight: 48, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, selected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  modal: { flex: 1, backgroundColor: colors.paper, paddingTop: 48, paddingHorizontal: 24 }, scroll: { paddingBottom: 48 }, refresh: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }, footer: { minHeight: 48, alignItems: 'center', justifyContent: 'center' }, explanation: { gap: 8, paddingTop: 12 },
});
