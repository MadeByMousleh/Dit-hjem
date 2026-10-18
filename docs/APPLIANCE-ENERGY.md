# Appliance energy estimates

2026-10-15. The UI uses kWh (energy), never kWh per kWh. Estimates describe a whole cycle or an explicit time period, not instantaneous power.

The catalog in `src/utils/applianceCatalog.ts` contains **engineering planning ranges**, not measured population averages, guaranteed bounds or statistical confidence intervals. They are intentionally coarse because age, capacity, temperature, duration and load are often unknown. They must be shown as estimates, with their period visible. They are not suitable for billing or proof of consumption. Connected SmartThings capabilities or known category/name identify the kind; an unknown kind gets no invented energy estimate.

Priority is exact reviewed model/program data, then a program scenario if defined, then the appliance category range. No model match is inferred from a similar model identifier. The first exact records remain Bosch SMD6ZC804E Eco50 and MachineCare, from the [manufacturer program table](https://media3.bosch-home.com/Documents/9001914980_B.pdf). Oven label test figures are not automatically assigned to arbitrary oven programs.

| Category | Initial range, kWh | Period/assumption |
| --- | --- | --- |
| Oven | 0.6–1.5 | Ordinary cooking, about one hour including warm-up |
| Dishwasher | 0.6–1.5 | One normal wash |
| Washing machine | 0.4–1.5 | One normal 30–60°C wash |
| Tumble dryer | 1–5 | One drying cycle; technology unknown |
| Combined washer/dryer | 2–6 | Full wash and dry |
| Refrigerator | 0.2–1 | One day |
| Freezer | 0.4–1.5 | One day |
| Hob | 0.3–1.5 | About 30 minutes cooking |
| Microwave | 0.08–0.2 | Ten minutes |
| Air fryer | 0.3–0.8 | Thirty minutes |
| Heat pump | 0.3–3 | One hour electrical input, not heat output |
| Air conditioner | 0.5–2 | One hour |
| Water heater | 1.2–3 | About 25–60 litres heated by 40°C |
| Dehumidifier | 0.15–0.6 | One hour |

Scenario overrides are explicit in the catalog: oven keep-warm/defrost/slow-cook use an hourly estimate; pyrolysis uses a full-cleaning estimate; dishwasher pre-rinse/Eco/intensive have broad scenario ranges. These are product assumptions, not newly discovered manufacturer data. Unknown programs retain the category estimate and its stated period, not a claim about their full duration. Optional functions do not get arbitrary percentage corrections. No personal learning or per-run measurement is implemented.

Reference context reviewed: [European Commission dishwashers](https://energy-efficient-products.ec.europa.eu/product-list/dishwashers_en), [washing machines](https://energy-efficient-products.ec.europa.eu/product-list/washing-machines_en), [tumble dryers](https://energy-efficient-products.ec.europa.eu/product-list/tumble-dryers_en), and [Virginia Tech energy estimation method](https://www.pubs.ext.vt.edu/2901/2901-9014/2901-9014.html). These explain cycle dependence and power × time estimation; they do **not** establish every range above as a published average. The US nameplate examples must not be copied as EU appliance cycle measurements. Water heating uses approximately 1.163 Wh/litre/°C before losses.

The compact card shows appliance, last reported power/operation, reported program and energy estimate with period. Tap to view a modal with program selection, controls, model, timestamp and estimate assumptions/source. Draft selection stays separate from provider-confirmed program. Setting a program never starts it. Power-on and program-start are separate actions. Start requires a reported selected program, power-on and a ready state, with an explicit confirmation. Backend validates live capability/program availability and expected selection before accepting a start request. Only discovered producer program capabilities are controllable; there is no generic arbitrary-command executor.

Actual appliance control remains provider-dependent and has not been physically tested for this increment. Tests use synthetic devices and never start a real oven or dishwasher.
