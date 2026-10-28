import jpeg from 'jpeg-js';
const inside=(x,y,ring)=>{let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
const median=values=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)];
/** Gemini selects pixels; only original JPEG values determine the colour. */
export function brickPixelColor(samples,patches){
 if(!Array.isArray(samples)||!samples.length||samples.length>100)throw Error('INVALID_SAMPLES');
 const views=new Map(),decoded=new Map(),evidence=new Set();
 for(const sample of samples){
  const patch=patches.find(p=>p.id===sample.patchId),polygons=sample.polygons;
  if(!patch||!Array.isArray(polygons)||!polygons.length||polygons.length>60)throw Error('INVALID_SAMPLES');
  let image=decoded.get(patch.id);if(!image){image=jpeg.decode(Buffer.from(patch.image,'base64'),{useTArray:true,maxResolutionInMP:2,maxMemoryUsageInMB:40});decoded.set(patch.id,image);}
  const selected=new Set();
  for(const polygon of polygons){
   if(!Array.isArray(polygon)||polygon.length<3||polygon.length>12||polygon.some(p=>!Array.isArray(p)||p.length!==2||p.some(v=>!Number.isFinite(v)||v<0||v>1)))throw Error('INVALID_POLYGON');
   const centre=[0,1].map(k=>polygon.reduce((n,p)=>n+p[k],0)/polygon.length);
   // Inset selection to reduce joint/edge contamination, never upscale or recolour.
   const ring=polygon.map(p=>p.map((v,k)=>centre[k]+(v-centre[k])*.8));
   const left=Math.max(0,Math.floor(Math.min(...ring.map(p=>p[0]))*image.width)),right=Math.min(image.width,Math.ceil(Math.max(...ring.map(p=>p[0]))*image.width));
   const top=Math.max(0,Math.floor(Math.min(...ring.map(p=>p[1]))*image.height)),bottom=Math.min(image.height,Math.ceil(Math.max(...ring.map(p=>p[1]))*image.height));
   for(let y=top;y<bottom;y++)for(let x=left;x<right;x++)if(inside((x+.5)/image.width,(y+.5)/image.height,ring))selected.add(y*image.width+x);
  }
  const rgb=[];for(const i of selected){const at=i*4,c=[image.data[at],image.data[at+1],image.data[at+2]],l=c.reduce((a,b)=>a+b,0)/3;if(l>12&&l<245)rgb.push(c);}
  if(rgb.length<6||rgb.length<selected.size*.9)continue; // Reject polygons that mostly select excluded black geometry.
  const view=views.get(patch.viewId)??{rgb:[],ids:new Set()};view.rgb.push(...rgb);view.ids.add(patch.id);views.set(patch.viewId,view);
 }
 const candidates=[...views.values()].map(v=>({...v,color:[0,1,2].map(k=>median(v.rgb.map(c=>c[k])))}));
 const chroma=c=>{const sum=c.reduce((a,b)=>a+b,0);return c.map(v=>v/sum);};
 const agreeing=candidates.map(a=>candidates.filter(b=>Math.hypot(...chroma(a.color).map((v,i)=>v-chroma(b.color)[i]))<.1)).sort((a,b)=>b.length-a.length)[0]??[];
 if(agreeing.length<2||agreeing.length<Math.ceil(candidates.length*.6))return null;
 for(const view of agreeing)for(const id of view.ids)evidence.add(id);
 const color='#'+[0,1,2].map(k=>median(agreeing.map(v=>v.color[k])).toString(16).padStart(2,'0')).join('');
 return {color,patchIds:[...evidence],samplePixels:agreeing.reduce((n,v)=>n+v.rgb.length,0),source:'original-pixels'};
}
