// Official VUR register, matched by BFE, never by fuzzy address text.
const cache = new Map();
const fail = status => Object.assign(new Error('Den offentlige vurdering kunne ikke hentes lige nu.'), { status });
export async function getPublicValuation({ bfe }, { apiKey = process.env.DATAFORDELER_API_KEY, fetcher = fetch } = {}) {
  if (typeof bfe !== 'string' || !/^[1-9]\d{0,14}$/.test(bfe) || !Number.isSafeInteger(Number(bfe))) throw fail(400);
  if (!apiKey?.trim()) throw fail(503);
  const cached = cache.get(bfe); if (cached && Date.now()-cached.at < 3600000) return cached.value;
  const url = new URL('https://graphql.datafordeler.dk/flexible/v3'); url.searchParams.set('apiKey',apiKey.trim());
  const now = new Date().toISOString(), signal = AbortSignal.timeout(18000);
  async function query(root, where, fields) {
    const rows = []; let after = '';
    for (let page=0;page<3;page++) {
      const query = `{ ${root}(first:100,registreringstid:${JSON.stringify(now)},virkningstid:${JSON.stringify(now)},where:${where}${after?`,after:${JSON.stringify(after)}`:''}){nodes{${fields}} pageInfo{hasNextPage endCursor}} }`;
      let response, data;
      try { response = await fetcher(url, { method:'POST', headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({query}),signal,redirect:'error' }); data = await response.json(); } catch { throw fail(502); }
      if (!response.ok || data.errors?.length || !Array.isArray(data.data?.[root]?.nodes)) throw fail(response.status===401||response.status===403?503:502);
      const result=data.data[root]; rows.push(...result.nodes);
      if (!result.pageInfo?.hasNextPage) return rows;
      after=result.pageInfo.endCursor; if (!after) throw fail(502);
    }
    // Never label a truncated result as the latest official assessment.
    throw fail(502);
  }
  const references = await query('VUR_BFEKrydsreference',`{BFEnummer:{eq:${bfe}}}`,'BFEnummer fkEjendomsvurderingID');
  if (references.some(row=>String(row.BFEnummer)!==bfe)) throw fail(502);
  const ids=[...new Set(references.map(row=>row.fkEjendomsvurderingID))];
  if (ids.some(id=>!Number.isSafeInteger(Number(id))||!/^\d+$/.test(String(id)))) throw fail(502);
  const records=[];
  for(let offset=0;offset<ids.length;offset+=50) records.push(...await query('VUR_Ejendomsvurdering',`{id:{in:[${ids.slice(offset,offset+50).join(',')}]}}`,'id aar ejendomvaerdiBeloeb grundvaerdiBeloeb fkVurderingsejendomID ajourfoeringDato'));
  if (records.some(row=>!ids.some(id=>String(id)===String(row.id)))) throw fail(502);
  const amount = value => value!==null && value!==undefined && Number.isSafeInteger(Number(value)) && Number(value)>=0 ? Number(value) : null;
  const groups=new Map();
  for(const row of records) {
    const year=Number(row.aar), group=String(row.fkVurderingsejendomID);
    if (!Number.isInteger(year) || year<1900 || year>Number(now.slice(0,4)) || !/^\d+$/.test(group)) continue;
    const entry={ id:String(row.id), year, propertyValue:amount(row.ejendomvaerdiBeloeb), landValue:amount(row.grundvaerdiBeloeb), updatedAt:row.ajourfoeringDato ?? null };
    if (!groups.has(group)) groups.set(group,[]); groups.get(group).push(entry);
  }
  const assessments=[...groups].map(([id,history])=> {
    // Same-year corrections are resolved by register update date, then ID.
    history.sort((a,b)=>b.year-a.year || String(b.updatedAt).localeCompare(String(a.updatedAt)) || Number(b.id)-Number(a.id));
    const years=new Set(); const unique=history.filter(row=>!years.has(row.year)&&years.add(row.year));
    return { id, latest:unique[0], history:unique };
  });
  const value={bfe,assessments,source:'Vurderingsstyrelsen · VUR via Datafordeleren',fetchedAt:now,status:assessments.length?'available':'not_found',notice:'VUR kan mangle nyere vurderinger. Årstallet gælder registerets vurdering, ikke en aktuel salgspris. Foreløbig/endelig status er ikke oplyst i dette opslag.'};
  if(cache.size>=128)cache.delete(cache.keys().next().value);cache.set(bfe,{at:Date.now(),value});return value;
}
