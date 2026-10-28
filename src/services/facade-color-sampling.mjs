// Shared by the isolated renderer adapter and server. Pixel coordinates only;
// these checks do not prove that the source geometry is correctly aligned.
export const SAMPLING_VERSION=2;
export function runsFor(indices){
  const runs=[];
  for(const i of indices){const last=runs.at(-1);if(last&&last[0]+last[1]===i)last[1]++;else runs.push([i,1]);}
  return runs;
}
export function maskFromRuns(runs,width,height){
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width*height>1500000||!Array.isArray(runs))throw Error('Ugyldig facademaske.');
  const mask=new Uint8Array(width*height);let end=0;
  for(const run of runs){
    if(!Array.isArray(run)||run.length!==2)throw Error('Ugyldig facademaske.');
    const [start,length]=run;
    if(!Number.isInteger(start)||!Number.isInteger(length)||start<end||length<1||start+length>mask.length)throw Error('Ugyldig facademaske.');
    mask.fill(1,start,start+length);end=start+length;
  }
  return mask;
}
export function assessMask(indices,width){
  if(!indices.length)return {accepted:false,reason:'Ingen sammenhængende facade efter kantmargin.'};
  let left=Infinity,right=-1,top=Infinity,bottom=-1;
  for(const i of indices){const x=i%width,y=Math.floor(i/width);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  const spanX=right-left+1,spanY=bottom-top+1,coverage=indices.length/(spanX*spanY);
  const reason=indices.length<128?'For lille facadeområde (mindst 128 pixels).':Math.min(spanX,spanY)<8?'For smalt facadeudsnit (mindst 8 pixels på begge led).':coverage<.15?'For spredt facadeområde.':null;
  return {accepted:!reason,reason,pixels:indices.length,coverage,span:[spanX,spanY]};
}
export function conservativeInterior(indices,width,height){
  const initial=assessMask(indices,width),short=Math.min(...(initial.span??[0,0]));
  const margin=Math.max(2,Math.min(5,Math.ceil(short*.015)));
  const mask=new Uint8Array(width*height);for(const i of indices)mask[i]=1;
  const stride=width+1,integral=new Uint32Array(stride*(height+1));
  for(let y=0;y<height;y++){let sum=0;for(let x=0;x<width;x++){sum+=mask[y*width+x];integral[(y+1)*stride+x+1]=integral[y*stride+x+1]+sum;}}
  const retained=[],area=(margin*2+1)**2;
  for(const i of indices){const x=i%width,y=Math.floor(i/width);if(x<margin||y<margin||x+margin>=width||y+margin>=height)continue;
    const l=x-margin,r=x+margin+1,t=y-margin,b=y+margin+1;
    if(integral[b*stride+r]-integral[t*stride+r]-integral[b*stride+l]+integral[t*stride+l]===area)retained.push(i);
  }
  return {...assessMask(retained,width),margin,indices:retained};
}
export const photoKey=photo=>JSON.stringify([photo.direction,photo.capturedAt,photo.camera?.crop??null]);
