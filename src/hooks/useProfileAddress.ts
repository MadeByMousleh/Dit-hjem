import { useCallback, useEffect, useRef, useState } from "react";
import { AddressSuggestion, searchAddresses } from "../addresses";
import { GridSupplier } from "../prices";
import { loadProfile, saveProfile as saveStoredProfile } from "../services/storage";

const EFORSYNING_API_URL = "http://localhost:8787";

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
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);

  const [address, setAddress] = useState("");
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [addressLookupLoading, setAddressLookupLoading] = useState(false);
  const [addressError, setAddressError] = useState("");

  const [addressMunicipality, setAddressMunicipality] = useState<string | undefined>();
  const [addressPostcode, setAddressPostcode] = useState<string | undefined>();
  const [wasteCalendarUrl, setWasteCalendarUrl] = useState("");
  const [wasteShowOnDashboard, setWasteShowOnDashboard] = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadProfile().then((profile) => {
      if (!profile) return;
      setProfileName(profile.name ?? "");
      setProfileEmail(profile.email ?? "");
      setAddress(profile.address ?? "");
      setAddressMunicipality(profile.municipalityCode);
      setAddressPostcode(profile.postcode);
      setWasteCalendarUrl(profile.wasteCalendarUrl ?? "");
      setWasteShowOnDashboard(profile.wasteShowOnDashboard ?? false);
    }).catch(() => undefined);
  }, [refreshKey]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const saveProfile = useCallback(async () => {
    await saveStoredProfile({
      name: profileName,
      email: profileEmail,
      address,
      municipalityCode: addressMunicipality,
      postcode: addressPostcode,
      wasteCalendarUrl,
      wasteShowOnDashboard,
    });
    setProfileSaved(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setProfileSaved(false), 1800);
  }, [address, addressMunicipality, addressPostcode, profileEmail, profileName, wasteCalendarUrl, wasteShowOnDashboard]);

  useEffect(() => {
    if (address.trim().length < 3) {
      setAddressSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      searchAddresses(address).then(setAddressSuggestions).catch(() => setAddressSuggestions([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [address]);

  const chooseAddress = useCallback(async (suggestion: AddressSuggestion) => {
    setAddress(suggestion.text);
    setAddressMunicipality(suggestion.municipalityCode);
    setAddressPostcode(suggestion.postcode);
    void saveStoredProfile({
      name: profileName,
      email: profileEmail,
      address: suggestion.text,
      municipalityCode: suggestion.municipalityCode,
      postcode: suggestion.postcode,
    });

    setAddressSuggestions([]);
    setAddressError("");
    setAddressLookupLoading(true);

    try {
      const response = await fetch(`${EFORSYNING_API_URL}/api/grid/lookup?x=${suggestion.x}&y=${suggestion.y}`);
      const result = await response.json() as { name?: string; error?: string };
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
      setAddressError(error instanceof Error ? error.message : "Netselskabet kunne ikke findes");
    } finally {
      setAddressLookupLoading(false);
    }
  }, [gridSuppliers, profileEmail, profileName, setSelectedSupplierId]);

  return {
    profileName,
    setProfileName,
    profileEmail,
    setProfileEmail,
    profileSaved,
    saveProfile,
    address,
    setAddress,
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
