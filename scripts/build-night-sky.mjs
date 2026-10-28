import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';

const get=async url=>{const response=await fetch(url,{signal:AbortSignal.timeout(60000)});assert.equal(response.status,200,url);return response;};
const catalogueUrl='https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/stars.6.json';
const dataUrl='https://raw.githubusercontent.com/ofrohn/d3-celestial/master/data/';
const moonUrl='https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_1k.jpg';
const [catalogue,lines,names,galaxy]=await Promise.all([catalogueUrl,dataUrl+'constellations.lines.json',dataUrl+'constellations.json',dataUrl+'mw.json'].map(async url=>(await get(url)).json()));
const stars=catalogue.features.map(feature=>[...feature.geometry.coordinates,feature.properties.mag,Number(feature.properties.bv)]);
assert.ok(stars.length>4000&&stars.length<6000);assert.ok(stars.every(star=>star.length===4&&star.every(Number.isFinite)));
const constellations=lines.features.map(f=>{const label=names.features.find(n=>n.id===f.id);assert.ok(label);return {id:f.id,name:label.properties.name,position:label.geometry.coordinates,lines:f.geometry.coordinates};});
assert.equal(constellations.length,89);
const milkyWay=galaxy.features.map(f=>f.geometry.coordinates);
assert.equal(milkyWay.length,5);
const coordinate=p=>assert.ok(p.length===2&&p.every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90);
for(const c of constellations){coordinate(c.position);c.lines.flat().forEach(coordinate);}
milkyWay.flat(3).forEach(coordinate);
const moon=await get(moonUrl);assert.match(moon.headers.get('content-type'),/^image\/jpeg/);
const image=Buffer.from(await moon.arrayBuffer());assert.ok(image.length>10000&&image.length<1000000);
const licence=await(await get('https://raw.githubusercontent.com/ofrohn/d3-celestial/master/LICENSE')).text();
assert.match(licence,/Redistribution and use/);
const assets={stars,constellations,milkyWay,moonTexture:'data:image/jpeg;base64,'+image.toString('base64'),catalogueUrl,moonUrl,dataUrl,credits:'Stars: XHIP (Anderson & Francis 2012), J2000. Constellations and Milky Way outlines: d3-celestial / Olaf Frohn (BSD-3-Clause). Moon: NASA Scientific Visualization Studio / LRO / LROC / LOLA.',licence};
await writeFile('src/generated/night-sky-assets.ts','export const nightSkyAssets='+JSON.stringify(assets)+';\n');
console.log('Verified sky assets: '+stars.length+' catalogue stars, '+constellations.length+' constellation entries, '+milkyWay.length+' Milky Way contours and '+image.length+' lunar texture bytes.');