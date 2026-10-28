import {AppText as Text} from './AppText';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {cardStyles} from '../styles/cards';
import {AppModal as Modal} from './AppModal';
import {HapticPressable as Pressable} from './HapticPressable';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, StyleSheet, View } from 'react-native';
import { API_URL } from '../services/supabase';
import { colors } from '../styles/theme';
import { getCachedPhoto, photoCacheKey, readPhotoManifest, savePhotoManifest, type HomePhoto as Photo } from '../services/home-photo-cache';
const labels: Record<string, string> = { south: 'Syd', east: 'Øst', north: 'Nord', west: 'Vest', nadir: 'Ovenfra' };
export function HomePhotoGallery({ x, y, viewerUrl }: { x: number; y: number; viewerUrl: string }) {
  const insets=useSafeAreaInsets();
  const [photos, setPhotos] = useState<Photo[]>([]), [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(true), [failed, setFailed] = useState(false), [expanded, setExpanded] = useState(false), [refresh, setRefresh] = useState(0);
  const [uris, setUris] = useState<Record<string, string>>({}), [loaded, setLoaded] = useState('');
  const [fullSize, setFullSize] = useState({ width: 0, height: 0 });
  const params = new URLSearchParams({ mode: 'photos', x: String(x), y: String(y) });
  const endpoint = `${API_URL}/api/address/search?${params}`;
  const cacheKey = photoCacheKey(endpoint,x,y);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(() => controller.abort(), 25000);
    setLoading(true); setFailed(false); setPhotos([]); setUris({}); setLoaded(''); setSelected(0); setExpanded(false);
    let hasCached = false;
    const validPhotos = (items: Photo[]) => items.filter(photo => photo && Object.hasOwn(labels,photo.direction) && typeof photo.capturedAt === 'string' && Number.isFinite(Date.parse(photo.capturedAt)) && (!photo.marker || (Number.isFinite(photo.marker.x) && Number.isFinite(photo.marker.y) && photo.marker.x >= 0 && photo.marker.x <= 1 && photo.marker.y >= 0 && photo.marker.y <= 1)));
    void (async () => {
      const cached = await readPhotoManifest(cacheKey);
      if (!active) return;
      if (cached) { const valid = validPhotos(cached.photos); hasCached = valid.length > 0; setPhotos(valid); if (hasCached) setLoading(false); if (hasCached && refresh === 0 && Date.now()-cached.fetchedAt < 86400000) return; }
      const response = await fetch(`${endpoint}&v=2`, { signal: controller.signal, headers: { Accept: 'application/json' } });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.photos)) throw new Error();
      const valid = validPhotos(data.photos).map(photo => data.renderVersion === 2 ? photo : { ...photo, marker: undefined });
      if (active) setPhotos(valid);
      if (data.renderVersion === 2 && valid.length > 0) await savePhotoManifest(cacheKey, { photos: valid, fetchedAt: Date.now(), renderVersion: 2 });
    })().catch(() => { if (active && !hasCached) setFailed(true); }).finally(() => { clearTimeout(timer); if (active) setLoading(false); });
    return () => { active = false; controller.abort(); clearTimeout(timer); };
  }, [endpoint, refresh]);
  const photo = photos[selected];
  const assetKey = (item: Photo) => `${item.direction}:${item.capturedAt}`;
  const remoteUri = (item: Photo) => `${endpoint}&v=2&direction=${encodeURIComponent(item.direction)}`;
  const image = photo ? uris[assetKey(photo)] ?? '' : '';
  useEffect(() => {
    let active = true;
    // Selected image first, then the remaining directions; one disk download at
    // a time. Late results never update another address's gallery.
    const items = photo ? [photo,...photos.filter(item => item !== photo)] : [];
    void (async () => { for (const item of items) { if (!active) break; const uri = await getCachedPhoto(cacheKey,item,remoteUri(item)); if (active) setUris(current => ({ ...current, [assetKey(item)]: uri })); } })();
    return () => { active = false; };
  }, [photos, selected, endpoint]);
  const marker = photo?.marker;
  const pin = marker ? <View pointerEvents="none" style={[s.pin,{ left: `${marker.x*100}%`, top: `${marker.y*100}%` }]}><View style={s.pinDot} /></View> : null;
  const imageError = () => { if (photo && image.startsWith('file:')) setUris(current => ({ ...current, [assetKey(photo)]: remoteUri(photo) })); else setFailed(true); };
  return <View style={s.card}>
    {loading ? <View style={s.empty}><ActivityIndicator color={colors.primary} /><Text style={s.note}>Henter luftfotos…</Text></View> : photo && !failed ? <Pressable accessibilityRole="button" accessibilityLabel="Vis luftfoto og omtrentligt adressepunkt i fuld størrelse" disabled={!image || loaded !== image} onPress={() => setExpanded(true)} style={s.frame}>
      {image ? <Image key={image} source={{ uri: image }} resizeMode="contain" style={s.image} accessibilityLabel={`Luftfoto fra ${labels[photo.direction]}`} onLoad={() => setLoaded(image)} onError={imageError} /> : <View style={s.image} />}
      {image && loaded === image ? pin : <View style={s.imageLoading}><ActivityIndicator color={colors.primary} /></View>}
      {marker ? <View pointerEvents="none" style={s.badge}><View style={s.legendDot} /><Text style={s.badgeText}>Dit hjem · ca.</Text></View> : null}
    </Pressable> : <View style={s.empty}><Text style={s.note}>{failed ? 'Billeder kunne ikke hentes lige nu.' : 'Ingen luftfotos fundet ved adressen.'}</Text></View>}
    <View style={s.details}>
      <Text style={s.title}>Boligen fra oven</Text>
      {photos.length > 0 ? <View style={s.directions}>{photos.map((item, index) => <Pressable key={item.direction} accessibilityRole="button" accessibilityState={{ selected: selected === index }} onPress={() => { setSelected(index); setFailed(false); }} style={[s.chip, selected === index && s.chipSelected]}><Text style={[s.chipText, selected === index && s.chipTextSelected]}>{labels[item.direction]}</Text></Pressable>)}</View> : null}
      {photo ? <Text style={s.note}>Optaget {new Date(photo.capturedAt).toLocaleDateString('da-DK')} · © Klimadatastyrelsen</Text> : null}
      <Text style={s.note}>Prikken viser adressens omtrentlige placering — ikke skel. Billedet kan være flere år gammelt.</Text>
      <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(viewerUrl).catch(() => setFailed(true))} style={s.link}><Text style={s.action}>Zoom ind i den officielle fotoviser ↗</Text></Pressable>
      {failed ? <Pressable accessibilityRole="button" onPress={() => setRefresh(value => value+1)} style={s.link}><Text style={s.action}>Prøv igen</Text></Pressable> : null}
    </View>
    <Modal visible={expanded && !!photo} onRequestClose={() => setExpanded(false)} animationType="fade"><View style={[s.modal,{paddingTop:Math.max(insets.top,16),paddingBottom:Math.max(insets.bottom,16)}]}><Pressable accessibilityRole="button" onPress={() => setExpanded(false)} style={s.close}><Text style={s.action}>Luk</Text></Pressable><View style={s.fullStage} onLayout={event => setFullSize(event.nativeEvent.layout)}><View style={[s.frame,fullSize.width > 0 && fullSize.height > 0 ? { width: Math.min(fullSize.width,fullSize.height*4/3) } : null]}><Image source={{ uri: image }} resizeMode="contain" style={s.image} />{pin}</View></View><Text style={s.note}>Omtrentligt adressepunkt · © Klimadatastyrelsen</Text></View></Modal>
  </View>;
}
const s = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: 24, overflow: 'hidden' }, frame: { width: '100%', aspectRatio: 4/3, overflow: 'hidden', position: 'relative' }, image: { width: '100%', height: '100%', backgroundColor: colors.paper },
  imageLoading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  pin: { position: 'absolute', width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(224,53,63,0.2)', alignItems: 'center', justifyContent: 'center', transform: [{ translateX: -16 },{ translateY: -16 }] },
  pinDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#DF3543', borderWidth: 3, borderColor: '#FFFFFF' },
  badge: { position: 'absolute', left: 12, top: 12, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.94)' },
  legendDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#DF3543' }, badgeText: { fontFamily: 'Nunito_700Bold', color: colors.ink, fontSize:12 },
  details: { padding: 20, gap:16 }, title: cardStyles.title,
  note: { fontFamily: 'Nunito_400Regular', fontSize: 12, lineHeight: 18, color: colors.muted }, empty: { minHeight: 160, padding: 20, gap: 12, alignItems: 'center', justifyContent: 'center' },
  directions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { minHeight:48, paddingHorizontal: 14, borderRadius: 14, justifyContent: 'center', backgroundColor: colors.paper },
  chipSelected: { backgroundColor: colors.primary }, chipText: { fontFamily: 'Nunito_700Bold', color: colors.ink, fontSize: 13 }, chipTextSelected: { color: colors.white },
  link: { minHeight:48, justifyContent: 'center' }, action: { fontFamily: 'Nunito_700Bold', fontSize: 13, color: colors.primary },
  modal: { flex: 1, backgroundColor: colors.paper, padding: 24, paddingTop: 48 }, close: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-end', paddingHorizontal: 16 }, fullStage: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
