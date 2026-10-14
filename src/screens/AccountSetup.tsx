import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Image, Keyboard, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppIcon } from '../components/AppIcon';
import { ExistingAuthorizationHelp } from '../components/EncryptedEnergyControls';
import { useEnergyVault } from '../components/EnergyVaultGate';
import { useHouseholdSession } from '../hooks/useHouseholdSession';
import { usePowerSetup } from '../hooks/usePowerSetup';
import { hasPrivateHeatingConnection, syncHeating } from '../services/private-heating';
import { getSupabase } from '../services/supabase';
import { loadProfile } from '../services/storage';
import { findAddressGrid, isPreciseAddress, saveSetupProfile } from '../services/onboarding-profile';
import { resolveAddress, searchAddresses, type AddressSuggestion } from '../addresses';
import { colors } from '../styles/theme';
import { isEloverblikReturnUrl } from '../services/eloverblik-return';

const pages = [
  { title: 'Hvad\nhedder du?', description: 'Gør dit overblik personligt.', tint: '#F0ECFF', icon: 'user', image: require('../assets/onboarding-home.png') },
  { title: 'Find\ndit hjem.', description: 'Vælg din adresse, også etage og dør.', tint: colors.paper, icon: 'map-pin', image: require('../assets/onboarding-address.png') },
  { title: 'Følg din\nstrøm.', description: 'Se dit elforbrug. Forbind med MitID.', tint: '#E7EDFF', icon: 'zap', image: require('../assets/onboarding-electricity.png') },
  { title: 'Mærk\nvarmen.', description: 'Følg dit varmeforbrug med eForsyning.', tint: '#EEE9FA', icon: 'thermometer', image: require('../assets/onboarding-heat.png') },
  { title: 'Velkommen\nhjem.', description: 'Du kan altid tilføje mere senere.', tint: colors.primarySoft, icon: 'check', image: require('../assets/onboarding-home.png') },
] as const;

const introduction = [
  { title: 'Strøm på\ndet rette tidspunkt.', description: 'Find de gode timer, og følg dit elforbrug.', tint: '#E3EAFF', image: require('../assets/onboarding-electricity.png') },
  { title: 'Et varmt hjem.\nEt klart overblik.', description: 'Hold øje med varmen, helt enkelt.', tint: '#EEE7FA', image: require('../assets/onboarding-heat.png') },
  { title: 'Dit hjem.\nSamlet.', description: 'El, varme og affald. Ét sted.', tint: '#E5EAF9', image: require('../assets/onboarding-home.png') },
] as const;

export function AccountSetup({ onFinish, previewMode = false }: { onFinish: () => void; previewMode?: boolean }) {
  const vault = useEnergyVault(), auth = useHouseholdSession();
  const { height, width } = useWindowDimensions();
  const [viewport, setViewport] = useState({ width, height, top: 0 });
  const [step, setStep] = useState(1);
  const [intro, setIntro] = useState<number | null>(0);
  const power = usePowerSetup(vault, intro === null && step >= 3);
  const [first, setFirst] = useState(''), [last, setLast] = useState('');
  const [query, setQuery] = useState(''), [address, setAddress] = useState<AddressSuggestion | null>(null);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [grid, setGrid] = useState<{ id?: string; name: string }>();
  const [addressBusy, setAddressBusy] = useState(false), [addressError, setAddressError] = useState('');
  const [gridWarning, setGridWarning] = useState('');
  const [profileLoading, setProfileLoading] = useState(true), [profileError, setProfileError] = useState('');
  const [profileRetry, setProfileRetry] = useState(0);
  const [heat, setHeat] = useState<'loading' | 'ready' | 'done'>('loading');
  const [heatStatusError, setHeatStatusError] = useState(''), [heatRetry, setHeatRetry] = useState(0);
  const [heatWarning, setHeatWarning] = useState('');
  const [username, setUsername] = useState(''), [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [help, setHelp] = useState(false), [dontShow, setDontShow] = useState(!previewMode);
  const [reduceMotion, setReduceMotion] = useState(true);
  const entry = useRef(new Animated.Value(1)).current, float = useRef(new Animated.Value(0)).current;
  const heroEntry = useRef(new Animated.Value(1)).current;
  const addressSequence = useRef(0), actionLock = useRef(false), mounted = useRef(true);
  const scroll = useRef<ScrollView>(null);
  const formTop = useRef(0);
  const isIntro = intro !== null;
  const heatingEnabled = !isIntro && step >= 4;
  const page = isIntro ? introduction[intro] ?? introduction[0] : pages[step - 1] ?? pages[0];
  const locked = !isIntro && (busy || (step === 3 && power.busy));
  const compact = !isIntro && (height < 750 || step === 1 || step === 2 || step === 4);
  const heroHeight = isIntro ? Math.max(180, Math.min(height * 0.47, 410)) : compact ? 160 : Math.min(height * 0.37, 340);

  useEffect(() => {
    // Android can recreate the app while MitID/browser is open. Resume the
    // electricity step only after the saved required profile has been restored.
    if (profileLoading || profileError || !first.trim() || !last.trim() || !isPreciseAddress(address)) return;
    let active = true;
    const resume = (url: string) => {
      if (active && isEloverblikReturnUrl(url)) { setIntro(null); setStep(3); }
    };
    const subscription = Linking.addEventListener('url', event => resume(event.url));
    if (Platform.OS !== 'web') void Linking.getInitialURL().then(url => { if (url) resume(url); }).catch(() => {});
    return () => { active = false; subscription.remove(); };
  }, [profileLoading, profileError, first, last, address]);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; addressSequence.current++; }; }, []);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduceMotion(value); });
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { active = false; listener.remove(); };
  }, []);
  useEffect(() => {
    if (reduceMotion) { float.setValue(0); return; }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: 2500, useNativeDriver: true, isInteraction: false }),
      Animated.timing(float, { toValue: 0, duration: 2500, useNativeDriver: true, isInteraction: false }),
    ]));
    animation.start(); return () => animation.stop();
  }, [float, reduceMotion]);
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
    setError(''); entry.setValue(reduceMotion ? 1 : 0); heroEntry.setValue(reduceMotion ? 1 : 0);
    if (reduceMotion) return;
    const animation = Animated.parallel([
      Animated.timing(entry, { toValue: 1, duration: 360, delay: 70, useNativeDriver: true, isInteraction: false }),
      Animated.spring(heroEntry, { toValue: 1, damping: 20, stiffness: 120, mass: 0.8, useNativeDriver: true, isInteraction: false }),
    ]);
    animation.start(); return () => animation.stop();
  }, [step, intro, reduceMotion, entry, heroEntry]);
  const showFocusedForm = () => {
    // Wait for Android's resized window or iOS's keyboard animation before scrolling.
    setTimeout(() => scroll.current?.scrollTo({ y: Math.max(0, formTop.current - 12), animated: true }), 250);
  };
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const update = () => setViewport({ width: window.visualViewport?.width ?? window.innerWidth, height: window.visualViewport?.height ?? window.innerHeight, top: window.visualViewport?.offsetTop ?? 0 });
    const visual = window.visualViewport;
    update(); window.addEventListener('resize', update); visual?.addEventListener('resize', update); visual?.addEventListener('scroll', update);
    return () => { window.removeEventListener('resize', update); visual?.removeEventListener('resize', update); visual?.removeEventListener('scroll', update); };
  }, []);
  useEffect(() => {
    let active = true;
    setProfileLoading(true); setProfileError('');
    loadProfile(auth.session!.user.id, auth.session!.user.email).then(profile => {
      if (!active) return;
      const metadata = auth.session!.user.user_metadata;
      setFirst(profile?.firstName ?? metadata.given_name ?? profile?.name?.split(' ')[0] ?? '');
      setLast(profile?.lastName ?? metadata.family_name ?? profile?.name?.split(' ').slice(1).join(' ') ?? '');
      setQuery(profile?.address ?? '');
      const saved: AddressSuggestion | null = profile?.addressId ? { kind: 'address', id: profile.addressId, text: profile.address ?? '', x: profile.addressX, y: profile.addressY, municipalityCode: profile.municipalityCode, postcode: profile.postcode } : null;
      if (isPreciseAddress(saved)) { setAddress(saved); if (profile?.gridSupplierName) setGrid({ id: profile.gridSupplierId, name: profile.gridSupplierName }); }
    }).catch(() => { if (active) setProfileError('Din profil kunne ikke hentes. Prøv igen, før du fortsætter.'); })
      .finally(() => { if (active) setProfileLoading(false); });
    return () => { active = false; };
  }, [auth.session?.user.id, profileRetry]);
  useEffect(() => {
    if (!heatingEnabled) return;
    let active = true;
    setHeat('loading'); setHeatStatusError('');
    hasPrivateHeatingConnection(vault).then(connected => { if (active) setHeat(connected ? 'done' : 'ready'); })
      .catch(() => { if (active) { setHeat('ready'); setHeatStatusError('Varmeforbindelsen kunne ikke kontrolleres. Prøv igen.'); } });
    return () => { active = false; };
  }, [vault, heatingEnabled, heatRetry]);
  useEffect(() => {
    if (isIntro || step !== 2 || address || query.trim().length < 3) return;
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setAddressBusy(true);
      searchAddresses(query, controller.signal).then(items => {
        if (active) { setSuggestions(items); setAddressError(items.length ? '' : 'Ingen adresser fundet. Prøv med vejnavn, husnummer og postnummer.'); }
      }).catch(() => { if (active) setAddressError('Adresserne kunne ikke hentes. Ret søgningen og prøv igen.'); })
        .finally(() => { if (active) setAddressBusy(false); });
    }, 250);
    return () => { active = false; controller.abort(); clearTimeout(timer); };
  }, [query, address, step, isIntro]);

  function editAddress(value: string) { addressSequence.current++; setQuery(value); setAddress(null); setGrid(undefined); setSuggestions([]); setAddressBusy(false); setAddressError(''); setGridWarning(''); }
  async function chooseAddress(value: AddressSuggestion) {
    if (value.searchText) { editAddress(value.searchText); setAddressError(value.refinement === 'unit' ? 'Tilføj etage og dør for at vælge din præcise bolig.' : 'Tilføj husnummer, og vælg derefter din fulde adresse.'); return; }
    const id = ++addressSequence.current;
    setAddressBusy(true); setAddressError('');
    try {
      // A cached or older result can lack its coordinates. Complete it from its KDS ID
      // instead of making a valid visible address impossible to choose.
      const selected = isPreciseAddress(value) ? value : await resolveAddress(value.id, value.text);
      if (!isPreciseAddress(selected)) throw new Error('Adressen mangler stadig nødvendige oplysninger.');
      if (id !== addressSequence.current) return;
      setAddress(selected); setQuery(selected.text); setSuggestions([]); setGridWarning(''); setGrid(undefined);
      try {
        const found = await findAddressGrid(selected);
        if (id === addressSequence.current) { setGrid(found); if (!found.id) setGridWarning('Netselskabet er fundet, men dets tarif findes ikke i prislisten endnu.'); }
      } catch (cause) {
        if (id === addressSequence.current) setGridWarning(cause instanceof Error ? cause.message : 'Netselskabet kunne ikke findes.');
      }
    }
    catch (cause) { if (id === addressSequence.current) setAddressError(cause instanceof Error ? cause.message : 'Adressen kunne ikke vælges. Prøv igen.'); }
    finally { if (id === addressSequence.current) setAddressBusy(false); }
  }
  async function run(action: () => Promise<void>) {
    if (actionLock.current) return;
    actionLock.current = true; setBusy(true); setError('');
    try { await action(); } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : 'Noget gik galt. Prøv igen.'); }
    finally { actionLock.current = false; if (mounted.current) setBusy(false); }
  }
  async function next() {
    if (locked) return;
    if (intro !== null) { setIntro(intro < 2 ? intro + 1 : null); return; }
    if (step === 1 && (!first.trim() || !last.trim())) { setError('Udfyld både fornavn og efternavn.'); return; }
    if (step === 2) {
      if (!isPreciseAddress(address)) { setError('Vælg din fulde adresse fra listen.'); return; }
      await run(async () => { await saveSetupProfile(auth.session!.user.id, first, last, address, grid); if (mounted.current) setStep(3); });
    } else if (step === 5) {
      await run(async () => {
        const client = await getSupabase();
        const result = await client.auth.updateUser({ data: { onboarding_pending: false, onboarding_version: 2, onboarding_do_not_show_again: dontShow } });
        if (result.error) throw new Error('Opsætningen kunne ikke gemmes. Prøv igen.');
        onFinish();
      });
    } else setStep(current => current + 1);
  }
  const browserStyle = Platform.OS === 'web' ? { position: 'absolute' as const, top: viewport.top, left: 0, width: viewport.width, height: viewport.height } : undefined;
  const nextDisabled = !isIntro && (locked || (step === 1 && (profileLoading || !!profileError)) || (step === 2 && addressBusy));
  const canSkip = !isIntro && ((step === 3 && power.state !== 'done') || (step === 4 && heat !== 'done'));
  const nextLabel = isIntro ? intro === 2 ? 'Lad os komme i gang' : 'Næste' : step === 2 ? 'Gem mit hjem' : step === 5 ? 'Åbn mit overblik' : 'Fortsæt';
  function back() {
    if (locked) return;
    if (intro !== null) { if (intro > 0) setIntro(intro - 1); }
    else if (step === 1) setIntro(2);
    else setStep(step - 1);
  }

  return <Modal visible transparent animationType={reduceMotion ? 'none' : 'fade'} statusBarTranslucent onRequestClose={back}>
    <View style={[s.backdrop, { backgroundColor: page.tint }, browserStyle]}>
      <SafeAreaView style={s.safe}>
        <KeyboardAvoidingView style={s.page} behavior={Platform.select({ ios: 'padding', android: 'height' })}>
          <View style={s.top}>
            <View style={s.brand}>{!isIntro || intro > 0 ? <Pressable accessibilityRole="button" accessibilityLabel="Forrige trin" disabled={locked} onPress={back} style={s.backButton}><AppIcon name="arrow-left" size={22} color={colors.ink} /></Pressable> : <AppIcon name="home" size={24} color={colors.ink} />}<Text style={s.brandText}>strømblik</Text></View>
            {isIntro || canSkip ? <Pressable accessibilityRole="button" accessibilityLabel={isIntro ? 'Spring introduktion over' : 'Spring forbindelsen over'} disabled={locked} onPress={() => { if (isIntro) setIntro(null); else setStep(value => value + 1); }} style={s.quiet}><Text style={s.skipText}>Spring over</Text></Pressable> : <View style={s.topSpacer} />}
          </View>
          <ScrollView ref={scroll} style={s.scroll} contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
            <View style={s.body}>
              <Animated.View style={[s.hero, { height: heroHeight, opacity: heroEntry, transform: [{ translateY: heroEntry.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }, { scale: heroEntry.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] }]} accessible={false} importantForAccessibility="no-hide-descendants">
                <Animated.View style={[s.art, { transform: [{ translateY: float.interpolate({ inputRange: [0, 1], outputRange: [4, -7] }) }, { rotate: float.interpolate({ inputRange: [0, 1], outputRange: ['-0.7deg', '0.7deg'] }) }] }]}><Image source={page.image} resizeMode="contain" style={s.image} /></Animated.View>
              </Animated.View>
              <Animated.View style={{ opacity: entry, transform: [{ translateY: entry.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}>
              <Text accessibilityRole="header" style={[s.title, width < 380 && s.smallTitle]}>{!isIntro && step === 5 && first ? `Velkommen hjem,\n${first}.` : page.title}</Text>
              <Text style={s.description}>{page.description}</Text>

              {!isIntro && step === 1 ? <View onLayout={event => { formTop.current = event.nativeEvent.layout.y; }} style={s.form}>
                {profileLoading ? <ActivityIndicator color={colors.primary} /> : null}
                {profileError ? <><Text style={s.error}>{profileError}</Text><Pressable style={s.quiet} onPress={() => setProfileRetry(v => v + 1)}><Text style={s.link}>Prøv igen</Text></Pressable></> : null}
                <Text style={s.fieldLabel}>Fornavn</Text><TextInput accessibilityLabel="Fornavn" autoComplete="given-name" textContentType="givenName" autoCapitalize="words" autoCorrect={false} maxLength={80} value={first} onChangeText={setFirst} onFocus={showFocusedForm} editable={!locked && !profileLoading} style={s.input} placeholder="Dit fornavn" placeholderTextColor={colors.muted} />
                <Text style={s.fieldLabel}>Efternavn</Text><TextInput accessibilityLabel="Efternavn" autoComplete="family-name" textContentType="familyName" autoCapitalize="words" autoCorrect={false} maxLength={100} value={last} onChangeText={setLast} onFocus={showFocusedForm} editable={!locked && !profileLoading} style={s.input} placeholder="Dit efternavn" placeholderTextColor={colors.muted} />
              </View> : null}
              {!isIntro && step === 2 ? <View onLayout={event => { formTop.current = event.nativeEvent.layout.y; }} style={s.form}>
                <Text style={s.fieldLabel}>Din fulde adresse</Text><TextInput accessibilityLabel="Søg efter din fulde adresse" autoComplete="street-address" autoCorrect={false} value={query} onChangeText={editAddress} onFocus={showFocusedForm} editable={!locked} style={s.input} placeholder="Vej, husnummer, etage og dør" placeholderTextColor={colors.muted} />
                {addressBusy ? <View style={s.row}><ActivityIndicator color={colors.primary} /><Text style={s.caption}>{address ? 'Finder dit netselskab…' : 'Søger efter adresser…'}</Text></View> : null}
                {suggestions.map(item => <Pressable key={item.id} accessibilityRole="button" onPress={() => { Keyboard.dismiss(); void chooseAddress(item); }} style={s.suggestion}><AppIcon name="map-pin" size={20} color={colors.primary} /><Text style={s.suggestionText}>{item.searchText ? `${item.text} · ${item.refinement === 'unit' ? 'Vælg etage og dør' : 'Tilføj husnummer'}` : item.text}</Text><AppIcon name="chevron-right" size={18} color={colors.muted} /></Pressable>)}
                {addressError ? <Text style={s.error}>{addressError}</Text> : null}
                {address ? <View style={s.panel}><AppIcon name="check" size={22} color={colors.primary} /><View style={s.flex}><Text style={s.panelTitle}>{address.text}</Text><Text style={s.caption}>{grid?.name ? `Netselskab: ${grid.name}` : 'Adresse valgt'}</Text></View></View> : null}
                {gridWarning ? <><Text style={s.caption}>{gridWarning}</Text><Pressable disabled={addressBusy} style={s.quiet} onPress={() => address && void chooseAddress(address)}><Text style={s.link}>Prøv netselskab igen</Text></Pressable></> : null}
              </View> : null}
              {!isIntro && step === 3 ? <View style={s.form}>
                {power.state === 'done' ? <View style={s.panel}><AppIcon name="check" size={22} color={colors.primary} /><Text style={s.panelTitle}>Eloverblik er forbundet</Text></View> : <>
                  <Pressable accessibilityRole="button" disabled={locked || power.state === 'loading'} onPress={() => void (power.state === 'pending' ? power.check() : power.connect())} style={[s.action, (locked || power.state === 'loading') && s.disabled]}>{power.busy || power.state === 'loading' ? <ActivityIndicator color={colors.white} /> : <><Text style={s.actionText}>{power.state === 'pending' ? 'Kontrollér godkendelse' : 'Forbind med MitID'}</Text><AppIcon name="external-link" size={20} color={colors.white} /></>}</Pressable>
                  {power.state === 'pending' ? <Pressable disabled={locked} style={s.quiet} onPress={() => void power.connect()}><Text style={s.link}>Åbn Eloverblik igen</Text></Pressable> : null}
                </>}
                {power.message ? <Text accessibilityLiveRegion="polite" style={s.caption}>{power.message}</Text> : null}
                {power.error ? <><Text accessibilityRole="alert" style={s.error}>{power.error}</Text><Pressable disabled={locked} style={s.quiet} onPress={() => void power.check()}><Text style={s.link}>Kontrollér igen</Text></Pressable></> : null}
                <Pressable accessibilityRole="button" accessibilityState={{ expanded: help }} style={s.quiet} onPress={() => setHelp(v => !v)}><Text style={s.link}>Har du allerede givet fuldmagt?</Text></Pressable>
                {help ? <ExistingAuthorizationHelp /> : null}
              </View> : null}
              {!isIntro && step === 4 ? <View onLayout={event => { formTop.current = event.nativeEvent.layout.y; }} style={s.form}>
                {heatStatusError ? <><Text style={s.error}>{heatStatusError}</Text><Pressable onPress={() => setHeatRetry(value => value + 1)} style={s.quiet}><Text style={s.link}>Kontrollér forbindelse igen</Text></Pressable></> : null}
                {heatWarning ? <Text style={s.caption}>{heatWarning}</Text> : null}
                {heat === 'loading' ? <ActivityIndicator color={colors.primary} /> : heat === 'done' ? <View style={s.panel}><AppIcon name="check" size={22} color={colors.primary} /><Text style={s.panelTitle}>Sønderborg Varme er forbundet</Text></View> : <>
                  <View style={s.row}><AppIcon name="thermometer" size={20} color={colors.primary} /><Text style={s.caption}>Sønderborg Varme</Text></View>
                  <Text style={s.fieldLabel}>Kundenummer</Text><TextInput accessibilityLabel="Kundenummer til Sønderborg Varme" value={username} onChangeText={setUsername} onFocus={showFocusedForm} keyboardType="number-pad" autoCapitalize="none" autoCorrect={false} editable={!locked} style={s.input} placeholder="Fra din varmeregning" placeholderTextColor={colors.muted} />
                  <Text style={s.fieldLabel}>Kode fra varmeregningen</Text><TextInput accessibilityLabel="Kode fra varmeregningen" value={password} onChangeText={setPassword} onFocus={showFocusedForm} secureTextEntry autoCapitalize="none" autoCorrect={false} editable={!locked} style={s.input} placeholder="Din personlige kode" placeholderTextColor={colors.muted} />
                  <Pressable accessibilityRole="button" disabled={locked || !username.trim() || !password} onPress={() => void run(async () => { const result = await syncHeating(vault, { username: username.trim(), password }, true); if (mounted.current) { setHeat('done'); setHeatStatusError(''); setHeatWarning(result?.warning ?? ''); setPassword(''); } })} style={[s.action, (locked || !username.trim() || !password) && s.disabled]}>{busy ? <ActivityIndicator color={colors.white} /> : <Text style={s.actionText}>Forbind varme</Text>}</Pressable>
                </>}
              </View> : null}
              {!isIntro && step === 5 ? <View style={s.form}>
                {[[`${first} ${last}`, 'user'], [address?.text ?? '', 'map-pin'], [power.state === 'done' ? 'Elforbrug forbundet' : 'Elforbrug · kan tilføjes senere', 'zap'], [heat === 'done' ? 'Varme forbundet' : 'Varme · kan tilføjes senere', 'thermometer']].map(([text, icon]) => <View key={icon} style={s.summaryRow}><AppIcon name={icon as 'user'} size={22} color={colors.primary} /><Text style={s.suggestionText}>{text}</Text></View>)}
                {previewMode ? <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: dontShow }} onPress={() => setDontShow(v => !v)} style={s.summaryRow}><AppIcon name={dontShow ? 'check' : 'square'} size={22} color={colors.primary} /><Text style={s.caption}>Vis ikke opsætningen igen</Text></Pressable> : null}
              </View> : null}
              {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
              </Animated.View>
            </View>
          </ScrollView>
          <View style={s.footer}>
            <View style={s.footerRow}>
              <View style={s.dots} accessibilityLabel={isIntro ? `Introduktion ${intro + 1} af 3` : `Opsætning ${step} af 5`}>{Array.from({length: isIntro ? 3 : 5}, (_, i) => <View key={i} style={[s.dot, i === (isIntro ? intro : step - 1) && s.activeDot]} />)}</View>
              {!canSkip ? <Pressable accessibilityRole="button" accessibilityLabel={nextLabel} accessibilityState={{ disabled: nextDisabled, busy: !isIntro && busy }} disabled={nextDisabled} onPress={() => void next()} style={[s.nextButton, nextDisabled && s.disabled]}>
                <View pointerEvents="none" style={s.nextTopLine} /><View pointerEvents="none" style={s.nextBottomLine} />
                {!isIntro && busy ? <ActivityIndicator color={colors.primary} /> : <AppIcon name="chevron-right" size={23} color={colors.ink} />}
              </Pressable> : <View style={s.nextPlaceholder} />}
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  </Modal>;
}

const s = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center' }, safe: { flex: 1, width: '100%', alignItems: 'center' }, page: { flex: 1, width: '100%', maxWidth: 740, paddingHorizontal: 24 },
  top: { minHeight: 64, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, brand: { flexDirection: 'row', alignItems: 'center', gap: 9 }, brandText: { fontFamily: 'Nunito_700Bold', fontSize: 23, color: colors.ink }, backButton: { minHeight: 48, minWidth: 32, justifyContent: 'center' }, topSpacer: { width: 48 },
  scroll: { flex: 1 }, scrollContent: { flexGrow: 1, justifyContent: 'center', paddingBottom: 20 }, body: { width: '100%', maxWidth: 540, alignSelf: 'center' },
  hero: { width: '100%', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }, art: { width: '100%', height: '100%' }, image: { width: '100%', height: '100%' },
  title: { fontFamily: 'Nunito_700Bold', fontSize: 38, lineHeight: 43, letterSpacing: -1.3, color: colors.ink }, smallTitle: { fontSize: 32, lineHeight: 37 }, description: { fontFamily: 'Nunito_400Regular', fontSize: 16, lineHeight: 24, color: colors.ink, marginTop: 14 },
  form: { marginTop: 20, gap: 10 }, fieldLabel: { fontFamily: 'Nunito_700Bold', fontSize: 14, color: colors.ink, marginTop: 4 }, input: { minHeight: 54, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.white, fontFamily: 'Nunito_500Medium', fontSize: 16, color: colors.ink },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, minHeight: 56, backgroundColor: colors.white, borderRadius: 14 }, suggestionText: { flex: 1, fontFamily: 'Nunito_600SemiBold', fontSize: 15, lineHeight: 22, color: colors.ink },
  panel: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.8)' }, panelTitle: { fontFamily: 'Nunito_700Bold', fontSize: 15, color: colors.ink, flexShrink: 1 }, flex: { flex: 1 }, row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  caption: { fontFamily: 'Nunito_400Regular', fontSize: 13, lineHeight: 20, color: colors.muted }, error: { fontFamily: 'Nunito_600SemiBold', fontSize: 14, lineHeight: 22, color: colors.error, marginTop: 8 }, link: { fontFamily: 'Nunito_700Bold', color: colors.primary, fontSize: 14 }, quiet: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 6 },
  action: { minHeight: 56, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 20, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, actionText: { color: colors.white, fontSize: 16, fontFamily: 'Nunito_700Bold', flexShrink: 1 }, disabled: { opacity: 0.5 },
  skipText: { color: colors.ink, fontFamily: 'Nunito_400Regular', fontSize: 13 },
  nextButton: { width: 56, height: 56, borderRadius: 18, backgroundColor: colors.white, borderWidth: 1, borderColor: 'rgba(65,88,216,0.12)', alignItems: 'center', justifyContent: 'center' },
  nextTopLine: { position: 'absolute', right: 4, top: 4, width: 31, height: 37, borderTopWidth: 1.2, borderRightWidth: 1.2, borderTopRightRadius: 13, borderColor: 'rgba(65,88,216,0.38)' },
  nextBottomLine: { position: 'absolute', left: 4, bottom: 4, width: 31, height: 37, borderBottomWidth: 1.2, borderLeftWidth: 1.2, borderBottomLeftRadius: 13, borderColor: 'rgba(65,88,216,0.38)' },
  nextPlaceholder: { width: 56, height: 56 },
  footer: { paddingTop: 10, paddingBottom: 24, width: '100%', maxWidth: 540, alignSelf: 'center' }, footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, dots: { flexDirection: 'row', gap: 6 }, dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(60,50,70,0.18)' }, activeDot: { width: 24, backgroundColor: colors.primary }, summaryRow: { flexDirection: 'row', gap: 12, alignItems: 'center', minHeight: 48 },
});
