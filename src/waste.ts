export type WasteCategory = "plast-papir" | "farligt-affald" | "madaffald" | "andet";

export type WasteEvent = {
  id: string;
  date: string;
  title: string;
  category: WasteCategory;
};

export type WasteHealth = { status: "public-api" | "ical" | "unsupported"; provider: string | null; supported: boolean; detail: string };

export function normalizeWasteCategory(title: string): WasteCategory {
  const value = title.toLowerCase();
  if (value.includes("farlig")) return "farligt-affald";
  if (value.includes("mad") || value.includes("bio")) return "madaffald";
  if (value.includes("plast") || value.includes("papir") || value.includes("pap")) return "plast-papir";
  return "andet";
}

export async function fetchWasteEvents(municipalityCode?: string, postcode?: string, feedUrl?: string, address?: string): Promise<WasteEvent[]> {
  if (!municipalityCode) return [];
  const params = new URLSearchParams({ municipality: municipalityCode, ...(postcode ? { postcode } : {}), ...(feedUrl ? { feedUrl } : {}), ...(address ? { address } : {}) });
  const response = await fetch(`http://localhost:8787/api/waste/calendar?${params.toString()}`);
  if (!response.ok) throw new Error("Affaldskalenderen er ikke tilgængelig for denne kommune endnu");
  return (await response.json()) as WasteEvent[];
}

export async function fetchWasteHealth(municipalityCode?: string): Promise<WasteHealth> {
  const response = await fetch(`http://localhost:8787/api/waste/health?municipality=${encodeURIComponent(municipalityCode ?? "")}`);
  if (!response.ok) throw new Error("Affaldsstatus kunne ikke hentes");
  return await response.json() as WasteHealth;
}

export const WASTE_LABELS: Record<WasteCategory, string> = {
  "plast-papir": "Plast / papir",
  "farligt-affald": "Farligt affald",
  madaffald: "Madaffald",
  andet: "Affald",
};
