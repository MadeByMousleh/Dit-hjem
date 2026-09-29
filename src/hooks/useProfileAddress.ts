import { useCallback, useEffect, useRef, useState } from "react";
import { AddressSuggestion, searchAddresses } from "../addresses";
import { GridSupplier } from "../prices";
import { loadProfile, saveProfile as saveStoredProfile } from "../services/storage";
import { API_URL } from "../services/supabase";
import { useHouseholdSession } from "./useHouseholdSession";

function supplierTokens(value: string) {
  return value.toLowerCase()
    .replace(/[^a-z0-9æøå]+/g, " ")
    .split(" ")
    .filter((token) => {
      return (token.length > 2 || /\d/.test(token)) && !["a/s", "as", "net", "elnet", "netselskab"].includes(token);
    });
}

// The boundary API gives a grid-area CVR. Names alone are ambiguous for N1 and
// TREFOR, so prefer the known tariff profile for that exact area.
const supplierIdByGridCvr: Record<string, string> = {
  "3159": "n1_c",
  "3220": "n1_344",
  "3167": "trefor_el-net_c",
  "3596": "trefor_el-net_oest_c",
  "3100": "radius_c",
  "3592": "radius_c",
  "3143": "cerius_c",
  "3544": "cerius_c",
  "3558": "cerius_c",
  "3559": "cerius_c",
};

type UseProfileAddressOptions = {
  refreshKey: string;
  gridSuppliers: GridSupplier[];
  setSelectedSupplierId: (id: string) => void;
};

export function useProfileAddress({ refreshKey, gridSuppliers, setSelectedSupplierId }: UseProfileAddressOptions) {
  const auth = useHouseholdSession();
  const userId = auth.session?.user.id;
  const accountEmail = auth.session?.user.email?.trim() ?? "";
  const metadata = auth.session?.user.user_metadata;
  const accountName = [metadata?.full_name, metadata?.name, [metadata?.given_name, metadata?.family_name].filter(Boolean).join(" ")]
    .find((value) => typeof value === "string" && value.trim())?.trim() ?? "";
  const [profileName, setProfileName] = useState(accountName);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");

  const [address, setAddress] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [addressLookupLoading, setAddressLookupLoading] = useState(false);
  const [addressError, setAddressError] = useState("");
  const [addressSelected, setAddressSelected] = useState(false);

  const [addressMunicipality, setAddressMunicipality] = useState<string | undefined>();
  const [addressPostcode, setAddressPostcode] = useState<string | undefined>();
  const [wasteCalendarUrl, setWasteCalendarUrl] = useState("");
  const [wasteShowOnDashboard, setWasteShowOnDashboard] = useState(false);
  const [lowPriceAlerts, setLowPriceAlertsState] = useState(false);
  const [highPriceAlerts, setHighPriceAlertsState] = useState(false);
  const [lowPriceAlertThresholdOre, setLowPriceAlertThresholdOreState] = useState(150);
  const [highPriceAlertThresholdOre, setHighPriceAlertThresholdOreState] = useState(250);
  const [consumptionBudgetAlerts, setConsumptionBudgetAlertsState] = useState(false);
  const [consumptionBudgetUnit, setConsumptionBudgetUnitState] = useState<'kwh' | 'dkk'>('kwh');
  const [consumptionBudgetLimit, setConsumptionBudgetLimitState] = useState(400);
  const [chargingWindowAlerts, setChargingWindowAlertsState] = useState(false);
  const [chargingDurationHours, setChargingDurationHoursState] = useState(4);
  const [chargingReadyByHour, setChargingReadyByHourState] = useState(7);
  const [monthlyEnergySummaryAlerts, setMonthlyEnergySummaryAlertsState] = useState(false);
  const [monthlyEnergySummaryHour, setMonthlyEnergySummaryHourState] = useState(9);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lookupVersion = useRef(0);

  useEffect(() => {
    let active = true;
    loadProfile(userId, accountEmail).then((profile) => {
      if (!active) return;
      setProfileName(profile?.name || accountName);
      setAddress(profile?.address ?? "");
      setAddressSelected(!!profile?.address);
      setAddressMunicipality(profile?.municipalityCode);
      setAddressPostcode(profile?.postcode);
      setWasteCalendarUrl(profile?.wasteCalendarUrl ?? "");
      setWasteShowOnDashboard(profile?.wasteShowOnDashboard ?? false);
      setLowPriceAlertsState(profile?.lowPriceAlerts ?? false);
      setHighPriceAlertsState(profile?.highPriceAlerts ?? false);
      setLowPriceAlertThresholdOreState(profile?.lowPriceAlertThresholdOre ?? 150);
      setHighPriceAlertThresholdOreState(profile?.highPriceAlertThresholdOre ?? 250);
      setConsumptionBudgetAlertsState(profile?.consumptionBudgetAlerts ?? false);
      setConsumptionBudgetUnitState(profile?.consumptionBudgetUnit ?? 'kwh');
      setConsumptionBudgetLimitState(profile?.consumptionBudgetLimit ?? 400);
      setChargingWindowAlertsState(profile?.chargingWindowAlerts ?? false);
      setChargingDurationHoursState(profile?.chargingDurationHours ?? 4);
      setChargingReadyByHourState(profile?.chargingReadyByHour ?? 7);
      setMonthlyEnergySummaryAlertsState(profile?.monthlyEnergySummaryAlerts ?? false);
      setMonthlyEnergySummaryHourState(profile?.monthlyEnergySummaryHour ?? 9);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [refreshKey, userId, accountEmail, accountName]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const saveProfile = useCallback(async () => {
    if (!userId) return;
    setProfileSaving(true); setProfileError("");
    try {
      const existing = await loadProfile(userId, accountEmail);
      await saveStoredProfile({
        ...existing,
        name: profileName.trim(),
        email: accountEmail,
        ...(addressSelected ? { address, municipalityCode: addressMunicipality, postcode: addressPostcode } : {}),
        wasteCalendarUrl,
        wasteShowOnDashboard,
        lowPriceAlerts,
        highPriceAlerts,
        lowPriceAlertThresholdOre,
        highPriceAlertThresholdOre,
        consumptionBudgetAlerts,
        consumptionBudgetUnit,
        consumptionBudgetLimit,
        chargingWindowAlerts,
        chargingDurationHours,
        chargingReadyByHour,
        monthlyEnergySummaryAlerts,
        monthlyEnergySummaryHour,
      }, userId);
      setProfileSaved(true);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => setProfileSaved(false), 1800);
    } catch {
      setProfileError("Profilen kunne ikke gemmes. Prøv igen.");
    } finally { setProfileSaving(false); }
  }, [address, addressSelected, addressMunicipality, addressPostcode, accountEmail, profileName, userId, wasteCalendarUrl, wasteShowOnDashboard, lowPriceAlerts, highPriceAlerts, lowPriceAlertThresholdOre, highPriceAlertThresholdOre, consumptionBudgetAlerts, consumptionBudgetUnit, consumptionBudgetLimit, chargingWindowAlerts, chargingDurationHours, chargingReadyByHour, monthlyEnergySummaryAlerts, monthlyEnergySummaryHour]);

  const setLowPriceAlerts = useCallback(async (enabled: boolean) => {
    if (!userId) return;
    setLowPriceAlertsState(enabled);
    try {
      const existing = await loadProfile(userId, accountEmail);
      await saveStoredProfile({ ...existing, lowPriceAlerts: enabled }, userId);
    } catch {
      setLowPriceAlertsState(!enabled);
      setProfileError("Notifikationsindstillingen kunne ikke gemmes. Prøv igen.");
    }
  }, [accountEmail, userId]);

  const setHighPriceAlerts = useCallback(async (enabled: boolean) => {
    if (!userId) return;
    setHighPriceAlertsState(enabled);
    try {
      const existing = await loadProfile(userId, accountEmail);
      await saveStoredProfile({ ...existing, highPriceAlerts: enabled }, userId);
    } catch {
      setHighPriceAlertsState(!enabled);
      setProfileError("Notifikationsindstillingen kunne ikke gemmes. Prøv igen.");
    }
  }, [accountEmail, userId]);

  const setLowPriceAlertThresholdOre = useCallback(async (value: number) => {
    if (!userId || !Number.isFinite(value) || value < 25 || value > 2000) return;
    setLowPriceAlertThresholdOreState(value);
    try { const existing = await loadProfile(userId, accountEmail); await saveStoredProfile({ ...existing, lowPriceAlertThresholdOre: value }, userId); }
    catch { setProfileError("Prisgrænsen kunne ikke gemmes. Prøv igen."); }
  }, [accountEmail, userId]);

  const setHighPriceAlertThresholdOre = useCallback(async (value: number) => {
    if (!userId || !Number.isFinite(value) || value < 25 || value > 2000) return;
    setHighPriceAlertThresholdOreState(value);
    try { const existing = await loadProfile(userId, accountEmail); await saveStoredProfile({ ...existing, highPriceAlertThresholdOre: value }, userId); }
    catch { setProfileError("Prisgrænsen kunne ikke gemmes. Prøv igen."); }
  }, [accountEmail, userId]);

  const setConsumptionBudgetAlerts = useCallback(async (enabled: boolean) => {
    if (!userId) return;
    setConsumptionBudgetAlertsState(enabled);
    try { const existing = await loadProfile(userId, accountEmail); await saveStoredProfile({ ...existing, consumptionBudgetAlerts: enabled }, userId); }
    catch { setConsumptionBudgetAlertsState(!enabled); setProfileError("Notifikationsindstillingen kunne ikke gemmes. Prøv igen."); }
  }, [accountEmail, userId]);

  const setConsumptionBudget = useCallback(async (unit: 'kwh' | 'dkk', limit: number) => {
    if (!userId || !Number.isFinite(limit) || limit < 1 || limit > 100000) return;
    setConsumptionBudgetUnitState(unit); setConsumptionBudgetLimitState(limit);
    try { const existing = await loadProfile(userId, accountEmail); await saveStoredProfile({ ...existing, consumptionBudgetUnit: unit, consumptionBudgetLimit: limit }, userId); }
    catch { setProfileError("Forbrugsgrænsen kunne ikke gemmes. Prøv igen."); }
  }, [accountEmail, userId]);

  const setChargingWindowAlerts = useCallback(async (enabled: boolean) => {
    if (!userId) return;
    setChargingWindowAlertsState(enabled);
    try { const existing = await loadProfile(userId, accountEmail); await saveStoredProfile({ ...existing, chargingWindowAlerts: enabled }, userId); }
    catch { setChargingWindowAlertsState(!enabled); setProfileError("Notifikationsindstillingen kunne ikke gemmes. Prøv igen."); }
  }, [accountEmail, userId]);

  const setChargingWindow = useCallback(async (durationHours: number, readyByHour: number) => {
    if (!userId || !Number.isInteger(durationHours) || durationHours < 1 || durationHours > 6 || !Number.isInteger(readyByHour) || readyByHour < 0 || readyByHour > 23) return;
    setChargingDurationHoursState(durationHours); setChargingReadyByHourState(readyByHour);
    try { const existing = await loadProfile(userId, accountEmail); await saveStoredProfile({ ...existing, chargingDurationHours: durationHours, chargingReadyByHour: readyByHour }, userId); }
    catch { setProfileError("Opladningsindstillingen kunne ikke gemmes. Prøv igen."); }
  }, [accountEmail, userId]);

  const setMonthlyEnergySummary = useCallback(async (enabled: boolean, hour: number) => {
    if (!userId || !Number.isInteger(hour) || hour < 0 || hour > 23) return;
    setMonthlyEnergySummaryAlertsState(enabled); setMonthlyEnergySummaryHourState(hour);
    try { const existing = await loadProfile(userId, accountEmail); await saveStoredProfile({ ...existing, monthlyEnergySummaryAlerts: enabled, monthlyEnergySummaryHour: hour }, userId); }
    catch { setProfileError("Indstillingen for energioversigten kunne ikke gemmes. Prøv igen."); }
  }, [accountEmail, userId]);

  const editAddress = useCallback((value: string) => {
    lookupVersion.current++;
    setAddress(value);
    setAddressSelected(false);
    setAddressSuggestions([]);
    setAddressMunicipality(undefined);
    setAddressPostcode(undefined);
    setAddressError("");
    setAddressLookupLoading(false);
  }, []);

  const editName = useCallback((value: string) => {
    setProfileName(value);
    setProfileSaved(false);
    setProfileError("");
  }, []);

  useEffect(() => {
    if (addressSelected || address.trim().length < 3) {
      setAddressSuggestions([]);
      return;
    }
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchAddresses(address, controller.signal).then(suggestions => { if (active) { setAddressSuggestions(suggestions); setAddressError(''); } })
        .catch(() => { if (active) { setAddressSuggestions([]); setAddressError("Adresser kunne ikke hentes. Prøv igen."); } });
    }, 180);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [address, addressSelected]);

  const chooseAddress = useCallback(async (suggestion: AddressSuggestion) => {
    const version = ++lookupVersion.current;
    setAddressError("");
    setAddress(suggestion.text);
    setAddressSelected(true);
    setAddressMunicipality(suggestion.municipalityCode);
    setAddressPostcode(suggestion.postcode);
    setAddressSuggestions([]);
    setAddressLookupLoading(true);
    try { await saveStoredProfile({
      name: profileName,
      email: accountEmail,
      address: suggestion.text,
      municipalityCode: suggestion.municipalityCode,
      postcode: suggestion.postcode,
      wasteCalendarUrl,
      wasteShowOnDashboard,
      lowPriceAlerts,
      highPriceAlerts,
      lowPriceAlertThresholdOre,
      highPriceAlertThresholdOre,
      consumptionBudgetAlerts,
      consumptionBudgetUnit,
      consumptionBudgetLimit,
      chargingWindowAlerts,
      chargingDurationHours,
      chargingReadyByHour,
      monthlyEnergySummaryAlerts,
      monthlyEnergySummaryHour,
    }, userId); } catch { if (version === lookupVersion.current) setAddressError("Adressen blev valgt, men kunne ikke gemmes. Prøv igen."); }

    if (version !== lookupVersion.current) return;

    try {
      const response = await fetch(`${API_URL}/api/grid/lookup?x=${encodeURIComponent(suggestion.x)}&y=${encodeURIComponent(suggestion.y)}`);
      const result = await response.json() as { name?: string; cvr?: string; error?: string };
      if (version !== lookupVersion.current) return;
      if (!response.ok || !result.name) throw new Error(result.error ?? "Netselskabet kunne ikke findes");

      const supplierTokensFound = supplierTokens(result.name);
      const canonicalSupplierId = supplierIdByGridCvr[result.cvr ?? ""]
        ?? (supplierTokensFound.includes("n1") ? "n1_c" : undefined);
      const match = (canonicalSupplierId && gridSuppliers.find((supplier) => supplier.id === canonicalSupplierId)) ?? gridSuppliers.find((supplier) => {
        return [supplier.name, supplier.companyName ?? ""].some((name) => {
          const candidateTokens = supplierTokens(name);
          return supplierTokensFound.some((token) => candidateTokens.includes(token));
        });
      });

      if (match) setSelectedSupplierId(match.id);
      else setAddressError(`${result.name} blev fundet, men findes ikke i prislisten endnu.`);
    } catch (error) {
      if (version === lookupVersion.current) setAddressError(error instanceof Error ? error.message : "Netselskabet kunne ikke findes");
    } finally {
      if (version === lookupVersion.current) setAddressLookupLoading(false);
    }
  }, [gridSuppliers, accountEmail, profileName, setSelectedSupplierId, userId, wasteCalendarUrl, wasteShowOnDashboard, lowPriceAlerts, highPriceAlerts, lowPriceAlertThresholdOre, highPriceAlertThresholdOre, consumptionBudgetAlerts, consumptionBudgetUnit, consumptionBudgetLimit, chargingWindowAlerts, chargingDurationHours, chargingReadyByHour, monthlyEnergySummaryAlerts, monthlyEnergySummaryHour]);

  return {
    profileName,
    setProfileName: editName,
    profileEmail: accountEmail,
    profileSaved,
    profileSaving,
    profileError,
    saveProfile,
    address,
    setAddress: editAddress,
    addressSelected,
    addressSuggestions,
    chooseAddress,
    addressLookupLoading,
    addressError,
    addressMunicipality,
    addressPostcode,
    wasteCalendarUrl,
    setWasteCalendarUrl,
    wasteShowOnDashboard,
    setWasteShowOnDashboard,
    lowPriceAlerts,
    setLowPriceAlerts,
    highPriceAlerts,
    setHighPriceAlerts,
    lowPriceAlertThresholdOre,
    setLowPriceAlertThresholdOre,
    highPriceAlertThresholdOre,
    setHighPriceAlertThresholdOre,
    consumptionBudgetAlerts,
    setConsumptionBudgetAlerts,
    consumptionBudgetUnit,
    consumptionBudgetLimit,
    setConsumptionBudget,
    chargingWindowAlerts,
    setChargingWindowAlerts,
    chargingDurationHours,
    chargingReadyByHour,
    setChargingWindow,
    monthlyEnergySummaryAlerts,
    monthlyEnergySummaryHour,
    setMonthlyEnergySummary,
  };
}
