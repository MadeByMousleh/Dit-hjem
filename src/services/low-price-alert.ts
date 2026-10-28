import { isRunningInExpoGo } from 'expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { PricePoint } from '../prices';
import type * as Notifications from 'expo-notifications';
import {getNotificationSession, isPrivateNotification, notificationBelongsTo, notificationOwnerKey, withNotificationSession, type NotificationOwner} from './notification-session';

export const LOW_PRICE_ALERT_THRESHOLD_ORE = 150;
export const HIGH_PRICE_ALERT_THRESHOLD_ORE = 250;
const ALERT_LEAD_MS = 15 * 60 * 1000;
const HIGH_ALERT_LEAD_MS = 30 * 60 * 1000;
const MIN_WINDOW_MS = 90 * 60 * 1000;
const UPCOMING_WINDOW_MS = 36 * 60 * 60 * 1000;
const HIGH_PRICE_LOOKAHEAD_MS = 3 * 60 * 60 * 1000;
const CHANNEL_ID = 'elpriser';
const ALERT_KIND = 'low-price-alert';
const HIGH_ALERT_KIND = 'high-price-alert';
const CONSUMPTION_ALERT_KIND = 'consumption-budget-alert';
const CHARGING_ALERT_KIND = 'charging-window-alert';
const CONSUMPTION_ALERT_KEY = 'stromblik.consumption-budget-alert.v1';
const PRICE_ALERT_SCHEDULE_KEY = 'stromblik.price-alert-schedule.v1';

export type LowPriceWindow = {
  startsAt: Date;
  endsAt: Date;
  lowestOrePerKwh: number;
  averageOrePerKwh: number;
};

export type LowPriceAlertSchedule = 'scheduled' | 'no-window' | 'unsupported';
export type HighPricePoint = { startsAt: Date; orePerKwh: number; currentOrePerKwh: number };
export type HighPriceAlertSchedule = 'scheduled' | 'no-rise' | 'unsupported';
export type ConsumptionBudgetUnit = 'kwh' | 'dkk';
export type ConsumptionBudgetProgress = { actual: number; forecast: number; percentage: number; level: '80' | '100' | null };
export type ChargingWindow = { startsAt: Date; endsAt: Date; averageOrePerKwh: number };
export type ChargingWindowAlertSchedule = 'scheduled' | 'no-window' | 'unsupported';
type NotificationModule = typeof Notifications;
type PriceAlertKind = typeof ALERT_KIND | typeof HIGH_ALERT_KIND | typeof CHARGING_ALERT_KIND;
type ScheduledPriceAlert = { day: string; identifier: string; triggerAt: number };
type PriceAlertContent = { title: string; body: string; data: { kind: PriceAlertKind; tab: 'home' | 'car' }; sound: 'default' };

export function localPriceAlertsSupported() {
  return Platform.OS !== 'web' && !isRunningInExpoGo();
}

async function notificationModule(): Promise<NotificationModule | null> {
  if (!localPriceAlertsSupported()) return null;
  return import('expo-notifications');
}

function validPoints(points: PricePoint[]) {
  return points
    .filter((point) => Number.isFinite(point.startsAt.getTime()) && Number.isFinite(point.totalOrePerKwh))
    .sort((left, right) => left.startsAt.getTime() - right.startsAt.getTime());
}

function stepMs(points: PricePoint[]) {
  const gaps = points.slice(1).map((point, index) => point.startsAt.getTime() - points[index]!.startsAt.getTime())
    .filter((gap) => gap > 0 && gap <= 2 * 60 * 60 * 1000)
    .sort((left, right) => left - right);
  return gaps.length ? gaps[Math.floor(gaps.length / 2)]! : 60 * 60 * 1000;
}

export function findLowPriceWindow(points: PricePoint[], now = Date.now(), thresholdOrePerKwh = LOW_PRICE_ALERT_THRESHOLD_ORE): LowPriceWindow | null {
  const firstEligible = now + ALERT_LEAD_MS;
  const upcoming = validPoints(points).filter((point) => point.startsAt.getTime() >= firstEligible && point.startsAt.getTime() <= now + UPCOMING_WINDOW_MS);
  const firstDay = upcoming.filter((point) => point.startsAt.getTime() < now + 24 * 60 * 60 * 1000);
  if (!upcoming.length || !firstDay.length || !Number.isFinite(thresholdOrePerKwh) || thresholdOrePerKwh <= 0) return null;

  const averageOrePerKwh = firstDay.reduce((sum, point) => sum + point.totalOrePerKwh, 0) / firstDay.length;
  const isLow = (point: PricePoint) => point.totalOrePerKwh <= thresholdOrePerKwh && point.totalOrePerKwh <= averageOrePerKwh * 0.8;
  const interval = stepMs(upcoming);

  for (let startIndex = 0; startIndex < upcoming.length; startIndex++) {
    const startPoint = upcoming[startIndex]!;
    if (!isLow(startPoint)) continue;
    let endIndex = startIndex;
    while (endIndex + 1 < upcoming.length && isLow(upcoming[endIndex + 1]!)
      && upcoming[endIndex + 1]!.startsAt.getTime() - upcoming[endIndex]!.startsAt.getTime() <= interval * 1.1) endIndex++;
    const startsAt = startPoint.startsAt;
    const endsAt = new Date(upcoming[endIndex]!.startsAt.getTime() + interval);
    if (endsAt.getTime() - startsAt.getTime() < MIN_WINDOW_MS) continue;
    return {
      startsAt,
      endsAt,
      lowestOrePerKwh: Math.min(...upcoming.slice(startIndex, endIndex + 1).map((point) => point.totalOrePerKwh)),
      averageOrePerKwh,
    };
  }
  return null;
}

export function findHighPricePoint(points: PricePoint[], now = Date.now(), thresholdOrePerKwh = HIGH_PRICE_ALERT_THRESHOLD_ORE): HighPricePoint | null {
  const ordered = validPoints(points);
  const current = [...ordered].reverse().find((point) => point.startsAt.getTime() <= now && point.startsAt.getTime() > now - 2 * 60 * 60 * 1000);
  if (!current || !Number.isFinite(thresholdOrePerKwh) || thresholdOrePerKwh <= 0) return null;
  const next = ordered.find((point) => point.startsAt.getTime() >= now + HIGH_ALERT_LEAD_MS
    && point.startsAt.getTime() <= now + HIGH_PRICE_LOOKAHEAD_MS
    && point.totalOrePerKwh >= thresholdOrePerKwh
    && point.totalOrePerKwh >= current.totalOrePerKwh * 1.3);
  return next ? { startsAt: next.startsAt, orePerKwh: next.totalOrePerKwh, currentOrePerKwh: current.totalOrePerKwh } : null;
}

export function findBestChargingWindow(points: PricePoint[], now = Date.now(), durationHours = 4, readyByHour = 7): ChargingWindow | null {
  if (!Number.isInteger(durationHours) || durationHours < 1 || durationHours > 6 || !Number.isInteger(readyByHour) || readyByHour < 0 || readyByHour > 23) return null;
  const startsAfter = now + ALERT_LEAD_MS;
  const deadline = new Date(now);
  deadline.setHours(readyByHour, 0, 0, 0);
  if (deadline.getTime() <= startsAfter) deadline.setDate(deadline.getDate() + 1);
  const durationMs = durationHours * 60 * 60 * 1000;
  const ordered = validPoints(points).filter(point => point.startsAt.getTime() >= startsAfter && point.startsAt.getTime() < deadline.getTime());
  const interval = stepMs(ordered);
  let best: ChargingWindow | null = null;

  for (let start = 0; start < ordered.length; start++) {
    const startsAt = ordered[start]!.startsAt;
    const endsAt = new Date(startsAt.getTime() + durationMs);
    if (endsAt.getTime() > deadline.getTime()) continue;
    const window = ordered.filter(point => point.startsAt.getTime() >= startsAt.getTime() && point.startsAt.getTime() < endsAt.getTime());
    if (!window.length || window[0]!.startsAt.getTime() !== startsAt.getTime()
      || window[window.length - 1]!.startsAt.getTime() + interval < endsAt.getTime()
      || window.some((point, index) => index > 0 && point.startsAt.getTime() - window[index - 1]!.startsAt.getTime() > interval * 1.1)) continue;
    const averageOrePerKwh = window.reduce((sum, point) => sum + point.totalOrePerKwh, 0) / window.length;
    if (!best || averageOrePerKwh < best.averageOrePerKwh) best = { startsAt, endsAt, averageOrePerKwh };
  }
  return best;
}

export function consumptionBudgetProgress({ dailyKwh, daysElapsed, daysInMonth, unit, limit, estimatedOrePerKwh }: {
  dailyKwh: number[]; daysElapsed: number; daysInMonth: number; unit: ConsumptionBudgetUnit; limit: number; estimatedOrePerKwh: number;
}): ConsumptionBudgetProgress | null {
  if (!Number.isFinite(limit) || limit <= 0 || !Number.isFinite(daysElapsed) || daysElapsed < 1 || !Number.isFinite(daysInMonth) || daysInMonth < daysElapsed) return null;
  const kwh = dailyKwh.filter(value => Number.isFinite(value) && value >= 0).reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(kwh) || (unit === 'dkk' && (!Number.isFinite(estimatedOrePerKwh) || estimatedOrePerKwh < 0))) return null;
  const actual = unit === 'dkk' ? kwh * estimatedOrePerKwh / 100 : kwh;
  const forecast = actual / daysElapsed * daysInMonth;
  const percentage = forecast / limit * 100;
  return { actual, forecast, percentage, level: percentage >= 100 ? '100' : percentage >= 80 ? '80' : null };
}

function time(value: Date) {
  return new Intl.DateTimeFormat('da-DK', { hour: '2-digit', minute: '2-digit', hour12: false }).format(value);
}

function price(ore: number) {
  return `${(ore / 100).toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr./kWh`;
}

// The phone's local calendar day is the boundary users expect for alerts.
export function priceAlertDay(value: number) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function scheduleKey(kind: PriceAlertKind, owner: NotificationOwner) { return `${PRICE_ALERT_SCHEDULE_KEY}.v2.${notificationOwnerKey(owner)}.${kind}`; }

function readScheduledPriceAlert(value: string | null): ScheduledPriceAlert | null {
  try {
    const parsed = JSON.parse(value ?? 'null');
    return typeof parsed?.day === 'string' && typeof parsed.identifier === 'string' && Number.isFinite(parsed.triggerAt) ? parsed : null;
  } catch { return null; }
}

async function cancelScheduledPriceAlerts(owner: NotificationOwner, kind: PriceAlertKind) {
  await withNotificationSession(owner, async notifications => {
    const requests = await notifications.getAllScheduledNotificationsAsync();
    await Promise.all(requests.filter(request => request.content.data?.kind === kind && notificationBelongsTo(request.content.data, owner)).map(request => notifications.cancelScheduledNotificationAsync(request.identifier)));
    const presented = await notifications.getPresentedNotificationsAsync();
    await Promise.all(presented.filter(item => item.request.content.data?.kind === kind && notificationBelongsTo(item.request.content.data, owner)).map(item => notifications.dismissNotificationAsync(item.request.identifier)));
  });
}

async function schedulePriceAlert(owner: NotificationOwner, kind: PriceAlertKind, triggerAt: number, content: PriceAlertContent) {
  await withNotificationSession(owner, async (notifications, valid) => {
    const day = priceAlertDay(triggerAt);
    const previous = readScheduledPriceAlert(await AsyncStorage.getItem(scheduleKey(kind, owner)));
    const requests = await notifications.getAllScheduledNotificationsAsync();
    if (!valid()) return;
    const sameKind = requests.filter(request => request.content.data?.kind === kind && notificationBelongsTo(request.content.data, owner));
    const pendingForDay = sameKind.some((request) => request.identifier === previous?.identifier || request.content.data?.alertDay === day);

    // A delivered notification no longer appears in Expo's scheduled list. Its
    // marker prevents another copy of the same price alert later that day.
    if (previous?.day === day && previous.triggerAt <= Date.now() && !pendingForDay) return;

    await Promise.all(sameKind.map((request) => notifications.cancelScheduledNotificationAsync(request.identifier)));
    await prepareChannel(notifications);
    if (!valid()) return;
    const identifier = await notifications.scheduleNotificationAsync({
      content: { ...content, data: { ...content.data, userId: owner.userId, householdId: owner.householdId, alertDay: day } },
      trigger: { type: notifications.SchedulableTriggerInputTypes.DATE, date: triggerAt, channelId: CHANNEL_ID },
    });
    if (!valid()) { await notifications.cancelScheduledNotificationAsync(identifier); await notifications.dismissNotificationAsync(identifier); return; }
    if (valid()) await AsyncStorage.setItem(scheduleKey(kind, owner), JSON.stringify({ day, identifier, triggerAt }));
  });
}

async function prepareChannel(notifications: NotificationModule) {
  if (Platform.OS !== 'android') return;
  await notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Elpriser',
    importance: notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 120],
    lightColor: '#147A62',
  });
}

function permissionAllowed(status: Notifications.NotificationPermissionsStatus, notifications: NotificationModule) {
  return status.granted || status.ios?.status === notifications.IosAuthorizationStatus.PROVISIONAL;
}

export async function requestLowPriceAlertPermission() {
  const notifications = await notificationModule();
  if (!notifications) return false;
  await prepareChannel(notifications);
  const current = await notifications.getPermissionsAsync();
  if (permissionAllowed(current, notifications)) return true;
  const requested = await notifications.requestPermissionsAsync();
  return permissionAllowed(requested, notifications);
}

export const requestPriceAlertPermission = requestLowPriceAlertPermission;

export async function cancelLowPriceAlerts(owner: NotificationOwner) {
  await cancelScheduledPriceAlerts(owner, ALERT_KIND);
}

export async function scheduleLowPriceAlert(owner: NotificationOwner, points: PricePoint[], thresholdOrePerKwh = LOW_PRICE_ALERT_THRESHOLD_ORE): Promise<LowPriceAlertSchedule> {
  const notifications = await notificationModule();
  if (!notifications) return 'unsupported';
  const window = findLowPriceWindow(points, Date.now(), thresholdOrePerKwh);
  if (!window) { await cancelLowPriceAlerts(owner); return 'no-window'; }

  const triggerAt = window.startsAt.getTime() - ALERT_LEAD_MS;
  if (triggerAt <= Date.now()) return 'no-window';
  await schedulePriceAlert(owner, ALERT_KIND, triggerAt, {
      title: 'Billig strøm på vej',
      body: `Fra kl. ${time(window.startsAt)} til ${time(window.endsAt)} er strømmen ned til ${price(window.lowestOrePerKwh)}.`,
      data: { kind: ALERT_KIND, tab: 'home' },
      sound: 'default',
  });
  return 'scheduled';
}

export async function cancelHighPriceAlerts(owner: NotificationOwner) {
  await cancelScheduledPriceAlerts(owner, HIGH_ALERT_KIND);
}

export async function scheduleHighPriceAlert(owner: NotificationOwner, points: PricePoint[], thresholdOrePerKwh = HIGH_PRICE_ALERT_THRESHOLD_ORE): Promise<HighPriceAlertSchedule> {
  const notifications = await notificationModule();
  if (!notifications) return 'unsupported';
  const point = findHighPricePoint(points, Date.now(), thresholdOrePerKwh);
  if (!point) { await cancelHighPriceAlerts(owner); return 'no-rise'; }

  const triggerAt = point.startsAt.getTime() - HIGH_ALERT_LEAD_MS;
  if (triggerAt <= Date.now()) return 'no-rise';
  await schedulePriceAlert(owner, HIGH_ALERT_KIND, triggerAt, {
      title: 'Elprisen stiger snart',
      body: `Kl. ${time(point.startsAt)} stiger strømmen til ${price(point.orePerKwh)}. Brug strøm inden da, hvis det passer dig.`,
      data: { kind: HIGH_ALERT_KIND, tab: 'home' },
      sound: 'default',
  });
  return 'scheduled';
}

export async function cancelChargingWindowAlerts(owner: NotificationOwner) {
  await cancelScheduledPriceAlerts(owner, CHARGING_ALERT_KIND);
}

export async function scheduleChargingWindowAlert(owner: NotificationOwner, points: PricePoint[], durationHours = 4, readyByHour = 7): Promise<ChargingWindowAlertSchedule> {
  const notifications = await notificationModule();
  if (!notifications) return 'unsupported';
  const window = findBestChargingWindow(points, Date.now(), durationHours, readyByHour);
  if (!window) { await cancelChargingWindowAlerts(owner); return 'no-window'; }
  const triggerAt = window.startsAt.getTime() - ALERT_LEAD_MS;
  if (triggerAt <= Date.now()) return 'no-window';
  await schedulePriceAlert(owner, CHARGING_ALERT_KIND, triggerAt, {
      title: 'Dit billigste opladningsvindue',
      body: `Oplad fra kl. ${time(window.startsAt)} til ${time(window.endsAt)}. Gennemsnitsprisen er ${price(window.averageOrePerKwh)}.`,
      data: { kind: CHARGING_ALERT_KIND, tab: 'car' },
      sound: 'default',
  });
  return 'scheduled';
}

export async function sendConsumptionBudgetAlert({ owner, progress, unit, limit, monthKey }: { owner: NotificationOwner; progress: ConsumptionBudgetProgress; unit: ConsumptionBudgetUnit; limit: number; monthKey: string }): Promise<'sent' | 'not-needed' | 'already-sent' | 'unsupported'> {
  if (!progress.level) return 'not-needed';
  return await withNotificationSession(owner, async (notifications, valid) => {
  const dedupeKey = `${CONSUMPTION_ALERT_KEY}.v2.${notificationOwnerKey(owner)}.${monthKey}.${unit}.${limit}.${progress.level}`;
  if (await AsyncStorage.getItem(dedupeKey)) return 'already-sent';
  await prepareChannel(notifications);
  if (!valid()) return 'unsupported';
  const unitLabel = unit === 'dkk' ? 'kr.' : 'kWh';
  const forecast = Math.round(progress.forecast).toLocaleString('da-DK');
  const limitLabel = Math.round(limit).toLocaleString('da-DK');
  const identifier = await notifications.scheduleNotificationAsync({
    content: {
      title: progress.level === '100' ? 'Dit elbudget er ved at blive overskredet' : 'Du nærmer dig dit elbudget',
      body: `Dit forventede månedsforbrug er ${forecast} ${unitLabel} mod din grænse på ${limitLabel} ${unitLabel}.`,
      data: { kind: CONSUMPTION_ALERT_KIND, tab: 'home', userId: owner.userId, householdId: owner.householdId },
      sound: 'default',
    },
    trigger: null,
  });
  if (!valid()) { await notifications.cancelScheduledNotificationAsync(identifier); await notifications.dismissNotificationAsync(identifier); return 'unsupported'; }
  if (valid()) await AsyncStorage.setItem(dedupeKey, new Date().toISOString());
  return 'sent' as const;
  }) ?? 'unsupported';
}

export async function configureLowPriceAlertPresentation() {
  const notifications = await notificationModule();
  if (!notifications) return;
  notifications.setNotificationHandler({
    handleNotification: async notification => {
      const data = notification.request.content.data;
      const allowed = !isPrivateNotification(data) || notificationBelongsTo(data, getNotificationSession());
      return {shouldPlaySound: allowed, shouldSetBadge: false, shouldShowBanner: allowed, shouldShowList: allowed};
    },
  });
}
