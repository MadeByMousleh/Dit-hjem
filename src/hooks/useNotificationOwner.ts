import {useSyncExternalStore} from 'react';
import {useHouseholdSession} from './useHouseholdSession';
import {getNotificationSession, subscribeNotificationSession} from '../services/notification-session';

export function useNotificationOwner() {
  const {session, householdId} = useHouseholdSession();
  const owner = useSyncExternalStore(subscribeNotificationSession, getNotificationSession, () => null);
  return owner?.userId === session?.user.id && owner?.householdId === householdId ? owner : null;
}
