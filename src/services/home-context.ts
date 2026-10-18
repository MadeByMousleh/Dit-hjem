import proj4 from 'proj4';

export type HomeFact = { title: string; detail?: string; url?: string; category?: string; facts?: { label: string; value: string }[] };
export type HomeSource = { id: string; title: string; source: string; sourceUrl: string; note: string; items: HomeFact[]; status: 'ready' | 'unavailable'; fetchedAt: string };
const utm = '+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs';
const cache = new Map<string, { at: number; sources: HomeSource[] }>();
async function json(url: string, parent: AbortSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  parent.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 16000);
  try {
    if (parent.aborted) controller.abort();
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('Kilden kunne ikke hentes');
    return await response.json();
  } finally { clearTimeout(timer); parent.removeEventListener('abort', abort); }
}
const clean = (value: unknown) => typeof value === 'string' ? value.replace(/<[^>]*>/g, '').trim().slice(0, 350) : '';
export function safeHomeLink(value: unknown): string | undefined {
  try { const url = new URL(String(value)); return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined; } catch { return undefined; }
}

// Only the saved address point is sent to public providers; never account IDs,
// authentication headers or provider credentials. No device location permission.
export async function loadHomeContext(x: number, y: number, signal: AbortSignal, onSource: (source: HomeSource) => void, force = false, kind: 'all' | 'plans' | 'nearby' = 'all') {
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 7 || x > 16 || y < 54 || y > 59) throw new Error('Adressen mangler gyldige koordinater. Vælg adressen igen i Profil.');
  const cacheKey = `v2:${kind}:${x}:${y}`;
  const cached = cache.get(cacheKey);
  if (!force && cached && Date.now()-cached.at < 3600000) { if (!signal.aborted) cached.sources.forEach(onSource); return; }
  const [east, north] = proj4('EPSG:4326', utm, [x, y]);
  const plans = async (layer: string): Promise<HomeFact[]> => {
    const params = new URLSearchParams({ service: 'WFS', version: '2.0.0', request: 'GetFeature', typeNames: `pdk:${layer}`, outputFormat: 'application/json', count: '31', cql_filter: `INTERSECTS(geometri,POINT(${east.toFixed(2)} ${north.toFixed(2)}))` });
    const data = await json(`https://geoserver.plandata.dk/geoserver/wfs?${params}`, signal);
    if (!Array.isArray(data.features)) throw new Error('Ukendt plansvar');
    if (data.features.length > 30) throw new Error('For mange planer til et komplet overblik');
    return data.features.map((feature: { properties?: Record<string, unknown> }) => {
      const p = feature.properties ?? {};
      const facts: { label: string; value: string }[] = [];
      for(const [field,label,unit] of [['bebygpct','Bebyggelsesprocent','%'],['maxetager','Maks. etager',''],['maxbygnhjd','Maks. højde','m'],['mingrund','Mindste grund','m²']]) {
        const value=Number(p[field!]);if(Number.isFinite(value)&&value>0)facts.push({label:label!,value:`${value.toLocaleString('da-DK')} ${unit}`.trim()});
      }
      const adopted=String(p.datovedt??'');
      if(/^\d{8}$/.test(adopted)&&Number(adopted.slice(0,4))>=1900)facts.push({label:'Vedtaget',value:`${adopted.slice(6,8)}.${adopted.slice(4,6)}.${adopted.slice(0,4)}`});
      for(const [field,label] of [['notbebygom','Bebyggelse · uddrag'],['notophold','Opholdsarealer · uddrag']]){const value=clean(p[field!]);if(value)facts.push({label:label!,value});}
      return { title: clean(p.plannavn) || clean(p.plannr) || clean(p.zonestatus) || 'Plan', detail: [clean(p.status), clean(p.zonestatus), clean(p.anvendelsegenerel)].filter(Boolean).join(' · '), facts, url: safeHomeLink(p.doklink) };
    });
  };
  const tasks = [
    { id: 'local', title: 'Lokalplaner', source: 'Plandata.dk · Erhvervsstyrelsen', sourceUrl: 'https://visplaner.plandata.dk/', note: 'Planer ved adressens punkt. Grundens øvrige areal kan være omfattet af andre planer. Plandokumentet er afgørende.', run: () => plans('theme_pdk_lokalplan_vedtaget') },
    { id: 'proposed', title: 'Planforslag', source: 'Plandata.dk · Erhvervsstyrelsen', sourceUrl: 'https://visplaner.plandata.dk/', note: 'Forslag er ikke vedtagne regler.', run: () => plans('theme_pdk_lokalplan_forslag') },
    { id: 'municipal', title: 'Kommuneplanrammer', source: 'Plandata.dk · Erhvervsstyrelsen', sourceUrl: 'https://visplaner.plandata.dk/', note: 'Rammer ved adressens punkt — ikke en byggetilladelse.', run: () => plans('theme_pdk_kommuneplanramme_vedtaget_v') },
    { id: 'zone', title: 'Zonestatus', source: 'Plandata.dk · Erhvervsstyrelsen', sourceUrl: 'https://visplaner.plandata.dk/', note: 'Registreret zone ved adressens punkt. Ikke en vurdering af, hvad du må bygge.', run: () => plans('theme_pdk_zonekort_samlet_v') },
    { id: 'nearby', title: 'I nærheden', source: '© OpenStreetMap-bidragydere · ODbL', sourceUrl: 'https://www.openstreetmap.org/copyright', note: 'Op til 8 steder pr. kategori inden for 3 km, fra et begrænset OSM-opslag. Afstande er i luftlinje, ikke rejsetid. Data kan være ufuldstændige.', run: async (): Promise<HomeFact[]> => {
      const around=`around:3000,${y},${x}`;
      const query = `[out:json][timeout:12];(nwr(${around})[shop=supermarket];nwr(${around})[amenity~"^(school|college|university|kindergarten|childcare|pharmacy|doctors|clinic|hospital)$"];nwr(${around})[railway=station];nwr(${around})[highway=bus_stop];nwr(${around})[leisure=park];nwr(${around})[landuse=forest];);out center 400;`;
      const data = await json(`https://overpass-api.de/api/interpreter?${new URLSearchParams({ data: query })}`, signal);
      if (!Array.isArray(data.elements) || data.remark) throw new Error('Ufuldstændigt kortsvar');
      const names: Record<string, string> = { supermarket: 'Supermarked', school: 'Skole', college:'Uddannelse',university:'Universitet',kindergarten: 'Daginstitution',childcare:'Dagtilbud', pharmacy: 'Apotek',doctors:'Læge',clinic:'Klinik',hospital:'Hospital', station: 'Station',bus_stop:'Busstoppested',park:'Park',forest:'Skov' };
      const groups: Record<string,string>={supermarket:'shopping',school:'schools',college:'schools',university:'schools',kindergarten:'institutions',childcare:'institutions',pharmacy:'health',doctors:'health',clinic:'health',hospital:'health',station:'transport',bus_stop:'transport',park:'nature',forest:'nature'};
      const places = data.elements.map((e: { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }) => {
        const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon;
        if (lat === undefined || lon === undefined || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        const distance = Math.round(6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(Math.sin((lat-y)*Math.PI/360)**2 + Math.cos(y*Math.PI/180)*Math.cos(lat*Math.PI/180)*Math.sin((lon-x)*Math.PI/360)**2))));
        if(distance>3000)return null;
        const type=e.tags?.shop ?? e.tags?.amenity ?? e.tags?.railway ?? e.tags?.highway ?? e.tags?.leisure ?? e.tags?.landuse ?? '';
        const kind=names[type]??'Sted';
        return { title: clean(e.tags?.name) || kind, detail: `${kind} · ${distance>=1000?`${(distance/1000).toLocaleString('da-DK',{maximumFractionDigits:1})} km`:`${distance} m`}`, category:groups[type], distance, url: `https://www.openstreetmap.org/${e.type}/${e.id}` };
      }).filter((e: HomeFact | null) => e !== null).sort((a: { distance: number }, b: { distance: number }) => a.distance-b.distance);
      const counts: Record<string,number>={};return places.filter((item: HomeFact)=>{const group=item.category??'other';counts[group]=(counts[group]??0)+1;return counts[group]<=8;});
    } },
  ];
  const results: HomeSource[] = [];
  const publish = (source: HomeSource) => { if (!signal.aborted) { results.push(source); onSource(source); } };
  await Promise.all(tasks.filter(task=>kind==='all'||(kind==='nearby'?task.id==='nearby':task.id!=='nearby')).map(async ({ run, ...source }) => {
    try { const items = await run(); publish({ ...source, items, status: 'ready', fetchedAt: new Date().toISOString() }); }
    catch { publish({ ...source, items: [], status: 'unavailable', fetchedAt: new Date().toISOString() }); }
  }));
  if (!signal.aborted && results.every(source => source.status === 'ready')) {
    if (cache.size >= 8) cache.delete(cache.keys().next().value!);
    cache.set(cacheKey, { at: Date.now(), sources: results });
  }
}
