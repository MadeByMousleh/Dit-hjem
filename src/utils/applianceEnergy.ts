import type { SmartThingsDevice } from '../services/smartthings';
import { applianceCatalog, categoryEstimate, identifyAppliance } from './applianceCatalog';

// Manufacturer records require exact model/program matches. Broad category
// scenarios are explicitly marked as rough fallback estimates.
const boschDishwasher = {
  source: 'https://media3.bosch-home.com/Documents/9001914980_B.pdf',
  reviewed: '2026-10-15',
  programs: {
    Dishcare_Dishwasher_Program_Eco50: { label: 'Eco 50 °C', min: 0.645, max: 0.645 },
    Dishcare_Dishwasher_Program_MachineCare: { label: 'Maskinpleje', min: 1.35, max: 1.35 },
  } as Record<string, { label: string; min: number; max: number }>,
};
export function programLabel(program: string) {
  const labels: Record<string, string> = {
    Dishcare_Dishwasher_Program_Eco50: 'Eco 50 °C', Dishcare_Dishwasher_Program_MachineCare: 'Maskinpleje',
    Dishcare_Dishwasher_Program_Kurz60: 'Kort 60 °C', Dishcare_Dishwasher_Program_Quick45: 'Hurtig 45 °C',
    Dishcare_Dishwasher_Program_PreRinse: 'Forskyl', Dishcare_Dishwasher_Program_Auto2: 'Auto 2', Dishcare_Dishwasher_Program_Auto3: 'Auto 3',
    Cooking_Oven_Program_HeatingMode_HotAir: 'Varmluft', Cooking_Oven_Program_HeatingMode_TopBottomHeating: 'Over-/undervarme',
    Cooking_Oven_Program_HeatingMode_TopBottomHeatingEco: 'Over-/undervarme Eco', Cooking_Oven_Program_HeatingMode_HotAirGrilling: 'Varmluftgrill',
    Cooking_Oven_Program_HeatingMode_PizzaSetting: 'Pizza', Cooking_Oven_Program_HeatingMode_SlowCook: 'Langtidsstegning',
    Cooking_Oven_Program_HeatingMode_Defrost: 'Optøning', Cooking_Oven_Program_HeatingMode_BottomHeating: 'Undervarme',
    Cooking_Oven_Program_HeatingMode_KeepWarm: 'Varmholdning', Cooking_Oven_Program_HeatingMode_PreheatOvenware: 'Tallerkenopvarmning',
  };
  return labels[program] ?? program.replace(/_/g, ' ');
}
export function applianceInfo(device: SmartThingsDevice, component: string = 'main', draftProgram?: string) {
  const capabilities = device.components.find(c => c.id === component)?.capabilities ?? [];
  const values = device.status?.[component] ?? {};
  const category = identifyAppliance(capabilities, device.label, device.categories);
  const defaults = category === 'unknown' ? null : applianceCatalog[category];
  const kind = defaults?.label ?? 'Enhed';
  const programCapability = capabilities.find(key => /(?:oven|dishwasher)programsv2$/.test(key));
  const programValue = draftProgram ?? (programCapability ? values[programCapability]?.program?.value : undefined);
  const program = typeof programValue === 'string' && !['None', 'UnknownProgram'].includes(programValue) ? programValue : null;
  const operation = values['signalahead13665.applianceoperationstatesv2']?.operationState;
  const states: Record<string, string> = { Inactive: 'Inaktiv', Ready: 'Klar', DelayedStart: 'Udskudt start', Run: 'Program kører', Pause: 'På pause', ActionRequired: 'Kræver handling', Finished: 'Færdig', Error: 'Fejl', Aborting: 'Afbryder', Offline: 'Offline' };
  const model = device.model?.trim().toUpperCase();
  const record = device.manufacturer?.trim().toLowerCase() === 'bosch' && model === 'SMD6ZC804E' ? boschDishwasher : null;
  const matched = program && record?.programs[program];
  const fallback = categoryEstimate(category, program);
  const estimate = matched ? { ...matched, source: record!.source, reviewed: record!.reviewed, period: 'pr. program', basis: 'Producentens programdata', assumption: 'Laboratorietal ved standardindstillinger. Fyldning og ekstrafunktioner kan ændre forbruget.' }
    : fallback ? { min: fallback.min, max: fallback.max, source: '', reviewed: '2026-10-15', period: fallback.period, basis: 'Groft standardestimat', assumption: fallback.assumption } : null;
  const available = Object.entries(values).find(([key]) => /(?:oven|dishwasher)programsv2$/.test(key))?.[1]?.availablePrograms?.value;
  const programIds = Array.isArray(available) ? available.filter(p => !['None', 'UnknownProgram'].includes(p)) : [];
  const availablePrograms = programIds.map(programLabel);
  return { kind, program, programName: program ? programLabel(program) : 'Intet program valgt',
    operation: typeof operation?.value === 'string' ? states[operation.value] ?? operation.value : null,
    timestamp: operation?.timestamp ?? values.switch?.switch?.timestamp,
    estimate, availablePrograms, programIds, programCapability, category,
  };
}
