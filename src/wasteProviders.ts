export type WasteProvider = {
  id: string;
  name: string;
  municipalities: string[];
};

export const WASTE_PROVIDERS: WasteProvider[] = [
  { id: "kredslob", name: "Kredsløb", municipalities: ["0751"] },
  { id: "affaldplus", name: "AffaldPlus", municipalities: ["0320", "0370", "0329", "0330", "0340", "0390"] },
];

export function providerForMunicipality(municipalityCode?: string): WasteProvider | undefined {
  return WASTE_PROVIDERS.find((provider) => provider.municipalities.includes(municipalityCode ?? ""));
}
