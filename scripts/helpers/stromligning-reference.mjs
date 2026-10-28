// Comparison tool only. Never import this module into the app or production API.
export async function fetchStromligningReference({supplierId,area,from,to,forecast=false},fetcher=fetch){
 const url=new URL('https://stromligning.dk/api/prices');url.search=new URLSearchParams({supplierId,customerGroupId:'c',priceArea:area,from,to,forecast:String(forecast)});
 const response=await fetcher(url,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Object.assign(Error('Reference HTTP '+response.status),{status:response.status});
 const data=await response.json();if(!Array.isArray(data.prices))throw Error('Ugyldigt referencesvar');return data;
}
