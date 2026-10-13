import { AppIcon } from './AppIcon';
import { StatusBar } from 'expo-status-bar';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WasteReminderSetting } from './WasteReminderSetting';
import type { AddressSuggestion } from '../addresses';
import { useHouseholdSession } from '../hooks/useHouseholdSession';
import { useRememberedScroll } from '../hooks/useRememberedScroll';
import type { GridSupplier } from '../prices';
import { colors } from '../styles/theme';
import type { LowPriceAlertStatus } from '../hooks/useLowPriceAlert';
import type { HighPriceAlertStatus } from '../hooks/useHighPriceAlert';
import type { ConsumptionBudgetAlertStatus } from '../hooks/useConsumptionBudgetAlert';
import type { ChargingWindowAlertStatus } from '../hooks/useChargingWindowAlert';
import type { ConsumptionBudgetUnit } from '../services/low-price-alert';

type Props = {
  wasteReminder: ReturnType<typeof import('../hooks/useWasteReminder').useWasteReminder>;
  profileName: string;
  setProfileName: (value: string) => void;
  profileEmail: string;
  profileSaved: boolean;
  profileSaving: boolean;
  profileError: string;
  saveProfile: () => Promise<void> | void;
  address: string;
  setAddress: (value: string) => void;
  addressSelected: boolean;
  addressSuggestions: AddressSuggestion[];
  chooseAddress: (suggestion: AddressSuggestion) => Promise<void> | void;
  addressLookupLoading: boolean;
  addressError: string;
  selectedSupplier: GridSupplier;
  lowPriceAlerts: boolean;
  setLowPriceAlerts: (enabled: boolean) => Promise<void> | void;
  lowPriceAlertStatus: LowPriceAlertStatus;
  lowPriceAlertThresholdOre: number;
  setLowPriceAlertThresholdOre: (value: number) => Promise<void> | void;
  highPriceAlerts: boolean;
  setHighPriceAlerts: (enabled: boolean) => Promise<void> | void;
  highPriceAlertStatus: HighPriceAlertStatus;
  highPriceAlertThresholdOre: number;
  setHighPriceAlertThresholdOre: (value: number) => Promise<void> | void;
  consumptionBudgetAlerts: boolean;
  setConsumptionBudgetAlerts: (enabled: boolean) => Promise<void> | void;
  consumptionBudgetAlertStatus: ConsumptionBudgetAlertStatus;
  consumptionBudgetUnit: ConsumptionBudgetUnit;
  consumptionBudgetLimit: number;
  setConsumptionBudget: (unit: ConsumptionBudgetUnit, limit: number) => Promise<void> | void;
  chargingWindowAlerts: boolean;
  setChargingWindowAlerts: (enabled: boolean) => Promise<void> | void;
  chargingWindowAlertStatus: ChargingWindowAlertStatus;
  chargingDurationHours: number;
  chargingReadyByHour: number;
  setChargingWindow: (durationHours: number, readyByHour: number) => Promise<void> | void;
  monthlyEnergySummaryAlerts: boolean;
  setMonthlyEnergySummaryAlerts: (enabled: boolean) => Promise<void> | void;
  monthlyEnergySummaryHour: number;
  setMonthlyEnergySummary: (enabled: boolean, hour: number) => Promise<void> | void;
  navigation: ReactNode;
};

export function ProfilePage(props: Props) {
  const auth = useHouseholdSession();
  const household = auth.households.find(item => item.id === auth.householdId);
  const scroll = useRememberedScroll('profile');
  const addressInput = useRef<TextInput>(null);
  const addressTop = useRef(0);
  const accountTop = useRef(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [updatingPriceAlert, setUpdatingPriceAlert] = useState(false);
  const [editingAlert, setEditingAlert] = useState<'low' | 'high' | 'budget' | 'charging' | 'summary' | null>(null);
  const [budgetUnit, setBudgetUnit] = useState<ConsumptionBudgetUnit>('kwh');
  const [thresholdInput, setThresholdInput] = useState('');
  const [chargingReadyByInput, setChargingReadyByInput] = useState('');
  const [summaryHourInput, setSummaryHourInput] = useState('');
  const [thresholdError, setThresholdError] = useState('');

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const showField = (top: number) => {
    // Wait for the resized viewport on Android / keyboard animation on iOS.
    setTimeout(() => scroll.scrollRef.current?.scrollTo({ y: Math.max(0, top - 12), animated: true }), 250);
  };

  const lowPriceAlertText: Record<LowPriceAlertStatus, string> = {
    off: 'Når elprisen falder markant.',
    scheduled: 'Næste besked er planlagt.',
    'no-window': 'Venter på næste prisvindue.',
    'sample-prices': 'Henter aktuelle priser.',
    unsupported: 'Kun i mobilappen.',
    'development-build-required': 'Kræver en development build.',
    error: 'Tillad notifikationer i Indstillinger.',
  };
  const highPriceAlertText: Record<HighPriceAlertStatus, string> = {
    off: 'Når elprisen stiger markant.',
    scheduled: 'Næste besked er planlagt.',
    'no-rise': 'Ingen stor prisstigning lige nu.',
    'sample-prices': 'Henter aktuelle priser.',
    unsupported: 'Kun i mobilappen.',
    'development-build-required': 'Kræver en development build.',
    error: 'Tillad notifikationer i Indstillinger.',
  };
  const consumptionBudgetAlertText: Record<ConsumptionBudgetAlertStatus, string> = {
    off: 'Sæt en månedlig grænse i kWh eller kr.',
    watching: 'Vi følger dit forventede månedsforbrug.',
    'no-data': 'Afventer komplette målerdata.',
    'near-limit': 'Du nærmer dig din valgte grænse.',
    sent: 'En forbrugsadvarsel er sendt denne måned.',
    unsupported: 'Kun i mobilappen.',
    'development-build-required': 'Kræver en development build.',
    error: 'Tillad notifikationer i Indstillinger.',
  };
  const chargingWindowAlertText: Record<ChargingWindowAlertStatus, string> = {
    off: 'Find det billigste tidsrum til din elbil.',
    scheduled: 'Næste opladningsvindue er planlagt.',
    'no-window': 'Afventer priser for dit opladningsvindue.',
    'sample-prices': 'Henter aktuelle priser.',
    unsupported: 'Kun i mobilappen.',
    'development-build-required': 'Kræver en development build.',
    error: 'Tillad notifikationer i Indstillinger.',
  };

  const changeLowPriceAlerts = async (enabled: boolean) => {
    setUpdatingPriceAlert(true);
    try { await props.setLowPriceAlerts(enabled); }
    finally { setUpdatingPriceAlert(false); }
  };

  const changeHighPriceAlerts = async (enabled: boolean) => {
    setUpdatingPriceAlert(true);
    try { await props.setHighPriceAlerts(enabled); }
    finally { setUpdatingPriceAlert(false); }
  };
  const changeConsumptionBudgetAlerts = async (enabled: boolean) => {
    setUpdatingPriceAlert(true);
    try { await props.setConsumptionBudgetAlerts(enabled); }
    finally { setUpdatingPriceAlert(false); }
  };
  const changeChargingWindowAlerts = async (enabled: boolean) => {
    setUpdatingPriceAlert(true);
    try { await props.setChargingWindowAlerts(enabled); }
    finally { setUpdatingPriceAlert(false); }
  };
  const changeMonthlyEnergySummaryAlerts = async (enabled: boolean) => {
    setUpdatingPriceAlert(true);
    try { await props.setMonthlyEnergySummaryAlerts(enabled); }
    finally { setUpdatingPriceAlert(false); }
  };

  const openPriceAlertSettings = (type: 'low' | 'high' | 'budget' | 'charging' | 'summary') => {
    if (type === 'budget') {
      setBudgetUnit(props.consumptionBudgetUnit);
      setThresholdInput(String(props.consumptionBudgetLimit).replace('.', ','));
      setThresholdError('');
      setEditingAlert(type);
      return;
    }
    if (type === 'charging') {
      setThresholdInput(String(props.chargingDurationHours));
      setChargingReadyByInput(String(props.chargingReadyByHour).padStart(2, '0'));
      setThresholdError('');
      setEditingAlert(type);
      return;
    }
    if (type === 'summary') {
      setSummaryHourInput(String(props.monthlyEnergySummaryHour).padStart(2, '0'));
      setThresholdError('');
      setEditingAlert(type);
      return;
    }
    const ore = type === 'low' ? props.lowPriceAlertThresholdOre : props.highPriceAlertThresholdOre;
    setThresholdInput((ore / 100).toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    setThresholdError('');
    setEditingAlert(type);
  };

  const savePriceAlertSettings = async () => {
    if (!editingAlert) return;
    const krPerKwh = Number(thresholdInput.trim().replace(',', '.'));
    if (editingAlert === 'budget') {
      if (!Number.isFinite(krPerKwh) || krPerKwh < 1 || krPerKwh > 100000) {
        setThresholdError(`Vælg en grænse mellem 1 og 100.000 ${budgetUnit === 'kwh' ? 'kWh' : 'kr.'}.`);
        return;
      }
      await props.setConsumptionBudget(budgetUnit, Math.round(krPerKwh));
    } else if (editingAlert === 'summary') {
      const hour = Number(summaryHourInput.trim());
      if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
        setThresholdError('Vælg et tidspunkt fra 00 til 23.');
        return;
      }
      await props.setMonthlyEnergySummary(props.monthlyEnergySummaryAlerts, hour);
    } else if (editingAlert === 'charging') {
      const readyByHour = Number(chargingReadyByInput.trim());
      if (!Number.isInteger(krPerKwh) || krPerKwh < 1 || krPerKwh > 6) {
        setThresholdError('Vælg en ladetid fra 1 til 6 timer.');
        return;
      }
      if (!Number.isInteger(readyByHour) || readyByHour < 0 || readyByHour > 23) {
        setThresholdError('Vælg et tidspunkt fra 00 til 23.');
        return;
      }
      await props.setChargingWindow(krPerKwh, readyByHour);
    } else if (!Number.isFinite(krPerKwh) || krPerKwh < 0.25 || krPerKwh > 20) {
      setThresholdError('Vælg en pris mellem 0,25 og 20,00 kr./kWh.');
      return;
    } else if (editingAlert === 'low') await props.setLowPriceAlertThresholdOre(Math.round(krPerKwh * 100));
    else await props.setHighPriceAlertThresholdOre(Math.round(krPerKwh * 100));
    setEditingAlert(null);
  };

  return <SafeAreaView style={s.page} edges={['top']}>
    <StatusBar style="dark" />
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scroll.scrollRef} onLayout={scroll.onLayout} onContentSizeChange={scroll.onContentSizeChange} onScroll={scroll.onScroll}
        scrollEventThrottle={100} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={s.scroll}>
        <View style={s.content}>
          <View style={s.pageHeading}>
            <Text style={s.title}>Profil</Text>
            <Pressable accessibilityRole="button" disabled={signingOut} style={[s.signOutButton, signingOut && s.disabled]}
              onPress={async () => { setSigningOut(true); try { await auth.signOut(); } finally { setSigningOut(false); } }}>
              {signingOut ? <ActivityIndicator size="small" color={colors.primary} /> : <AppIcon name="log-out" size={18} color={colors.primary} />}
              <Text style={s.signOutText}>{signingOut ? 'Logger ud…' : 'Log ud'}</Text>
            </Pressable>
          </View>
          {auth.authError ? <Text accessibilityRole="alert" style={s.error}>{auth.authError}</Text> : null}

          <View style={s.hero}>
            <View style={s.heroIcon}><AppIcon name="home" size={25} color={colors.white} /></View>
            <View style={s.heroCopy}>
              <Text style={s.heroLabel}>DIN HUSSTAND</Text>
              <Text style={s.heroTitle} numberOfLines={2}>{household?.name || 'Mit hjem'}</Text>
              <Text style={s.heroMeta} numberOfLines={1}>{props.profileEmail || 'Logget ind'}</Text>
            </View>
            
          </View>

          <View onLayout={event => { addressTop.current = event.nativeEvent.layout.y; }} style={s.card}>
            <View style={s.cardHeading}>
              <View style={s.cardIcon}><AppIcon name="map-pin" size={20} color={colors.primary} /></View>
              <View style={s.cardHeadingCopy}><Text style={s.step}>01 · DIN ADRESSE</Text><Text style={s.cardTitle}>Hvor bor du?</Text></View>
            </View>
            <Text style={s.description}>Søg efter adressen, og vælg den fra listen for at finde det rigtige netselskab.</Text>
            <Text style={s.fieldLabel}>ADRESSE</Text>
            <View style={s.searchField}>
              <AppIcon name="search" size={18} color={colors.muted} />
              <TextInput ref={addressInput} accessibilityLabel="Søg efter adresse" autoComplete="street-address" autoCorrect={false}
                placeholder="Vejnavn og husnummer" placeholderTextColor={colors.muted} value={props.address} onChangeText={props.setAddress}
                onFocus={() => { setKeyboardVisible(true); showField(addressTop.current); }} onBlur={() => { if (Platform.OS === 'web') setKeyboardVisible(false); }}
                returnKeyType="search" style={s.addressInput} />
              {props.address ? <Pressable accessibilityRole="button" accessibilityLabel="Ryd adresse" onPress={() => { props.setAddress(''); addressInput.current?.focus(); }} hitSlop={10} style={s.clear}>
                <AppIcon name="x" size={17} color={colors.muted} />
              </Pressable> : null}
            </View>
            {props.addressSuggestions.length ? <View style={s.suggestions}>
              {props.addressSuggestions.map(suggestion => <Pressable key={suggestion.id} accessibilityRole="button" accessibilityLabel={`Vælg ${suggestion.text}`}
                onPress={() => { Keyboard.dismiss(); void props.chooseAddress(suggestion); }} style={s.suggestion}>
                <AppIcon name="map-pin" size={16} color={colors.primary} />
                <Text style={s.suggestionText}>{suggestion.text}</Text>
                <AppIcon name="chevron-right" size={17} color={colors.muted} />
              </Pressable>)}
            </View> : null}
            {!!props.address && !props.addressSelected && !props.addressSuggestions.length ? <Text style={s.hint}>Vælg en adresse fra listen for at gemme den.</Text> : null}
            {props.addressError ? <Text accessibilityRole="alert" style={s.error}>{props.addressError}</Text> : null}
            {props.addressSelected ? <View style={s.supplier}>
              <View style={s.supplierIcon}>{props.addressLookupLoading ? <ActivityIndicator size="small" color={colors.primary} /> : <AppIcon name="check" size={17} color={colors.primary} />}</View>
              <View style={s.supplierCopy}><Text style={s.supplierLabel}>{props.addressLookupLoading ? 'FINDER NETSELSKAB' : 'ADRESSE VALGT · NETSELSKAB'}</Text>
                <Text style={s.supplierName}>{props.addressLookupLoading ? 'Et øjeblik…' : props.selectedSupplier.name}</Text></View>
            </View> : null}
          </View>

          <View onLayout={event => { accountTop.current = event.nativeEvent.layout.y; }} style={s.card}>
            <View style={s.cardHeading}>
              <View style={s.cardIcon}><AppIcon name="user" size={20} color={colors.primary} /></View>
              <View style={s.cardHeadingCopy}><Text style={s.step}>02 · DINE OPLYSNINGER</Text><Text style={s.cardTitle}>Om dig</Text></View>
            </View>
            <Text style={s.fieldLabel}>NAVN</Text>
            <TextInput accessibilityLabel="Navn" autoComplete="name" placeholder="Dit navn" placeholderTextColor={colors.muted}
              value={props.profileName} onChangeText={props.setProfileName} onFocus={() => { setKeyboardVisible(true); showField(accountTop.current); }}
              onBlur={() => { if (Platform.OS === 'web') setKeyboardVisible(false); }} returnKeyType="done"
              style={s.textField} />
            <Text style={s.fieldLabel}>KONTOENS E-MAIL</Text>
            <View style={s.readonlyField}><AppIcon name="mail" size={17} color={colors.muted} /><Text selectable style={s.email}>{props.profileEmail || 'Ingen e-mail tilgængelig'}</Text></View>
            <Text style={s.helper}>E-mailen kommer fra din login-konto og kan ikke ændres her.</Text>
            {props.profileError ? <Text accessibilityRole="alert" style={s.error}>{props.profileError}</Text> : null}
            <Pressable accessibilityRole="button" disabled={props.profileSaving} onPress={() => void props.saveProfile()}
              style={[s.saveButton, props.profileSaving && s.disabled]}>
              {props.profileSaving ? <ActivityIndicator color={colors.white} size="small" /> : <AppIcon name={props.profileSaved ? 'check' : 'save'} size={17} color={colors.white} />}
              <Text style={s.saveText}>{props.profileSaved ? 'Gemt' : 'Gem oplysninger'}</Text>
            </Pressable>
          </View>

          <View style={s.settingsSection}>
            <Text style={s.settingsLabel}>NOTIFIKATIONER</Text>
            <WasteReminderSetting reminder={props.wasteReminder} styles={s} />
            <View style={s.settingGap} />
            <View style={[s.settingRow, updatingPriceAlert && s.settingRowDisabled]}>
              <Pressable accessibilityRole="button" accessibilityLabel="Indstil billig strøm" onPress={() => openPriceAlertSettings('low')} style={s.settingInfo}>
                <View style={s.settingIcon}><AppIcon name="zap" size={17} color={colors.primary} /></View>
                <View style={s.settingCopy}>
                  <Text style={s.settingTitle}>Billig strøm</Text>
                  <Text style={s.settingText}>{lowPriceAlertText[props.lowPriceAlertStatus]}</Text>
                </View>
                <AppIcon name="chevron-right" size={18} color={colors.muted} />
              </Pressable>
              <Pressable accessibilityRole="switch" accessibilityLabel="Giv besked ved billig strøm" accessibilityState={{ checked: props.lowPriceAlerts }}
                disabled={updatingPriceAlert} onPress={() => void changeLowPriceAlerts(!props.lowPriceAlerts)} style={s.switchHitArea}>
              <View style={[s.settingSwitch, props.lowPriceAlerts && s.settingSwitchOn]}>
                {updatingPriceAlert ? <ActivityIndicator size="small" color={props.lowPriceAlerts ? colors.white : colors.muted} /> : <View style={[s.settingSwitchThumb, props.lowPriceAlerts && s.settingSwitchThumbOn]}>
                  <AppIcon name={props.lowPriceAlerts ? 'check' : 'x'} size={14} color={props.lowPriceAlerts ? colors.primary : colors.muted} />
                </View>}
              </View>
              </Pressable>
            </View>
            <View style={s.settingGap} />
            <View style={[s.settingRow, updatingPriceAlert && s.settingRowDisabled]}>
              <Pressable accessibilityRole="button" accessibilityLabel="Indstil månedlig energioversigt" onPress={() => openPriceAlertSettings('summary')} style={s.settingInfo}>
                <View style={s.settingIcon}><AppIcon name="calendar" size={17} color={colors.primary} /></View>
                <View style={s.settingCopy}>
                  <Text style={s.settingTitle}>Månedlig energioversigt</Text>
                  <Text style={s.settingText}>Et samlet overblik én gang om måneden.</Text>
                </View>
                <AppIcon name="chevron-right" size={18} color={colors.muted} />
              </Pressable>
              <Pressable accessibilityRole="switch" accessibilityLabel="Giv besked med månedlig energioversigt" accessibilityState={{ checked: props.monthlyEnergySummaryAlerts }}
                disabled={updatingPriceAlert} onPress={() => void changeMonthlyEnergySummaryAlerts(!props.monthlyEnergySummaryAlerts)} style={s.switchHitArea}>
                <View style={[s.settingSwitch, props.monthlyEnergySummaryAlerts && s.settingSwitchOn]}>
                  {updatingPriceAlert ? <ActivityIndicator size="small" color={props.monthlyEnergySummaryAlerts ? colors.white : colors.muted} /> : <View style={[s.settingSwitchThumb, props.monthlyEnergySummaryAlerts && s.settingSwitchThumbOn]}>
                    <AppIcon name={props.monthlyEnergySummaryAlerts ? 'check' : 'x'} size={14} color={props.monthlyEnergySummaryAlerts ? colors.primary : colors.muted} />
                  </View>}
                </View>
              </Pressable>
            </View>
            <View style={s.settingGap} />
            <View style={[s.settingRow, updatingPriceAlert && s.settingRowDisabled]}>
              <Pressable accessibilityRole="button" accessibilityLabel="Indstil billigste opladning" onPress={() => openPriceAlertSettings('charging')} style={s.settingInfo}>
                <View style={s.settingIcon}><AppIcon name="battery-charging" size={17} color={colors.primary} /></View>
                <View style={s.settingCopy}>
                  <Text style={s.settingTitle}>Billigste opladning</Text>
                  <Text style={s.settingText}>{chargingWindowAlertText[props.chargingWindowAlertStatus]}</Text>
                </View>
                <AppIcon name="chevron-right" size={18} color={colors.muted} />
              </Pressable>
              <Pressable accessibilityRole="switch" accessibilityLabel="Giv besked om billigste opladning" accessibilityState={{ checked: props.chargingWindowAlerts }}
                disabled={updatingPriceAlert} onPress={() => void changeChargingWindowAlerts(!props.chargingWindowAlerts)} style={s.switchHitArea}>
                <View style={[s.settingSwitch, props.chargingWindowAlerts && s.settingSwitchOn]}>
                  {updatingPriceAlert ? <ActivityIndicator size="small" color={props.chargingWindowAlerts ? colors.white : colors.muted} /> : <View style={[s.settingSwitchThumb, props.chargingWindowAlerts && s.settingSwitchThumbOn]}>
                    <AppIcon name={props.chargingWindowAlerts ? 'check' : 'x'} size={14} color={props.chargingWindowAlerts ? colors.primary : colors.muted} />
                  </View>}
                </View>
              </Pressable>
            </View>
            <View style={s.settingGap} />
            <View style={[s.settingRow, updatingPriceAlert && s.settingRowDisabled]}>
              <Pressable accessibilityRole="button" accessibilityLabel="Indstil forbrugsgrænse" onPress={() => openPriceAlertSettings('budget')} style={s.settingInfo}>
                <View style={s.settingIcon}><AppIcon name="bar-chart-2" size={17} color={colors.primary} /></View>
                <View style={s.settingCopy}>
                  <Text style={s.settingTitle}>Forbrugsgrænse</Text>
                  <Text style={s.settingText}>{consumptionBudgetAlertText[props.consumptionBudgetAlertStatus]}</Text>
                </View>
                <AppIcon name="chevron-right" size={18} color={colors.muted} />
              </Pressable>
              <Pressable accessibilityRole="switch" accessibilityLabel="Giv besked om forbrugsgrænse" accessibilityState={{ checked: props.consumptionBudgetAlerts }}
                disabled={updatingPriceAlert} onPress={() => void changeConsumptionBudgetAlerts(!props.consumptionBudgetAlerts)} style={s.switchHitArea}>
                <View style={[s.settingSwitch, props.consumptionBudgetAlerts && s.settingSwitchOn]}>
                  {updatingPriceAlert ? <ActivityIndicator size="small" color={props.consumptionBudgetAlerts ? colors.white : colors.muted} /> : <View style={[s.settingSwitchThumb, props.consumptionBudgetAlerts && s.settingSwitchThumbOn]}>
                    <AppIcon name={props.consumptionBudgetAlerts ? 'check' : 'x'} size={14} color={props.consumptionBudgetAlerts ? colors.primary : colors.muted} />
                  </View>}
                </View>
              </Pressable>
            </View>
            <View style={s.settingGap} />
            <View style={[s.settingRow, updatingPriceAlert && s.settingRowDisabled]}>
              <Pressable accessibilityRole="button" accessibilityLabel="Indstil høj elpris" onPress={() => openPriceAlertSettings('high')} style={s.settingInfo}>
                <View style={s.settingIcon}><AppIcon name="trending-up" size={17} color={colors.primary} /></View>
                <View style={s.settingCopy}>
                  <Text style={s.settingTitle}>Høj elpris</Text>
                  <Text style={s.settingText}>{highPriceAlertText[props.highPriceAlertStatus]}</Text>
                </View>
                <AppIcon name="chevron-right" size={18} color={colors.muted} />
              </Pressable>
              <Pressable accessibilityRole="switch" accessibilityLabel="Giv besked før høj elpris" accessibilityState={{ checked: props.highPriceAlerts }}
                disabled={updatingPriceAlert} onPress={() => void changeHighPriceAlerts(!props.highPriceAlerts)} style={s.switchHitArea}>
              <View style={[s.settingSwitch, props.highPriceAlerts && s.settingSwitchOn]}>
                {updatingPriceAlert ? <ActivityIndicator size="small" color={props.highPriceAlerts ? colors.white : colors.muted} /> : <View style={[s.settingSwitchThumb, props.highPriceAlerts && s.settingSwitchThumbOn]}>
                  <AppIcon name={props.highPriceAlerts ? 'check' : 'x'} size={14} color={props.highPriceAlerts ? colors.primary : colors.muted} />
                </View>}
              </View>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    <Modal visible={editingAlert !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditingAlert(null)}>
      <SafeAreaView style={s.editorPage} edges={['top', 'bottom']}>
        <View style={s.editorHeader}>
          <Pressable accessibilityRole="button" accessibilityLabel="Luk" onPress={() => setEditingAlert(null)} style={s.editorClose}><AppIcon name="x" size={20} color={colors.ink} /></Pressable>
          <Text style={s.editorHeaderTitle}>Notifikation</Text>
          <View style={s.editorHeaderSpacer} />
        </View>
        <View style={s.editorContent}>
          <View style={s.editorIcon}><AppIcon name={editingAlert === 'low' ? 'zap' : editingAlert === 'high' ? 'trending-up' : editingAlert === 'charging' ? 'battery-charging' : editingAlert === 'summary' ? 'calendar' : 'bar-chart-2'} size={23} color={colors.primary} /></View>
          <Text style={s.editorTitle}>{editingAlert === 'low' ? 'Hvornår er strøm billig?' : editingAlert === 'high' ? 'Hvornår er strøm dyr?' : editingAlert === 'charging' ? 'Planlæg opladning' : editingAlert === 'summary' ? 'Månedlig energioversigt' : 'Vælg din forbrugsgrænse'}</Text>
          <Text style={s.editorDescription}>{editingAlert === 'low' ? 'Vi giver besked, når prisen er under din grænse.' : editingAlert === 'high' ? 'Vi giver besked før prisen stiger over din grænse.' : editingAlert === 'charging' ? 'Virker for alle elbiler. Vi finder det billigste sammenhængende tidsrum, så bilen er klar til dit valgte tidspunkt.' : editingAlert === 'summary' ? 'Vi sender et roligt overblik over den afsluttede måned, når leveringen er klar.' : 'Vi vurderer dit forventede forbrug for hele måneden.'}</Text>
          {editingAlert === 'budget' ? <View style={s.budgetChoices}>
            <Pressable accessibilityRole="button" accessibilityState={{ selected: budgetUnit === 'kwh' }} onPress={() => setBudgetUnit('kwh')} style={[s.budgetChoice, budgetUnit === 'kwh' && s.budgetChoiceSelected]}><Text style={[s.budgetChoiceText, budgetUnit === 'kwh' && s.budgetChoiceTextSelected]}>kWh</Text></Pressable>
            <Pressable accessibilityRole="button" accessibilityState={{ selected: budgetUnit === 'dkk' }} onPress={() => setBudgetUnit('dkk')} style={[s.budgetChoice, budgetUnit === 'dkk' && s.budgetChoiceSelected]}><Text style={[s.budgetChoiceText, budgetUnit === 'dkk' && s.budgetChoiceTextSelected]}>Kr.</Text></Pressable>
          </View> : null}
          {editingAlert !== 'summary' ? <><Text style={s.editorLabel}>{editingAlert === 'budget' ? 'MÅNEDLIG GRÆNSE' : editingAlert === 'charging' ? 'LADETID' : 'DIN PRISGRÆNSE'}</Text>
            <View style={s.thresholdField}>
              <TextInput accessibilityLabel={editingAlert === 'budget' ? 'Månedlig forbrugsgrænse' : editingAlert === 'charging' ? 'Ladetid i timer' : 'Prisgrænse i kr. pr. kWh'} value={thresholdInput} onChangeText={(value) => { setThresholdInput(value); setThresholdError(''); }} keyboardType="decimal-pad" selectTextOnFocus style={s.thresholdInput} />
              <Text style={s.thresholdUnit}>{editingAlert === 'budget' ? (budgetUnit === 'kwh' ? 'kWh' : 'kr.') : editingAlert === 'charging' ? 'timer' : 'kr./kWh'}</Text>
            </View></> : null}
          {editingAlert === 'charging' ? <><Text style={s.editorLabel}>BILEN SKAL VÆRE KLAR SENEST</Text><View style={s.thresholdField}>
            <TextInput accessibilityLabel="Bilen skal være klar senest" value={chargingReadyByInput} onChangeText={(value) => { setChargingReadyByInput(value); setThresholdError(''); }} keyboardType="number-pad" selectTextOnFocus style={s.thresholdInput} />
            <Text style={s.thresholdUnit}>kl.</Text>
          </View></> : null}
          {editingAlert === 'summary' ? <><Text style={s.editorLabel}>ØNSKET TIDSPUNKT</Text><View style={s.thresholdField}>
            <TextInput accessibilityLabel="Tidspunkt for månedlig energioversigt" value={summaryHourInput} onChangeText={(value) => { setSummaryHourInput(value); setThresholdError(''); }} keyboardType="number-pad" selectTextOnFocus style={s.thresholdInput} />
            <Text style={s.thresholdUnit}>kl.</Text>
          </View></> : null}
          {thresholdError ? <Text accessibilityRole="alert" style={s.error}>{thresholdError}</Text> : null}
          <Text style={s.editorHint}>{editingAlert === 'low' ? 'Standard er 1,50 kr./kWh.' : editingAlert === 'high' ? 'Standard er 2,50 kr./kWh.' : editingAlert === 'charging' ? 'Vælg fra 1 til 6 timer. Du behøver ikke at forbinde bilen til appen.' : editingAlert === 'summary' ? 'Vælg et tidspunkt fra 00 til 23. Oversigten kan først sendes, når baggrundslevering er implementeret.' : budgetUnit === 'kwh' ? 'Eksempel: 400 kWh om måneden.' : 'Prisen er et estimat baseret på de aktuelle elpriser.'}</Text>
          <Pressable accessibilityRole="button" onPress={() => void savePriceAlertSettings()} style={s.editorSave}><Text style={s.editorSaveText}>{editingAlert === 'budget' ? 'Gem forbrugsgrænse' : editingAlert === 'charging' ? 'Gem opladningsvindue' : editingAlert === 'summary' ? 'Gem tidspunkt' : 'Gem prisgrænse'}</Text></Pressable>
        </View>
      </SafeAreaView>
    </Modal>
    {!keyboardVisible ? props.navigation : null}
  </SafeAreaView>;
}

const s = StyleSheet.create({
  pageHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  signOutButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, borderRadius: 16, backgroundColor: colors.white },
  signOutText: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: colors.primary },
  flex: { flex: 1 },
  page: { flex: 1, backgroundColor: colors.paper },
  scroll: { flexGrow: 1, paddingBottom: 28 },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 22 },
  title: { fontFamily: 'Nunito_700Bold', fontSize: 31, lineHeight: 37, letterSpacing: -0.9, color: colors.ink, marginBottom: 18 },
  hero: { minHeight: 108, backgroundColor: colors.white, borderRadius: 24, padding: 24, flexDirection: 'row', alignItems: 'center', gap: 14, overflow: 'hidden', marginBottom: 24 },
  heroIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  heroCopy: { flex: 1, zIndex: 1 },
  heroLabel: { fontFamily: 'Nunito_700Bold', fontSize: 10, letterSpacing: 0.9, color: colors.muted },
  heroTitle: { fontFamily: 'Nunito_700Bold', fontSize: 19, letterSpacing: -0.3, color: colors.ink, marginTop: 3 },
  heroMeta: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: colors.muted, marginTop: 3 },
  heroCircle: { position: 'absolute', width: 160, height: 160, borderRadius: 80, right: -50, top: -40, backgroundColor: colors.primaryPressed, opacity: 0.45 },
  card: { backgroundColor: colors.white, borderRadius: 24, padding: 24, marginBottom: 24 },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardHeadingCopy: { flex: 1 },
  cardIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  step: { fontFamily: 'Nunito_700Bold', fontSize: 10, letterSpacing: 0.7, color: colors.primary },
  cardTitle: { fontFamily: 'Nunito_700Bold', fontSize: 20, letterSpacing: -0.4, color: colors.ink, marginTop: 2 },
  description: { fontFamily: 'Nunito_400Regular', fontSize: 13, lineHeight: 19, color: colors.muted, marginTop: 14 },
  fieldLabel: { fontFamily: 'Nunito_700Bold', fontSize: 10, letterSpacing: 0.6, color: colors.muted, marginTop: 18, marginBottom: 8 },
  searchField: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 15, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, paddingHorizontal: 14 },
  addressInput: { flex: 1, minWidth: 0, minHeight: 52, paddingVertical: 9, fontFamily: 'Nunito_500Medium', fontSize: 15, color: colors.ink },
  clear: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  suggestions: { marginTop: 8, borderWidth: 1, borderColor: colors.line, borderRadius: 15, overflow: 'hidden' },
  suggestion: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.white, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  suggestionText: { flex: 1, fontFamily: 'Nunito_500Medium', fontSize: 13, lineHeight: 18, color: colors.ink },
  hint: { fontFamily: 'Nunito_400Regular', fontSize: 11, color: colors.muted, marginTop: 9 },
  error: { fontFamily: 'Nunito_500Medium', fontSize: 12, lineHeight: 18, color: colors.coral, marginTop: 10 },
  supplier: { marginTop: 15, borderRadius: 16, backgroundColor: colors.primarySoft, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  supplierIcon: { width: 32, height: 32, borderRadius: 11, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  supplierCopy: { flex: 1 },
  supplierLabel: { fontFamily: 'Nunito_700Bold', fontSize: 9, letterSpacing: 0.6, color: colors.primaryPressed },
  supplierName: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: colors.ink, marginTop: 3 },
  textField: { minHeight: 52, borderRadius: 15, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, paddingHorizontal: 14, fontFamily: 'Nunito_500Medium', fontSize: 15, color: colors.ink },
  readonlyField: { minHeight: 52, borderRadius: 15, backgroundColor: colors.paper, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  email: { flex: 1, fontFamily: 'Nunito_500Medium', fontSize: 14, color: colors.ink },
  helper: { fontFamily: 'Nunito_400Regular', fontSize: 11, lineHeight: 16, color: colors.muted, marginTop: 7 },
  settingsSection: { marginBottom: 18 },
  settingsLabel: { fontFamily: 'Nunito_700Bold', fontSize: 10, letterSpacing: 0.8, color: colors.muted, marginLeft: 4, marginBottom: 8 },
  settingRow: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, backgroundColor: colors.white, paddingHorizontal: 16, paddingVertical: 14 },
  settingRowDisabled: { opacity: 0.72 },
  settingGap: { height: 10 },
  settingInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 },
  switchHitArea: { paddingVertical: 8, paddingLeft: 4 },
  settingIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  settingCopy: { flex: 1, minWidth: 0 },
  settingTitle: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: colors.ink },
  settingText: { fontFamily: 'Nunito_400Regular', fontSize: 11, lineHeight: 16, color: colors.muted, marginTop: 2 },
  settingSwitch: { width: 52, height: 32, padding: 3, borderRadius: 16, justifyContent: 'center', backgroundColor: colors.line },
  settingSwitchOn: { backgroundColor: colors.primary },
  settingSwitchThumb: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  settingSwitchThumbOn: { alignSelf: 'flex-end' },
  editorPage: { flex: 1, backgroundColor: colors.paper },
  editorHeader: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, backgroundColor: colors.white },
  editorClose: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper },
  editorHeaderTitle: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: colors.ink },
  editorHeaderSpacer: { width: 36 },
  editorContent: { flex: 1, paddingHorizontal: 24, paddingTop: 42 },
  editorIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  editorTitle: { fontFamily: 'Nunito_700Bold', fontSize: 27, lineHeight: 33, letterSpacing: -0.7, color: colors.ink, marginTop: 18 },
  editorDescription: { fontFamily: 'Nunito_400Regular', fontSize: 15, lineHeight: 22, color: colors.muted, marginTop: 8 },
  budgetChoices: { flexDirection: 'row', gap: 8, marginTop: 22 },
  budgetChoice: { minWidth: 80, minHeight: 42, paddingHorizontal: 16, borderRadius: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.white },
  budgetChoiceSelected: { backgroundColor: colors.primary },
  budgetChoiceText: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: colors.muted },
  budgetChoiceTextSelected: { color: colors.white },
  editorLabel: { fontFamily: 'Nunito_700Bold', fontSize: 10, letterSpacing: 0.8, color: colors.muted, marginTop: 32, marginBottom: 8 },
  thresholdField: { minHeight: 58, flexDirection: 'row', alignItems: 'center', borderRadius: 16, backgroundColor: colors.white, paddingHorizontal: 16 },
  thresholdInput: { flex: 1, minHeight: 54, fontFamily: 'Nunito_700Bold', fontSize: 21, color: colors.ink },
  thresholdUnit: { fontFamily: 'Nunito_500Medium', fontSize: 14, color: colors.muted },
  editorHint: { fontFamily: 'Nunito_400Regular', fontSize: 12, lineHeight: 18, color: colors.muted, marginTop: 9 },
  editorSave: { minHeight: 54, borderRadius: 17, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 28 },
  editorSaveText: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: colors.white },
  saveButton: { minHeight: 52, borderRadius: 16, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 20 },
  saveText: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: colors.white },
  disabled: { opacity: 0.6 },
});
