// Synthetic aerial scene: a south wall whose real plane is inset behind the footprint (roof edge), photographed by calibrated cameras.
export const GROUND=7.4,EAVES=10.4,TRUE_INSET=0.55;
export const footprint=[[0,0],[12,0],[12,8],[0,8]];
export const building={id:'b',main:true,rings:[footprint]};
export const heights={bbox:[-10,-10,30,20],width:80,height:60,terrain:Array(4800).fill(GROUND),surface:Array(4800).fill(EAVES)};
export const windows=[{u0:1.2,u1:2.6,z0:8.3,z1:9.5,kind:'window'},{u0:4.0,u1:6.4,z0:8.3,z1:9.5,kind:'window'},{u0:8.0,u1:9.0,z0:7.4,z1:9.4,kind:'door'},{u0:10.2,u1:11.2,z0:8.5,z1:9.5,kind:'window'}];
let seed=7;const rnd=()=>(seed=(seed*1664525+1013904223)>>>0)/4294967296;
const hash=(a,b)=>{let h=(a*374761393+b*668265263)>>>0;h=((h^(h>>>13))*1274126177)>>>0;return (h^(h>>>16))/4294967296;};
const wallTexture=(u,z)=>{
 for(const w of windows)if(u>=w.u0&&u<=w.u1&&z>=w.z0&&z<=w.z1){const edge=Math.min(u-w.u0,w.u1-u,z-w.z0,w.z1-z);return edge<0.07?235:55;}
 return 140+40*hash(Math.floor(u/0.3),Math.floor(z/0.18));
};
function lookAt(center,target){
 const f=target.map((v,i)=>v-center[i]),n=Math.hypot(...f),fw=f.map(v=>v/n),zc=fw.map(v=>-v);
 const right=[fw[1],-fw[0],0],rn=Math.hypot(right[0],right[1]),xc=[right[0]/rn,right[1]/rn,0];
 const yc=[zc[1]*xc[2]-zc[2]*xc[1],zc[2]*xc[0]-zc[0]*xc[2],zc[0]*xc[1]-zc[1]*xc[0]];
 return [...xc,...yc,...zc];
}
/** Photograph with 9 cm ground sampling; `error` is a calibration error (metres) of the camera handed to the pipeline. */
export function renderPhoto({azimuth,elevation,distance=3000,error=[0,0,0],day=10}){
 const target=[6,0,9],dir=[Math.sin(azimuth)*Math.cos(elevation),-Math.cos(azimuth)*Math.cos(elevation),Math.sin(elevation)];
 const center=dir.map((v,i)=>target[i]+v*distance),rotation=lookAt(center,target);
 const camera={rotation,center:center.map((v,i)=>v+error[i]),focal:[32813,32813],principal:[5000,3500],sensor:[10000,7000]};
 const project=P=>{const d=P.map((v,i)=>v-center[i]),zc=rotation[6]*d[0]+rotation[7]*d[1]+rotation[8]*d[2];return [5000-32813*(rotation[0]*d[0]+rotation[1]*d[1]+rotation[2]*d[2])/zc,3500+32813*(rotation[3]*d[0]+rotation[4]*d[1]+rotation[5]*d[2])/zc];};
 const corners=[[0,0,GROUND],[12,0,GROUND],[12,0,EAVES+1],[0,0,EAVES+1]].map(project),left=Math.floor(Math.min(...corners.map(c=>c[0])))-12,top=Math.floor(Math.min(...corners.map(c=>c[1])))-12,right=Math.ceil(Math.max(...corners.map(c=>c[0])))+12,bottom=Math.ceil(Math.max(...corners.map(c=>c[1])))+12;
 const width=right-left,height=bottom-top,rgb=new Uint8ClampedArray(width*height*3);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  let sum=0;
  for(let sy=0;sy<3;sy++)for(let sx=0;sx<3;sx++){
   const px=left+x+(sx+0.5)/3,py=top+y+(sy+0.5)/3,xc=(px-5000)/32813,yc=-(py-3500)/32813,ray=[0,1,2].map(k=>xc*rotation[k]+yc*rotation[3+k]-rotation[6+k]);
   const t=((0-center[1])+TRUE_INSET)/ray[1],hit=[center[0]+ray[0]*t,center[1]+ray[1]*t,center[2]+ray[2]*t];
   sum+=t>0&&hit[0]>=0&&hit[0]<=12&&hit[2]>=GROUND&&hit[2]<=EAVES?wallTexture(hit[0],hit[2]):90+40*hash(Math.floor(px*0.5),Math.floor(py*0.5));
  }
  const v=sum/9+(rnd()-0.5)*4;for(let k=0;k<3;k++)rgb[(y*width+x)*3+k]=v;
 }
 return {id:`photo-${azimuth.toFixed(2)}-${elevation.toFixed(2)}`,capturedAt:`2025-05-${String(day).padStart(2,'0')}T10:00:00Z`,asset:'synthetic',camera,window:{left,top,width,height,rgb}};
}
const deg=Math.PI/180;
export const cameraSet=(scale=1)=>[
 renderPhoto({azimuth:-12*deg,elevation:38*deg,error:[0.15*scale,-0.1*scale,0.1*scale],day:10}),
 renderPhoto({azimuth:0,elevation:42*deg,error:[-0.2*scale,0.1*scale,-0.1*scale],day:11}),
 renderPhoto({azimuth:15*deg,elevation:60*deg,error:[0.05*scale,0.2*scale,0.15*scale],day:12}),
 renderPhoto({azimuth:-22*deg,elevation:57*deg,error:[-0.1*scale,-0.15*scale,0.05*scale],day:13}),
 renderPhoto({azimuth:8*deg,elevation:36*deg,error:[0.1*scale,0.05*scale,-0.15*scale],day:14}),
];
