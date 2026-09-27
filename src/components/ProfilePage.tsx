import { Feather } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AddressSuggestion } from '../addresses';
import { useHouseholdSession } from '../hooks/useHouseholdSession';
import { useRememberedScroll } from '../hooks/useRememberedScroll';
import type { GridSupplier } from '../prices';
import { colors } from '../styles/theme';

type Props = {
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

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const showField = (top: number) => {
    // Wait for the resized viewport on Android / keyboard animation on iOS.
    setTimeout(() => scroll.scrollRef.current?.scrollTo({ y: Math.max(0, top - 12), animated: true }), 250);
  };

  return <SafeAreaView style={s.page} edges={['top']}>
    <StatusBar style="dark" />
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scroll.scrollRef} onLayout={scroll.onLayout} onContentSizeChange={scroll.onContentSizeChange} onScroll={scroll.onScroll}
        scrollEventThrottle={100} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={s.scroll}>
        <View style={s.content}>
          <Text style={s.eyebrow}>STRØMBLIK · MIN PROFIL</Text>
          <Text style={s.title}>Dit hjem, dine valg</Text>
          <Text style={s.intro}>Tilføj din adresse, så vi kan vise oplysninger, der passer til dit hjem.</Text>

          <View style={s.hero}>
            <View style={s.heroIcon}><Feather name="home" size={25} color={colors.white} /></View>
            <View style={s.heroCopy}>
              <Text style={s.heroLabel}>DIN HUSSTAND</Text>
              <Text style={s.heroTitle} numberOfLines={2}>{household?.name || 'Mit hjem'}</Text>
              <Text style={s.heroMeta} numberOfLines={1}>{props.profileEmail || 'Logget ind'}</Text>
            </View>
            <View style={s.heroCircle} />
          </View>

          <View onLayout={event => { addressTop.current = event.nativeEvent.layout.y; }} style={s.card}>
            <View style={s.cardHeading}>
              <View style={s.cardIcon}><Feather name="map-pin" size={20} color={colors.primary} /></View>
              <View style={s.cardHeadingCopy}><Text style={s.step}>01 · DIN ADRESSE</Text><Text style={s.cardTitle}>Hvor bor du?</Text></View>
            </View>
            <Text style={s.description}>Søg efter adressen, og vælg den fra listen for at finde det rigtige netselskab.</Text>
            <Text style={s.fieldLabel}>ADRESSE</Text>
            <View style={s.searchField}>
              <Feather name="search" size={18} color={colors.muted} />
              <TextInput ref={addressInput} accessibilityLabel="Søg efter adresse" autoComplete="street-address" autoCorrect={false}
                placeholder="Vejnavn og husnummer" placeholderTextColor={colors.muted} value={props.address} onChangeText={props.setAddress}
                onFocus={() => { setKeyboardVisible(true); showField(addressTop.current); }} onBlur={() => { if (Platform.OS === 'web') setKeyboardVisible(false); }}
                returnKeyType="search" style={s.addressInput} />
              {props.address ? <Pressable accessibilityRole="button" accessibilityLabel="Ryd adresse" onPress={() => { props.setAddress(''); addressInput.current?.focus(); }} hitSlop={10} style={s.clear}>
                <Feather name="x" size={17} color={colors.muted} />
              </Pressable> : null}
            </View>
            {props.addressSuggestions.length ? <View style={s.suggestions}>
              {props.addressSuggestions.map(suggestion => <Pressable key={suggestion.id} accessibilityRole="button" accessibilityLabel={`Vælg ${suggestion.text}`}
                onPress={() => { Keyboard.dismiss(); void props.chooseAddress(suggestion); }} style={s.suggestion}>
                <Feather name="map-pin" size={16} color={colors.primary} />
                <Text style={s.suggestionText}>{suggestion.text}</Text>
                <Feather name="chevron-right" size={17} color={colors.muted} />
              </Pressable>)}
            </View> : null}
            {!!props.address && !props.addressSelected && !props.addressSuggestions.length ? <Text style={s.hint}>Vælg en adresse fra listen for at gemme den.</Text> : null}
            {props.addressError ? <Text accessibilityRole="alert" style={s.error}>{props.addressError}</Text> : null}
            {props.addressSelected ? <View style={s.supplier}>
              <View style={s.supplierIcon}>{props.addressLookupLoading ? <ActivityIndicator size="small" color={colors.primary} /> : <Feather name="check" size={17} color={colors.primary} />}</View>
              <View style={s.supplierCopy}><Text style={s.supplierLabel}>{props.addressLookupLoading ? 'FINDER NETSELSKAB' : 'ADRESSE VALGT · NETSELSKAB'}</Text>
                <Text style={s.supplierName}>{props.addressLookupLoading ? 'Et øjeblik…' : props.selectedSupplier.name}</Text></View>
            </View> : null}
          </View>

          <View onLayout={event => { accountTop.current = event.nativeEvent.layout.y; }} style={s.card}>
            <View style={s.cardHeading}>
              <View style={s.cardIcon}><Feather name="user" size={20} color={colors.primary} /></View>
              <View style={s.cardHeadingCopy}><Text style={s.step}>02 · DINE OPLYSNINGER</Text><Text style={s.cardTitle}>Om dig</Text></View>
            </View>
            <Text style={s.fieldLabel}>NAVN</Text>
            <TextInput accessibilityLabel="Navn" autoComplete="name" placeholder="Dit navn" placeholderTextColor={colors.muted}
              value={props.profileName} onChangeText={props.setProfileName} onFocus={() => { setKeyboardVisible(true); showField(accountTop.current); }}
              onBlur={() => { if (Platform.OS === 'web') setKeyboardVisible(false); }} returnKeyType="done"
              style={s.textField} />
            <Text style={s.fieldLabel}>KONTOENS E-MAIL</Text>
            <View style={s.readonlyField}><Feather name="mail" size={17} color={colors.muted} /><Text selectable style={s.email}>{props.profileEmail || 'Ingen e-mail tilgængelig'}</Text></View>
            <Text style={s.helper}>E-mailen kommer fra din login-konto og kan ikke ændres her.</Text>
            {props.profileError ? <Text accessibilityRole="alert" style={s.error}>{props.profileError}</Text> : null}
            <Pressable accessibilityRole="button" disabled={props.profileSaving} onPress={() => void props.saveProfile()}
              style={[s.saveButton, props.profileSaving && s.disabled]}>
              {props.profileSaving ? <ActivityIndicator color={colors.white} size="small" /> : <Feather name={props.profileSaved ? 'check' : 'save'} size={17} color={colors.white} />}
              <Text style={s.saveText}>{props.profileSaved ? 'Gemt' : 'Gem oplysninger'}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
    {!keyboardVisible ? props.navigation : null}
  </SafeAreaView>;
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  page: { flex: 1, backgroundColor: colors.paper },
  scroll: { flexGrow: 1, paddingBottom: 28 },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 22 },
  eyebrow: { fontFamily: 'DMSans_700Bold', fontSize: 10, letterSpacing: 1.1, color: colors.primary },
  title: { fontFamily: 'DMSans_700Bold', fontSize: 31, lineHeight: 37, letterSpacing: -0.9, color: colors.ink, marginTop: 6 },
  intro: { fontFamily: 'DMSans_400Regular', fontSize: 14, lineHeight: 21, color: colors.muted, marginTop: 8, marginBottom: 20 },
  hero: { minHeight: 108, backgroundColor: colors.navy, borderRadius: 20, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 14, overflow: 'hidden', marginBottom: 18 },
  heroIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  heroCopy: { flex: 1, zIndex: 1 },
  heroLabel: { fontFamily: 'DMSans_700Bold', fontSize: 10, letterSpacing: 0.9, color: colors.mint },
  heroTitle: { fontFamily: 'DMSans_700Bold', fontSize: 19, letterSpacing: -0.3, color: colors.white, marginTop: 3 },
  heroMeta: { fontFamily: 'DMSans_400Regular', fontSize: 11, color: colors.mint, marginTop: 3 },
  heroCircle: { position: 'absolute', width: 160, height: 160, borderRadius: 80, right: -50, top: -40, backgroundColor: colors.primaryPressed, opacity: 0.45 },
  card: { backgroundColor: colors.white, borderRadius: 20, padding: 20, marginBottom: 18 },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardHeadingCopy: { flex: 1 },
  cardIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  step: { fontFamily: 'DMSans_700Bold', fontSize: 10, letterSpacing: 0.7, color: colors.primary },
  cardTitle: { fontFamily: 'DMSans_700Bold', fontSize: 20, letterSpacing: -0.4, color: colors.ink, marginTop: 2 },
  description: { fontFamily: 'DMSans_400Regular', fontSize: 13, lineHeight: 19, color: colors.muted, marginTop: 14 },
  fieldLabel: { fontFamily: 'DMSans_700Bold', fontSize: 10, letterSpacing: 0.6, color: colors.muted, marginTop: 18, marginBottom: 8 },
  searchField: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 15, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, paddingHorizontal: 14 },
  addressInput: { flex: 1, minWidth: 0, minHeight: 52, paddingVertical: 9, fontFamily: 'DMSans_500Medium', fontSize: 15, color: colors.ink },
  clear: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  suggestions: { marginTop: 8, borderWidth: 1, borderColor: colors.line, borderRadius: 15, overflow: 'hidden' },
  suggestion: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.white, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  suggestionText: { flex: 1, fontFamily: 'DMSans_500Medium', fontSize: 13, lineHeight: 18, color: colors.ink },
  hint: { fontFamily: 'DMSans_400Regular', fontSize: 11, color: colors.muted, marginTop: 9 },
  error: { fontFamily: 'DMSans_500Medium', fontSize: 12, lineHeight: 18, color: colors.coral, marginTop: 10 },
  supplier: { marginTop: 15, borderRadius: 16, backgroundColor: colors.primarySoft, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  supplierIcon: { width: 32, height: 32, borderRadius: 11, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  supplierCopy: { flex: 1 },
  supplierLabel: { fontFamily: 'DMSans_700Bold', fontSize: 9, letterSpacing: 0.6, color: colors.primaryPressed },
  supplierName: { fontFamily: 'DMSans_700Bold', fontSize: 13, color: colors.ink, marginTop: 3 },
  textField: { minHeight: 52, borderRadius: 15, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, paddingHorizontal: 14, fontFamily: 'DMSans_500Medium', fontSize: 15, color: colors.ink },
  readonlyField: { minHeight: 52, borderRadius: 15, backgroundColor: colors.paper, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  email: { flex: 1, fontFamily: 'DMSans_500Medium', fontSize: 14, color: colors.ink },
  helper: { fontFamily: 'DMSans_400Regular', fontSize: 11, lineHeight: 16, color: colors.muted, marginTop: 7 },
  saveButton: { minHeight: 52, borderRadius: 16, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 20 },
  saveText: { fontFamily: 'DMSans_700Bold', fontSize: 14, color: colors.white },
  disabled: { opacity: 0.6 },
});
