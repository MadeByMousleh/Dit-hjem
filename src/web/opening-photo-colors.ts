import type {AerialOpenings} from '../services/aerial-openings';
type RGB=[number,number,number];
export type PhotoPixels={width:number;height:number;data:Uint8ClampedArray};
const hex=(rgb:RGB)=>'#'+rgb.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
const median=(ns:number[])=>ns.sort((a,b)=>a-b)[Math.floor(ns.length/2)]!;
/** Sample only the traced outer-frame band, never the central glass area.
 * Works on source pixels at their native resolution: no upscaling or blur. */
export function openingFrameSample(image:PhotoPixels,quad:number[][]):RGB|null{
 if(quad.length!==4)return null;const samples:RGB[]=[];
 const point=(u:number,v:number)=>[0,1].map(axis=>(1-v)*((1-u)*quad[0]![axis]!+u*quad[1]![axis]!)+v*((1-u)*quad[3]![axis]!+u*quad[2]![axis]!));
 for(let side=0;side<4;side++)for(let i=2;i<19;i++)for(const inset of [.025,.055,.085]){
  const t=i/20,[x,y]=point(side===0?inset:side===1?1-inset:t,side===2?inset:side===3?1-inset:t);
  const px=Math.max(0,Math.min(image.width-1,Math.round(x!*image.width))),py=Math.max(0,Math.min(image.height-1,Math.round(y!*image.height))),at=(py*image.width+px)*4,rgb=[image.data[at]!,image.data[at+1]!,image.data[at+2]!] as RGB;
  if(Math.max(...rgb)<45||Math.min(...rgb)>249)continue;samples.push(rgb);
 }
 if(samples.length<12)return null;
 // White painted frames are easily darkened by glass/shadow at tiny image
 // resolutions. Prefer a supported neutral bright cluster, not one bright pixel.
 const neutral=samples.filter(c=>Math.max(...c)-Math.min(...c)<38&&Math.min(...c)>150);
 const chosen=neutral.length>=Math.max(12,samples.length*.18)?neutral:samples;
 return [0,1,2].map(i=>median(chosen.map(c=>c[i]!))) as RGB;
}
export function photographicOpeningColors(opening:AerialOpenings['views'][number]['openings'][number],pixels:PhotoPixels|undefined){
 const sample=pixels?openingFrameSample(pixels,opening.quad):null;
 const panel:RGB[]=[];
 if(pixels&&opening.kind!=='window')for(let row=0;row<9;row++)for(let col=0;col<9;col++){
  const u=.25+col/16,v=.25+row/16,q=opening.quad,coords=[0,1].map(axis=>(1-v)*((1-u)*q[0]![axis]!+u*q[1]![axis]!)+v*((1-u)*q[3]![axis]!+u*q[2]![axis]!)),x=Math.max(0,Math.min(pixels.width-1,Math.round(coords[0]!*pixels.width))),y=Math.max(0,Math.min(pixels.height-1,Math.round(coords[1]!*pixels.height))),i=(y*pixels.width+x)*4;
  panel.push([pixels.data[i]!,pixels.data[i+1]!,pixels.data[i+2]!]);
 }
 const panelColor=panel.length?hex([0,1,2].map(i=>median(panel.map(c=>c[i]!))) as RGB):'#8a8b88';
 return {frameColor:sample?hex(sample):'#dddcd8',panelColor:opening.kind==='window'?'#526574':panelColor,frameSample:sample};
}
/** Only unify light neutral frames when independently visible openings support
 * them. A clearly coloured frame is retained; shadow-dark ambiguous frames are
 * not treated as evidence of a different paint colour. */
export function harmonizeFrames<T extends {frameColor?:string;frameSample?:RGB|null}>(openings:T[]){
 const supported=openings.filter(o=>o.frameSample&&Math.min(...o.frameSample)>150&&Math.max(...o.frameSample)-Math.min(...o.frameSample)<38);
 if(supported.length<2||supported.length<openings.length*.5)return;
 const rgb=[0,1,2].map(i=>median(supported.map(o=>o.frameSample![i]!))) as RGB;
 for(const o of openings){const c=o.frameSample;if(!c||Math.max(...c)-Math.min(...c)<38)o.frameColor=hex(rgb);}
}
