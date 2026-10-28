import {runsFor} from './sampling.mjs';

export function polygonMask(points,width,height){
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>1500000)throw Error('Ugyldig billedstørrelse.');
  if(!Array.isArray(points)||points.length<3||points.length>64||points.some(p=>!Array.isArray(p)||p.length!==2||p.some(v=>!Number.isFinite(v)||v<0||v>1)))throw Error('Tegn mindst tre og højst 64 punkter inden for billedet.');
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const on=(a,b,p)=>Math.abs(cross(a,b,p))<1e-10&&p[0]>=Math.min(a[0],b[0])-1e-10&&p[0]<=Math.max(a[0],b[0])+1e-10&&p[1]>=Math.min(a[1],b[1])-1e-10&&p[1]<=Math.max(a[1],b[1])+1e-10;
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length];
    if(Math.hypot(a[0]-b[0],a[1]-b[1])<1e-8)throw Error('To punkter ligger oven i hinanden.');
    for(let j=i+1;j<points.length;j++){
      if(j===i+1||(i===0&&j===points.length-1))continue;
      const c=points[j],d=points[(j+1)%points.length];
      if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b))throw Error('Områdets kanter må ikke krydse hinanden.');
    }
  }
  const left=Math.floor(Math.min(...points.map(p=>p[0]))*width),top=Math.floor(Math.min(...points.map(p=>p[1]))*height);
  const right=Math.min(width,Math.ceil(Math.max(...points.map(p=>p[0]))*width)),bottom=Math.min(height,Math.ceil(Math.max(...points.map(p=>p[1]))*height));
  if(right<=left||bottom<=top)throw Error('Området er for lille.');
  const cropWidth=right-left,cropHeight=bottom-top,indices=[];
  for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
    const px=(x+.5)/width,py=(y+.5)/height;let inside=false;
    for(let i=0,j=points.length-1;i<points.length;j=i++){
      const a=points[i],b=points[j];if((a[1]>py)!==(b[1]>py)&&px<(b[0]-a[0])*(py-a[1])/(b[1]-a[1])+a[0])inside=!inside;
    }
    if(inside)indices.push((y-top)*cropWidth+x-left);
  }
  return {width:cropWidth,height:cropHeight,contextCrop:[left,top,right,bottom],indices,maskRuns:runsFor(indices)};
}
