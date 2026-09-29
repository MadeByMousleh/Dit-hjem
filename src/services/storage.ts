import AsyncStorage from "@react-native-async-storage/async-storage";
import { HouseholdDevice } from "../types/app";

export const DEVICES_STORAGE_KEY = "stromblik.household-devices.v1";
export const PROFILE_STORAGE_KEY = "stromblik.profile.v1";
export const ELECTRICITY_PLAN_STORAGE_KEY = "stromblik.electricity-plan.v1";
export type ElectricityPlan = { supplierId: string; supplierName: string; priceType: "spot" | "fixed"; markupOre: string; subscription: string; startDate: string };
export async function loadElectricityPlan() { const stored = await AsyncStorage.getItem(ELECTRICITY_PLAN_STORAGE_KEY); return stored ? JSON.parse(stored) as ElectricityPlan : undefined; }
export async function saveElectricityPlan(plan: ElectricityPlan) { await AsyncStorage.setItem(ELECTRICITY_PLAN_STORAGE_KEY, JSON.stringify(plan)); }

export type StoredProfile = {
  name?: string;
  email?: string;
  address?: string;
  municipalityCode?: string;
  postcode?: string;
  wasteCalendarUrl?: string;
  wasteShowOnDashboard?: boolean;
  teslaShowOnDashboard?: boolean;
  lowPriceAlerts?: boolean;
  highPriceAlerts?: boolean;
  lowPriceAlertThresholdOre?: number;
  highPriceAlertThresholdOre?: number;
  consumptionBudgetAlerts?: boolean;
  consumptionBudgetUnit?: "kwh" | "dkk";
  consumptionBudgetLimit?: number;
  chargingWindowAlerts?: boolean;
  chargingDurationHours?: number;
  chargingReadyByHour?: number;
  monthlyEnergySummaryAlerts?: boolean;
  monthlyEnergySummaryHour?: number;
};

function userProfileKey(userId: string) {
  return `${PROFILE_STORAGE_KEY}.${userId}`;
}

export async function loadProfile(userId?: string, accountEmail?: string) {
  if (userId) {
    const scoped = await AsyncStorage.getItem(userProfileKey(userId));
    if (scoped) return JSON.parse(scoped) as StoredProfile;
  }
  const stored = await AsyncStorage.getItem(PROFILE_STORAGE_KEY);
  if (!stored) return undefined;
  const legacy = JSON.parse(stored) as StoredProfile;
  // The old key was shared by every local login. Only adopt personal details
  // when they can be matched to the authenticated account.
  if (userId && (!accountEmail || legacy.email?.trim().toLowerCase() !== accountEmail.trim().toLowerCase())) return undefined;
  return legacy;
}

export async function saveProfile(profile: StoredProfile, userId?: string) {
  await AsyncStorage.setItem(userId ? userProfileKey(userId) : PROFILE_STORAGE_KEY, JSON.stringify(profile));
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
