import {isRunningInExpoGo} from 'expo';
import {Platform} from 'react-native';
import type * as Notifications from 'expo-notifications';

export type NotificationOwner = Readonly<{userId: string; householdId: string}>;
export const privateNotificationKinds = new Set(['low-price-alert', 'high-price-alert', 'charging-window-alert', 'consumption-budget-alert', 'waste-reminder']);
let current: NotificationOwner | null = null;
let queue: Promise<unknown> = Promise.resolve();
const listeners = new Set<() => void>();
export const subscribeNotificationSession = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const getNotificationSession = () => current;
export const notificationOwnerKey = (owner: NotificationOwner) => `${encodeURIComponent(owner.userId)}.${encodeURIComponent(owner.householdId)}`;
export const notificationBelongsTo = (data: Record<string, unknown> | undefined | null, owner: NotificationOwner | null) => !!owner && data?.userId === owner.userId && data?.householdId === owner.householdId;
export const isPrivateNotification = (data: Record<string, unknown> | undefined | null) => typeof data?.kind === 'string' && privateNotificationKinds.has(data.kind);
function serial<T>(action: () => Promise<T>): Promise<T> {
  const next = queue.catch(() => undefined).then(action);
  queue = next;
  // A caller may deliberately schedule cleanup without awaiting it.
  void next.catch(() => undefined);
  return next;
}
async function moduleForDevice() {
  return Platform.OS === 'web' || isRunningInExpoGo() ? null : import('expo-notifications');
}
async function cleanForeign(notifications: typeof Notifications) {
  const scheduled = await notifications.getAllScheduledNotificationsAsync();
  for (const item of scheduled) if (isPrivateNotification(item.content.data) && !notificationBelongsTo(item.content.data, current)) await notifications.cancelScheduledNotificationAsync(item.identifier);
  const presented = await notifications.getPresentedNotificationsAsync();
  for (const item of presented) if (isPrivateNotification(item.request.content.data) && !notificationBelongsTo(item.request.content.data, current)) await notifications.dismissNotificationAsync(item.request.identifier);
  const response = await notifications.getLastNotificationResponseAsync();
  if (response && isPrivateNotification(response.notification.request.content.data) && !notificationBelongsTo(response.notification.request.content.data, current)) await notifications.clearLastNotificationResponseAsync();
}
export function setNotificationSession(userId?: string, householdId?: string) {
  if (current?.userId === userId && current?.householdId === householdId) return current;
  current = userId && householdId ? Object.freeze({userId, householdId}) : null;
  for (const listener of listeners) listener();
  void serial(async () => { const notifications = await moduleForDevice(); if (notifications) await cleanForeign(notifications); });
  return current;
}
export function clearNotificationSession(): Promise<void> {
  current = null;
  for (const listener of listeners) listener();
  return serial(async () => { const notifications = await moduleForDevice(); if (notifications) await cleanForeign(notifications); });
}
/** All native writes share this queue. A stale session token never becomes current again. */
export function withNotificationSession<T>(owner: NotificationOwner, action: (notifications: typeof Notifications, isCurrent: () => boolean) => Promise<T>): Promise<T | undefined> {
  return serial(async () => {
    const valid = () => current === owner;
    if (!valid()) return undefined;
    const notifications = await moduleForDevice();
    if (!notifications || !valid()) return undefined;
    // Retry cleanup here as well: failed cleanup must not allow new private writes.
    await cleanForeign(notifications);
    if (!valid()) return undefined;
    try { return await action(notifications, valid); }
    finally { if (!valid()) await cleanForeign(notifications); }
  });
}
