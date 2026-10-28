import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {publicPricePage,renderPricePage,pricePageSelection} from '../src/services/public-price-page.mjs';
import {midnight,nextDate} from '../public/landing/prices.mjs';
const template=await readFile('public/elpriser.html','utf8');
export const fixture=(supplierId,day)=>({supplier:{id:supplierId},points:Array.from({length:(midnight(nextDate(day))-midnight(day))/900000},(_,i)=>({startsAt:new Date(midnight(day)+i*900000).toISOString(),totalOrePerKwh:i>=8&&i<12?-20:120+i}))});
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.statusCode=code;return this;},send(body){this.body=body;return this;}});
for(const [day,count]of[['2026-10-28',96],['2026-10-25',100],['2026-03-29',92]]){
 const selection=pricePageSelection(),now=midnight(day)+10*3600000;
 const html=renderPricePage(template,{selection,payload:fixture('n1_c',day),now});
 assert.equal((html.match(/<tr><td>/g)||[]).length,count);
 assert.ok(!html.includes('id="price-results" class="price-results" hidden'));assert.match(html,/Hentet/);assert.match(html,/-0,20/);assert.match(html,/Genindlæs siden/);assert.ok(html.includes('id="price-current"'));
 if(count===100){assert.ok(html.includes('GMT+2'));assert.ok(html.includes('GMT+1'));}
}
assert.throws(()=>pricePageSelection({priceArea:'DK9'}));assert.throws(()=>pricePageSelection({day:['today','tomorrow']}));assert.throws(()=>pricePageSelection({supplierId:'radius_c',priceArea:'DK1'}));assert.throws(()=>pricePageSelection({supplierId:'<script>'}));
const now=Date.parse('2026-10-28T10:00:00Z'),query={operation:'public-page',priceArea:'DK2',supplierId:'cerius_c',day:'tomorrow',from:'untrusted',to:'untrusted'};
const res=response();let passed;
await publicPricePage({query},res,{now:()=>now,getPrices:async params=>{passed=params;return {...fixture(params.supplierId,'2026-10-28'),points:[...fixture(params.supplierId,'2026-10-28').points,...fixture(params.supplierId,'2026-10-29').points]};}});
assert.equal(res.statusCode,200);assert.equal(res.headers['Content-Type'],'text/html; charset=utf-8');assert.equal(res.headers['Cache-Control'],'public, max-age=0, s-maxage=60, must-revalidate');assert.deepEqual(passed,{supplierId:'cerius_c',priceArea:'DK2'});assert.match(res.body,/value="cerius_c" selected/);assert.match(res.body,/data-price-day="tomorrow"/);assert.match(res.body,/29\. oktober/);assert.match(res.body,/id="price-current"[^>]*>—/);
const missing=response();await publicPricePage({query:{day:'tomorrow'}},missing,{now:()=>now,getPrices:async()=>fixture('n1_c','2026-10-28')});assert.equal(missing.statusCode,200);assert.match(missing.body,/Morgendagens priser er endnu ikke/);assert.match(missing.body,/id="price-results" class="price-results" hidden/);
for(const getPrices of [async()=>{throw Error('secret upstream detail');},async()=>({...fixture('n1_c','2026-10-28'),points:fixture('n1_c','2026-10-28').points.slice(1)}),async()=>fixture('radius_c','2026-10-28')]){
 const failed=response();await publicPricePage({query:{}},failed,{now:()=>now,getPrices});assert.equal(failed.statusCode,503);assert.equal(failed.headers['Cache-Control'],'no-store');assert.equal(failed.headers['Retry-After'],'60');assert.ok(!failed.body.includes('secret upstream detail'));assert.ok(!failed.body.includes('<tr><td>'));assert.match(failed.body,/midlertidigt utilgængelige/);
}
const invalid=response();await publicPricePage({query:{day:'bad'}},invalid,{getPrices:async()=>{throw Error('must not fetch');}});assert.equal(invalid.statusCode,400);assert.equal(invalid.headers['Cache-Control'],'no-store');
const escaped=renderPricePage(template,{selection:{...pricePageSelection(),supplier:{...pricePageSelection().supplier,name:'<img src=x onerror=alert(1)>'}},payload:fixture('n1_c','2026-10-28'),now});assert.ok(!escaped.includes('<img src=x'));assert.ok(escaped.includes('&lt;img'));
const config=JSON.parse(await readFile('vercel.json','utf8'));assert.ok(config.rewrites.some(r=>r.source==='/elpriser.html'&&r.destination==='/api/grid/lookup?operation=public-page'));assert.equal(config.functions['api/grid/lookup.mjs'].includeFiles,'public/elpriser.html');assert.equal(config.crons.length,5);await assert.rejects(access('web-build/huslyg-public/elpriser.html'));
console.log('Passed: SSR initial HTML, 23/24/25-hour days, tomorrow/region selection, bounded queries, escaped content, missing/invalid/error behavior, cache policy and non-shadowed Vercel route.');
