import assert from 'node:assert/strict';
import jpeg from 'jpeg-js';
import {brickPixelColor} from '../src/services/brick-pixel-color.mjs';
const width=80,height=40,data=Buffer.alloc(width*height*4);
for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y*width+x)*4,c=x<40?[155,60,35]:[195,195,195];data[i]=c[0];data[i+1]=c[1];data[i+2]=c[2];data[i+3]=255;}
const image=jpeg.encode({width,height,data},100).data.toString('base64');
const patches=['a','b'].map((id,i)=>({id,viewId:`view${i}`,image}));
const samples=patches.map(p=>({patchId:p.id,polygons:[[[.1,.2],[.4,.2],[.4,.8],[.1,.8]]]}));
const result=brickPixelColor(samples,patches),rgb=result.color.match(/[0-9a-f]{2}/g).map(v=>parseInt(v,16));
assert.ok(rgb.every((v,i)=>Math.abs(v-[155,60,35][i])<4),'Must sample brick red, not average grey mortar');assert.equal(result.source,'original-pixels');assert.equal(result.patchIds.length,2);
assert.equal(brickPixelColor(samples.slice(0,1),patches),null,'A single view cannot establish colour');
assert.equal(brickPixelColor(samples,[patches[0],{...patches[1],viewId:'view0'}]),null);
const duplicates=brickPixelColor([...samples,samples[0]],patches);assert.equal(duplicates.color,result.color);
console.log('Original-pixel colour: selected brick interiors exclude mortar, no inferred hex, two independent views, tiny selections abstain.');
