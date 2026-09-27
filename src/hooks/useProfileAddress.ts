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
      }, userId);
      setProfileSaved(true);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => setProfileSaved(false), 1800);
    } catch {
      setProfileError("Profilen kunne ikke gemmes. Prøv igen.");
    } finally { setProfileSaving(false); }
  }, [address, addressSelected, addressMunicipality, addressPostcode, accountEmail, profileName, userId, wasteCalendarUrl, wasteShowOnDashboard]);

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
    const timer = setTimeout(() => {
      searchAddresses(address).then(suggestions => { if (active) setAddressSuggestions(suggestions); })
        .catch(() => { if (active) { setAddressSuggestions([]); setAddressError("Adresser kunne ikke hentes. Prøv igen."); } });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
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
    }, userId); } catch { if (version === lookupVersion.current) setAddressError("Adressen blev valgt, men kunne ikke gemmes. Prøv igen."); }

    if (version !== lookupVersion.current) return;

    try {
      const response = await fetch(`${API_URL}/api/grid/lookup?x=${encodeURIComponent(suggestion.x)}&y=${encodeURIComponent(suggestion.y)}`);
      const result = await response.json() as { name?: string; error?: string };
      if (version !== lookupVersion.current) return;
      if (!response.ok || !result.name) throw new Error(result.error ?? "Netselskabet kunne ikke findes");

      const supplierTokensFound = supplierTokens(result.name);
      const canonicalSupplierId = supplierTokensFound.includes("n1") ? "n1_c" : undefined;
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
  }, [gridSuppliers, accountEmail, profileName, setSelectedSupplierId, userId, wasteCalendarUrl, wasteShowOnDashboard]);

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
  };
}
