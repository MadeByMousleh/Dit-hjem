import AsyncStorage from "@react-native-async-storage/async-storage";
import { HouseholdDevice } from "../types/app";

export const DEVICES_STORAGE_KEY = "stromblik.household-devices.v1";
export const PROFILE_STORAGE_KEY = "stromblik.profile.v1";

export type StoredProfile = {
  name?: string;
  email?: string;
  address?: string;
  municipalityCode?: string;
  postcode?: string;
  wasteCalendarUrl?: string;
  wasteShowOnDashboard?: boolean;
  teslaShowOnDashboard?: boolean;
};

export async function loadProfile() {
  const stored = await AsyncStorage.getItem(PROFILE_STORAGE_KEY);
  return stored ? JSON.parse(stored) as StoredProfile : undefined;
}

export async function saveProfile(profile: StoredProfile) {
  await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
}

export async function updateProfile(changes: Partial<StoredProfile>) {
  await AsyncStorage.mergeItem(PROFILE_STORAGE_KEY, JSON.stringify(changes));
}

export async function loadDevices() {
  const stored = await AsyncStorage.getItem(DEVICES_STORAGE_KEY);
  if (!stored) return undefined;
  const devices = JSON.parse(stored) as HouseholdDevice[];
  return Array.isArray(devices) ? devices : undefined;
}

export async function saveDevices(devices: HouseholdDevice[]) {
  await AsyncStorage.setItem(DEVICES_STORAGE_KEY, JSON.stringify(devices));
}
