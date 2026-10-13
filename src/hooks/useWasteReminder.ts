import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useHouseholdSession } from './useHouseholdSession';
import { WasteEvent } from '../waste';
import { planWasteReminders } from '../services/waste-reminder-plan.mjs';

type Preference = { enabled: boolean; amount: number; unit: 'hours' | 'days' };
const defaults: Preference = { enabled: false, amount: 1, unit: 'days' };
let queue: Promise<unknown> = Promise.resolve();

export function useWasteReminder(events: WasteEvent[]) {
  const { session } = useHouseholdSession();
  const userId = session?.user.id;
  const key = `stromblik.waste-reminder.v1.${userId}`;
  const [preference, setPreference] = useState(defaults);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('');
  const generation = useRef(0);
  useEffect(() => {
    let active = true;
    setReady(false); setPreference(defaults);
    AsyncStorage.getItem(key).then(raw => {
      if (!active) return;
      const saved = raw ? JSON.parse(raw) : null;
      if (saved && typeof saved.enabled === 'boolean' && Number.isInteger(saved.amount) && saved.amount >= 1 && saved.amount <= (saved.unit === 'days' ? 7 : 168) && ['hours', 'days'].includes(saved.unit)) setPreference(saved);
      setReady(true);
    }).catch(() => { if (active) setStatus('Indstillingen kunne ikke indlæses.'); });
    return () => { active = false; };
  }, [key]);

  const update = async (next: Preference) => {
    if (!ready || !userId) return;
    try {
      if (next.enabled && Platform.OS !== 'web') {
        const notifications = await import('expo-notifications');
        const permission = await notifications.requestPermissionsAsync();
        if (!permission.granted) { setStatus('Tillad notifikationer i telefonens indstillinger.'); return; }
      }
      await AsyncStorage.setItem(key, JSON.stringify(next));
      setPreference(next);
    } catch { setStatus('Påmindelsen kunne ikke gemmes. Prøv igen.'); }
  };

  useEffect(() => {
    if (!ready) return;
    const version = ++generation.current;
    if (Platform.OS === 'web') {
      setStatus(preference.enabled ? 'Gemt. Påmindelser sendes fra mobilappen, når du også indstiller dem dér.' : 'Påmindelser er slået fra.');
      return;
    }
    queue = queue.catch(() => undefined).then(async () => {
      const notifications = await import('expo-notifications');
      if (version !== generation.current) return;
      const scheduled = await notifications.getAllScheduledNotificationsAsync();
      await Promise.all(scheduled.filter(item => item.content.data?.kind === 'waste-reminder').map(item => notifications.cancelScheduledNotificationAsync(item.identifier)));
      if (!preference.enabled || !userId) { setStatus('Påmindelser er slået fra.'); return; }
      const permission = await notifications.getPermissionsAsync();
      if (!permission.granted) { setStatus('Tillad notifikationer i telefonens indstillinger.'); return; }
      if (Platform.OS === 'android') await notifications.setNotificationChannelAsync('waste', { name: 'Affaldstømning', importance: notifications.AndroidImportance.DEFAULT });
      let count = 0;
      for (const { event, date } of planWasteReminders(events, preference.amount, preference.unit)) {
        if (version !== generation.current) break;
        await notifications.scheduleNotificationAsync({
          content: { title: 'Husk affaldet', body: `${event.title} tømmes ${new Date(`${event.date}T12:00:00`).toLocaleDateString('da-DK')}.`, data: { kind: 'waste-reminder', userId } },
          trigger: { type: notifications.SchedulableTriggerInputTypes.DATE, date, channelId: 'waste' },
        });
        count++;
      }
      if (version === generation.current) setStatus(count ? `${count} påmindelser planlagt på denne telefon.` : 'Ingen kommende tømninger at planlægge endnu.');
    }).catch(() => { if (version === generation.current) setStatus('Påmindelser kunne ikke planlægges. Prøv igen.'); });
    return () => { generation.current++; };
  }, [ready, preference, events, userId]);
  return { preference, update, status, ready };
}
