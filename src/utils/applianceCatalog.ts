// Planning ranges, not measured averages or statistical confidence intervals.
// Kept deliberately broad when age, capacity, temperature and technology are
// unknown. Exact manufacturer/program records take precedence.
export type ApplianceKind = 'oven' | 'dishwasher' | 'washer' | 'dryer' | 'washerDryer' | 'fridge' | 'freezer' | 'hob' | 'microwave' | 'airFryer' | 'heatPump' | 'airConditioner' | 'waterHeater' | 'dehumidifier' | 'unknown';
export const applianceCatalog: Record<Exclude<ApplianceKind, 'unknown'>, { label: string; min: number; max: number; period: string; assumption: string }> = {
  oven: { label: 'Ovn', min: 0.6, max: 1.5, period: 'pr. tilberedning', assumption: 'Ca. 1 times almindelig bagning inkl. opvarmning; ikke pyrolyse eller langtidsstegning.' },
  dishwasher: { label: 'Opvaskemaskine', min: 0.6, max: 1.5, period: 'pr. vask', assumption: 'En normal opvask. Temperatur, fyldning og ekstra tørring ændrer forbruget.' },
  washer: { label: 'Vaskemaskine', min: 0.4, max: 1.5, period: 'pr. vask', assumption: 'En almindelig vask ved 30–60 °C; ikke kogevask eller tørring.' },
  dryer: { label: 'Tørretumbler', min: 1, max: 5, period: 'pr. tørring', assumption: 'En tørring. Bredt interval omfatter både varmepumpe- og traditionelle tumblere.' },
  washerDryer: { label: 'Vaske-/tørremaskine', min: 2, max: 6, period: 'pr. vask og tørring', assumption: 'En samlet vaske- og tørrecyklus; kun vask bruger mindre energi.' },
  fridge: { label: 'Køleskab', min: 0.2, max: 1, period: 'pr. døgn', assumption: '24 timers drift. Størrelse, alder og rumtemperatur er ukendt.' },
  freezer: { label: 'Fryser', min: 0.4, max: 1.5, period: 'pr. døgn', assumption: '24 timers drift. Størrelse, alder og rumtemperatur er ukendt.' },
  hob: { label: 'Kogeplade', min: 0.3, max: 1.5, period: 'pr. madlavning', assumption: 'Ca. 30 minutters madlavning; antal zoner og effekt varierer.' },
  microwave: { label: 'Mikroovn', min: 0.08, max: 0.2, period: 'pr. 10 min.', assumption: '10 minutter ved ca. 0,5–1,2 kW elektrisk indgangseffekt.' },
  airFryer: { label: 'Airfryer', min: 0.3, max: 0.8, period: 'pr. 30 min.', assumption: '30 minutters tilberedning; termostaten regulerer varmeeffekten.' },
  heatPump: { label: 'Varmepumpe', min: 0.3, max: 3, period: 'pr. time', assumption: '1 times elektrisk drift, ikke leveret varme. Udetemperatur og anlæg har stor betydning.' },
  airConditioner: { label: 'Aircondition', min: 0.5, max: 2, period: 'pr. time', assumption: '1 times køling; størrelse og temperaturforskel er ukendt.' },
  waterHeater: { label: 'Varmtvandsbeholder', min: 1.2, max: 3, period: 'pr. opvarmning', assumption: 'Opvarmning af ca. 25–60 liter vand med 40 °C; tab afhænger af beholderen.' },
  dehumidifier: { label: 'Affugter', min: 0.15, max: 0.6, period: 'pr. time', assumption: '1 times drift ved ca. 150–600 W.' },
};
export function categoryEstimate(kind: ApplianceKind, program: string | null) {
  if (kind === 'unknown') return null;
  const base = applianceCatalog[kind];
  // Scenario assumptions rather than claimed population averages. Time-based
  // modes must not be presented as a fixed total for an arbitrarily long run.
  if (kind === 'oven' && program?.endsWith('_KeepWarm')) return { ...base, min: 0.1, max: 0.4, period: 'pr. time', assumption: 'Varmholdning i 1 time; temperatur og ovnstørrelse er ukendt.' };
  if (kind === 'oven' && program?.endsWith('_Defrost')) return { ...base, min: 0.02, max: 0.2, period: 'pr. time', assumption: 'Optøning i 1 time med lav eller ingen varme.' };
  if (kind === 'oven' && program?.endsWith('_SlowCook')) return { ...base, min: 0.3, max: 1, period: 'pr. time', assumption: 'Langtidsstegning i 1 time. Gang med antal timer for et groft samlet skøn.' };
  if (kind === 'oven' && /pyro|selfclean/i.test(program ?? '')) return { ...base, min: 2, max: 5, period: 'pr. rengøring', assumption: 'En fuld pyrolyserengøring; afhænger af varighed og model.' };
  if (kind === 'dishwasher' && program?.endsWith('_PreRinse')) return { ...base, min: 0.02, max: 0.1, assumption: 'Kort forskyl uden opvarmet hovedvask.' };
  if (kind === 'dishwasher' && program?.endsWith('_Eco50')) return { ...base, min: 0.5, max: 1.1, assumption: 'En Eco-vask ved 50 °C; model, alder og fyldning er ukendt.' };
  if (kind === 'dishwasher' && /Auto3|Intensiv70/.test(program ?? '')) return { ...base, min: 0.9, max: 1.8, assumption: 'En varm/intensiv opvask; temperatur, fyldning og ekstra tørring varierer.' };
  return base;
}
export function identifyAppliance(capabilities: string[], label: string, categories: string[] = []): ApplianceKind {
  const text = `${capabilities.join(' ')} ${categories.join(' ')} ${label}`.toLowerCase();
  if (/dishwasher|opvask/.test(text)) return 'dishwasher';
  if (/washerdryer|vaske.{0,4}tør|wash.*dry.*machine/.test(text) || (/washer|vaskemask/.test(text) && /dryer|tørretumb/.test(text))) return 'washerDryer';
  if (/dryer|tørretumb/.test(text)) return 'dryer';
  if (/washer|vaskemask/.test(text)) return 'washer';
  if (/microwave|mikroovn/.test(text)) return 'microwave';
  if (/air.?fry/.test(text)) return 'airFryer';
  if (/oven|ovn/.test(text)) return 'oven';
  if (/refrigerat|fridge|køleskab|kølefrys/.test(text)) return 'fridge';
  if (/freezer|fryser/.test(text)) return 'freezer';
  if (/cooktop|hob|kogeplad|komfur/.test(text)) return 'hob';
  if (/heatpump|varmepumpe/.test(text)) return 'heatPump';
  if (/aircondition|air.condition|air.conditioner/.test(text)) return 'airConditioner';
  if (/waterheater|water.heater|varmtvands/.test(text)) return 'waterHeater';
  if (/dehumidif|affugter/.test(text)) return 'dehumidifier';
  return 'unknown';
}
