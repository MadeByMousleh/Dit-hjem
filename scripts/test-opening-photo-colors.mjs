import assert from 'node:assert/strict';
import {build} from 'esbuild';
const result=await build({entryPoints:['src/web/opening-photo-colors.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {openingFrameSample,harmonizeFrames,photographicOpeningColors}=await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const width=100,height=100,data=new Uint8ClampedArray(width*height*4),quad=[[.1,.1],[.9,.1],[.9,.9],[.1,.9]];
for(let y=0;y<height;y++)for(let x=0;x<width;x++){const frame=x>=10&&x<=90&&y>=10&&y<=90&&(x<19||x>81||y<19||y>81),rgb=frame?[225,226,223]:[20,25,30],i=(y*width+x)*4;data.set([...rgb,255],i);}
assert.deepEqual(openingFrameSample({width,height,data},quad),[225,226,223]);
const opening={kind:'window',quad,confidence:.9,frameColor:'#000000',panelColor:'#ffffff'};
assert.equal(photographicOpeningColors(opening,{width,height,data}).frameColor,'#e1e2df');
assert.equal(photographicOpeningColors(opening,undefined).frameColor,'#dddcd8');
assert.equal(photographicOpeningColors({...opening,kind:'door',panelColor:'#ffffff'},{width,height,data}).panelColor,'#14191e','Door panel uses actual interior pixels, not the AI-proposed white');
const frames=[{frameColor:'#eeeeee',frameSample:[225,226,223]},{frameColor:'#dddddd',frameSample:[221,222,219]},{frameColor:'#111111',frameSample:[75,76,73]}];harmonizeFrames(frames);assert.equal(frames[0].frameColor,frames[2].frameColor);
const distinct=[{frameColor:'#ff0000',frameSample:[200,30,20]},...frames];harmonizeFrames(distinct);assert.equal(distinct[0].frameColor,'#ff0000');
console.log('Original-pixel window frames: glass excluded, guessed hex ignored, supported neutral frames harmonized, distinct paint retained.');
