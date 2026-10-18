const cache=new Map();
export async function getHomeEnergyLabel({buildingId},{username=process.env.EMODATA_USERNAME,password=process.env.EMODATA_PASSWORD,fetcher=fetch}={}){
  if(typeof buildingId!=='string'||! /^[0-9a-f-]{36}$/i.test(buildingId))throw Object.assign(new Error('Ugyldig bygning.'),{status:400});
  const base={buildingId,source:'Energistyrelsen · EMOData',fetchedAt:new Date().toISOString()};
  if(!username||!password)return {...base,status:'access_not_configured',labels:[]};
  const cached=cache.get(buildingId);if(cached&&Date.now()-cached.at<3600000)return cached.value;
  const r=await fetcher(`https://emoweb.dk/EMOData/EMOData.svc/SearchEnergyLabelUID/${buildingId}`,{headers:{Authorization:`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,Accept:'application/json'},signal:AbortSignal.timeout(12000),redirect:'error'});
  if(!r.ok)return {...base,status:r.status===401||r.status===403?'access_denied':'unavailable',labels:[]};
  const data=await r.json();
  if(data.ResponseStatus?.Status==='ACCESS_DENIED')return {...base,status:'access_denied',labels:[]};
  if(!Array.isArray(data.SearchResults))return {...base,status:'unavailable',labels:[]};
  const date=value=>{if(typeof value!=='string')return null;const dotnet=value.match(/^\/Date\((-?\d+)(?:[+-]\d{4})?\)\/$/);const d=new Date(dotnet?Number(dotnet[1]):value);return Number.isFinite(d.getTime())?d.toISOString().slice(0,10):null;};
  const labels=data.SearchResults.filter(r=>!r.IsHidden).map(r=>({id:String(r.EntityIdentifier??''),grade:String(r.EnergyLabelClassification??''),validFrom:date(r.ValidFrom),validUntil:date(r.ValidTo),providerStatus:String(r.LabelStatus??''),buildingNumber:String(r.BuildingNumber??''),heating:String(r.HeatSupply??''),company:String(r.SubmitterCompanyName??'')})).filter(r=>/^\d{6,12}$/.test(r.id)&&/^(A(?:\s*\(?20(?:10|15|20)\)?)?|[B-G])$/i.test(r.grade));
  labels.sort((a,b)=>String(b.validFrom).localeCompare(String(a.validFrom)));
  // An HTTP 200 can contain a provider error. Empty arrays are not proof that no label exists.
  const value={...base,status:labels.length?'available':'unavailable',labels};if(labels.length){if(cache.size>=100)cache.delete(cache.keys().next().value);cache.set(buildingId,{at:Date.now(),value});}return value;
}
