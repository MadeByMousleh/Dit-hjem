// Multi-view facade reconstruction from calibrated oblique aerial photographs.
// Pure geometry/image maths (no network): footprint walls are rectified from
// several photographs (all survey years), the real wall plane is found by
// plane-sweep photo-consistency, views are registered and fused into one clean
// front-on image per wall. All coordinates are EPSG:25832 east/north + DVR90 z.
const luma=(r,g,b)=>0.299*r+0.587*g+0.114*b;
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));

/** Exterior wall segments from footprint rings. Rings are made counter-clockwise, so the outward normal is (dy,-dx). */
export function wallSegments(buildings,{minLength=1}={}){
 const segments=[];
 for(const building of buildings){
  const ring=(building.rings?.[0]??[]).filter((p,i,r)=>i===0||p[0]!==r[i-1][0]||p[1]!==r[i-1][1]).map(p=>[p[0],p[1]]);
  if(ring.length>1&&ring[0][0]===ring.at(-1)[0]&&ring[0][1]===ring.at(-1)[1])ring.pop();
  if(ring.length<3)continue;
  if(ring.reduce((sum,a,i)=>{const b=ring[(i+1)%ring.length];return sum+a[0]*b[1]-b[0]*a[1];},0)<0)ring.reverse();
  for(let changed=true;changed&&ring.length>3;){changed=false;for(let i=0;i<ring.length;i++){
   const a=ring[(i+ring.length-1)%ring.length],p=ring[i],b=ring[(i+1)%ring.length],ux=p[0]-a[0],uy=p[1]-a[1],vx=b[0]-p[0],vy=b[1]-p[1];
   if(ux*vx+uy*vy>0&&Math.abs(ux*vy-uy*vx)<=0.015*Math.hypot(ux,uy)*Math.hypot(vx,vy)){ring.splice(i,1);changed=true;break;}
  }}
  for(let i=0;i<ring.length;i++){
   const a=ring[i],b=ring[(i+1)%ring.length],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);if(length<minLength)continue;
   segments.push({id:`${building.id}:${i}`,buildingId:building.id,target:Boolean(building.main||building.associated),a,b,length,ex:dx/length,ey:dy/length,nx:dy/length,ny:-dx/length});
  }
 }
 return segments;
}

export function rasterSampler(heights,key){
 const [left,bottom,right,top]=heights.bbox;
 return (east,north)=>{
  const col=Math.floor((east-left)/(right-left)*heights.width),row=Math.floor((top-north)/(top-bottom)*heights.height);
  if(col<0||row<0||col>=heights.width||row>=heights.height)return null;
  const value=heights[key][row*heights.width+col];return Number.isFinite(value)?value:null;
 };
}
const quantile=(values,q)=>{const sorted=values.slice().sort((a,b)=>a-b);return sorted[Math.min(sorted.length-1,Math.floor(q*sorted.length))];};
/** Ground from terrain just outside the wall; eaves from the surface raster just inside it (the footprint is the roof edge). */
export function wallLevels(segment,heights,fallbackHeight=3){
 const terrain=rasterSampler(heights,'terrain'),surface=rasterSampler(heights,'surface'),ground=[],roof=[];
 for(let u=0.2;u<segment.length;u+=0.4){
  const east=segment.a[0]+segment.ex*u,north=segment.a[1]+segment.ey*u;
  const g=terrain(east+segment.nx,north+segment.ny),s=surface(east-segment.nx*0.5,north-segment.ny*0.5);
  if(g!==null)ground.push(g);if(s!==null)roof.push(s);
 }
 if(!ground.length)return null;
 const base=quantile(ground,0.5);let top=roof.length?quantile(roof,0.3):base+fallbackHeight;
 const measured=top-base>=1.8&&top-base<=6;if(!measured)top=base+fallbackHeight;
 return {ground:base,eaves:top,measured};
}

/** Rank photographs for one wall by facing and low viewing elevation (more wall pixels), spreading the choice over flights. */
export function rankPhotosForWall(segment,levels,photos,{limit=8,perFlight=2}={}){
 const mid=[segment.a[0]+segment.ex*segment.length/2,segment.a[1]+segment.ey*segment.length/2,(levels.ground+levels.eaves)/2],ranked=[];
 for(const photo of photos){
  const [cx,cy,cz]=photo.camera.center,dx=cx-mid[0],dy=cy-mid[1],horizontal=Math.hypot(dx,dy),distance=Math.hypot(horizontal,cz-mid[2]);
  const facing=(dx*segment.nx+dy*segment.ny)/horizontal;if(!(facing>0.3))continue;
  const elevation=Math.atan2(cz-mid[2],horizontal);
  ranked.push({photo,score:facing*Math.cos(elevation)*(700/distance),facing,elevation,flight:photo.capturedAt.slice(0,10)});
 }
 ranked.sort((a,b)=>b.score-a.score);
 const perDay=new Map(),chosen=[];
 for(const item of ranked){const n=perDay.get(item.flight)??0;if(n>=perFlight)continue;perDay.set(item.flight,n+1);chosen.push(item);if(chosen.length>=limit)break;}
 return chosen;
}

/** Wall grid: x along the footprint edge, y downward from zTop. */
export function wallGrid(segment,levels,res,{above=0.25,below=0.1}={}){
 const zTop=levels.eaves+above,zBottom=levels.ground-below;
 return {segment,res,zTop,zBottom,width:Math.max(4,Math.ceil(segment.length/res)),height:Math.max(4,Math.ceil((zTop-zBottom)/res))};
}

/** (u,z) -> blocked? for one camera, using the other wall segments as occluders. Evaluated on a coarse grid. */
export function wallOcclusion(grid,camera,segments,tops,{res=0.1,d=0.3}={}){
 const {segment}=grid,w=Math.ceil(segment.length/res),h=Math.ceil((grid.zTop-grid.zBottom)/res),mask=new Uint8Array(w*h);
 const [cx,cy,cz]=camera.center;
 for(let i=0;i<w;i++){
  const u=(i+0.5)*res,px=segment.a[0]+segment.ex*u-segment.nx*d,py=segment.a[1]+segment.ey*u-segment.ny*d,rx=px-cx,ry=py-cy,horizontal=Math.hypot(rx,ry);
  for(const other of segments){
   if(other.id===segment.id)continue;
   const sx=other.b[0]-other.a[0],sy=other.b[1]-other.a[1],denominator=rx*sy-ry*sx;if(Math.abs(denominator)<1e-9)continue;
   const qx=other.a[0]-cx,qy=other.a[1]-cy,t=(qx*sy-qy*sx)/denominator,s=(qx*ry-qy*rx)/denominator;
   if(t<=0||t>=1||s<0||s>1||(1-t)*horizontal<0.1)continue;
   const top=tops.get(other.id);if(!top)continue;
   for(let j=0;j<h;j++){const z=grid.zTop-(j+0.5)*res,rayZ=cz+(z-cz)*t;if(rayZ<top.eaves&&rayZ>top.ground-0.3)mask[j*w+i]=1;}
  }
 }
 return (u,z)=>{const i=Math.floor(u/res),j=Math.floor((grid.zTop-z)/res);return i<0||j<0||i>=w||j>=h||mask[j*w+i]===1;};
}

/** Rectify `photo` onto the wall plane shifted inward by `d` metres. Returns RGB, luminance and validity. */
export function rectifyWall(grid,photo,d,{du=0,dz=0}={}){
 const {segment,res,zTop,width,height}=grid,{camera,window:win,blocked}=photo;
 const R=camera.rotation,[cx,cy,cz]=camera.center,[fx,fy]=camera.focal,[ppx,ppy]=camera.principal;
 const rgb=new Uint8ClampedArray(width*height*3),lum=new Float32Array(width*height),ok=new Uint8Array(width*height);
 const midE=segment.a[0]+segment.ex*segment.length/2-segment.nx*d,midN=segment.a[1]+segment.ey*segment.length/2-segment.ny*d;
 if(!(((cx-midE)*segment.nx+(cy-midN)*segment.ny)>0))return {rgb,lum,ok,count:0};
 const data=win.rgb,ww=win.width,wh=win.height;let count=0;
 for(let j=0;j<height;j++){
  const z=zTop-(j+0.5)*res+dz;
  for(let i=0;i<width;i++){
   const u=(i+0.5)*res+du;if(u<0||u>segment.length)continue;
   if(blocked&&blocked(u,z))continue;
   const X=segment.a[0]+segment.ex*u-segment.nx*d-cx,Y=segment.a[1]+segment.ey*u-segment.ny*d-cy,Z=z-cz;
   const zc=R[6]*X+R[7]*Y+R[8]*Z;if(zc>=-1)continue;
   const sx=ppx-fx*(R[0]*X+R[1]*Y+R[2]*Z)/zc-win.left-0.5,sy=ppy+fy*(R[3]*X+R[4]*Y+R[5]*Z)/zc-win.top-0.5;
   if(sx<0||sy<0||sx>ww-1||sy>wh-1)continue;
   const x0=Math.floor(sx),y0=Math.floor(sy),x1=Math.min(ww-1,x0+1),y1=Math.min(wh-1,y0+1),tx=sx-x0,ty=sy-y0;
   const a=(y0*ww+x0)*3,b=(y0*ww+x1)*3,c=(y1*ww+x0)*3,e=(y1*ww+x1)*3,o=j*width+i;
   for(let k=0;k<3;k++)rgb[o*3+k]=(data[a+k]*(1-tx)+data[b+k]*tx)*(1-ty)+(data[c+k]*(1-tx)+data[e+k]*tx)*ty;
   lum[o]=luma(rgb[o*3],rgb[o*3+1],rgb[o*3+2]);ok[o]=1;count++;
  }
 }
 return {rgb,lum,ok,count};
}

/** Coverage and mean brightness of a photograph's view of the wall (shaded or occluded views are poor evidence). */
export function wallPhotoStats(grid,photo,d){
 const r=rectifyWall(grid,photo,d);let sum=0;for(let i=0;i<r.lum.length;i++)if(r.ok[i])sum+=r.lum[i];
 return {valid:r.count/(grid.width*grid.height),mean:r.count?sum/r.count:0};
}

/** Local high-pass: luminance minus a masked box mean (normalized convolution). */
export function highPass(lum,ok,width,height,radius){
 const stride=width+1,sum=new Float64Array(stride*(height+1)),cnt=new Float64Array(stride*(height+1));
 for(let y=0;y<height;y++){let rs=0,rc=0;for(let x=0;x<width;x++){const o=y*width+x;if(ok[o]){rs+=lum[o];rc++;}const p=(y+1)*stride+x+1;sum[p]=sum[p-stride]+rs;cnt[p]=cnt[p-stride]+rc;}}
 const out=new Float32Array(width*height);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const o=y*width+x;if(!ok[o])continue;
  const x0=Math.max(0,x-radius),x1=Math.min(width,x+radius+1),y0=Math.max(0,y-radius),y1=Math.min(height,y+radius+1);
  const s=sum[y1*stride+x1]-sum[y0*stride+x1]-sum[y1*stride+x0]+sum[y0*stride+x0],c=cnt[y1*stride+x1]-cnt[y0*stride+x1]-cnt[y1*stride+x0]+cnt[y0*stride+x0];
  out[o]=c>0?lum[o]-s/c:0;
 }
 return out;
}
function zncc(a,b,okA,okB){
 let n=0,sa=0,sb=0,saa=0,sbb=0,sab=0;
 for(let i=0;i<a.length;i++){if(!okA[i]||!okB[i])continue;n++;sa+=a[i];sb+=b[i];saa+=a[i]*a[i];sbb+=b[i]*b[i];sab+=a[i]*b[i];}
 if(n<150)return null;
 const va=saa-sa*sa/n,vb=sbb-sb*sb/n;if(va<1e-6||vb<1e-6)return null;
 return {n,score:(sab-sa*sb/n)/Math.sqrt(va*vb)};
}

/** Plane sweep: choose how far inside the footprint the real wall lies by maximizing agreement between photographs. */
export function sweepWallPlane(segment,levels,photos,{min=-0.1,max=1,step=0.05,res=0.05,prior=0.3,priorWeight=0.03}={}){
 const grid=wallGrid(segment,levels,res),curve=[];
 for(let d=min;d<=max+1e-9;d+=step){
  const layers=photos.map(photo=>{const r=rectifyWall(grid,photo,d);return {...r,hp:highPass(r.lum,r.ok,grid.width,grid.height,6)};}).filter(l=>l.count>=200);
  let total=0,weight=0;
  for(let i=0;i<layers.length;i++)for(let j=i+1;j<layers.length;j++){const r=zncc(layers[i].hp,layers[j].hp,layers[i].ok,layers[j].ok);if(r){total+=r.score*r.n;weight+=r.n;}}
  curve.push({d:Math.round(d*1000)/1000,score:weight?total/weight:null,pairs:layers.length});
 }
 const valid=curve.filter(c=>c.score!==null);
 if(valid.length<3)return {d:prior,confidence:0,curve,sweep:false};
 const adjusted=valid.map(c=>({...c,value:c.score-priorWeight*((c.d-prior)/0.5)**2}));
 let best=adjusted.reduce((a,b)=>b.value>a.value?b:a);const idx=adjusted.indexOf(best);
 let d=best.d;
 if(idx>0&&idx<adjusted.length-1){const l=adjusted[idx-1].value,r=adjusted[idx+1].value,den=l-2*best.value+r;if(den<0)d+=clamp(0.5*(l-r)/den,-0.5,0.5)*step;}
 const mean=valid.reduce((s,c)=>s+c.score,0)/valid.length;
 return {d:clamp(d,min,max),confidence:best.score-mean,peak:best.score,curve,sweep:true};
}

/** Register every photograph to the others (small u/z shift) at the chosen plane. A shift is only applied with clear evidence. */
export function registerPhotos(grid,photos,d,{radius=5,minScore=0.2,minGain=0.04}={}){
 const layers=photos.map(photo=>{const r=rectifyWall(grid,photo,d);return {...r,hp:highPass(r.lum,r.ok,grid.width,grid.height,6)};});
 const shifts=layers.map(()=>({sx:0,sz:0,score:null}));
 for(let k=0;k<layers.length;k++){
  if(layers[k].count<200)continue;
  const ref=new Float32Array(grid.width*grid.height),refOk=new Uint8Array(grid.width*grid.height),cnt=new Uint8Array(grid.width*grid.height);
  for(let o=0;o<layers.length;o++){if(o===k)continue;const l=layers[o];for(let i=0;i<ref.length;i++)if(l.ok[i]){ref[i]+=l.hp[i];cnt[i]++;}}
  for(let i=0;i<ref.length;i++)if(cnt[i]>=1){ref[i]/=cnt[i];refOk[i]=1;}
  const scores=[];let best=null;
  for(let sz=-radius;sz<=radius;sz++)for(let sx=-radius;sx<=radius;sx++){
   const shifted=new Float32Array(ref.length),shiftedOk=new Uint8Array(ref.length);
   for(let y=0;y<grid.height;y++){const sy=y-sz;if(sy<0||sy>=grid.height)continue;for(let x=0;x<grid.width;x++){const xx=x-sx;if(xx<0||xx>=grid.width)continue;const from=sy*grid.width+xx,to=y*grid.width+x;if(layers[k].ok[from]){shifted[to]=layers[k].hp[from];shiftedOk[to]=1;}}}
   const r=zncc(shifted,ref,shiftedOk,refOk);if(!r)continue;
   const entry={sx,sz,score:r.score};scores.push(entry);if(!best||r.score>best.score)best=entry;
  }
  if(!best)continue;
  const zero=scores.find(s=>s.sx===0&&s.sz===0)?.score??-1;
  if(best.score<minScore||best.score-zero<minGain)continue;
  const at=(sx,sz)=>scores.find(s=>s.sx===sx&&s.sz===sz)?.score;
  const sub=(l,c,r)=>{if(l===undefined||r===undefined)return 0;const den=l-2*c+r;return den<0?clamp(0.5*(l-r)/den,-0.5,0.5):0;};
  shifts[k]={sx:best.sx+sub(at(best.sx-1,best.sz),best.score,at(best.sx+1,best.sz)),sz:best.sz+sub(at(best.sx,best.sz-1),best.score,at(best.sx,best.sz+1)),score:best.score};
 }
 return shifts.map(s=>({du:-s.sx*grid.res,dz:s.sz*grid.res,score:s.score}));
}

/** Per-pixel median of aligned photographs (exposure-normalized). Returns the fused RGB image and per-pixel support. */
export function fuseWall(grid,photos,d,shifts){
 const layers=photos.map((photo,k)=>rectifyWall(grid,photo,d,shifts?.[k]??{})).filter(l=>l.count>=100);
 // Shaded flights are brightened to the common level so they can vote with lit ones.
 const means=layers.map(l=>{let s=0;for(let i=0;i<l.lum.length;i++)if(l.ok[i])s+=l.lum[i];return s/l.count;}),target=quantile(means,0.5);
 layers.forEach((l,k)=>{const gain=clamp(target/Math.max(20,means[k]),0.6,2.4);for(let i=0;i<l.rgb.length;i++)l.rgb[i]=l.rgb[i]*gain;});
 const n=grid.width*grid.height,rgb=new Uint8ClampedArray(n*3),support=new Uint8Array(n),values=[[],[],[]];
 for(let i=0;i<n;i++){
  values[0].length=values[1].length=values[2].length=0;
  for(const l of layers)if(l.ok[i])for(let k=0;k<3;k++)values[k].push(l.rgb[i*3+k]);
  const m=values[0].length;support[i]=m;if(!m){rgb[i*3]=rgb[i*3+1]=rgb[i*3+2]=128;continue;}
  for(let k=0;k<3;k++){values[k].sort((a,b)=>a-b);rgb[i*3+k]=m%2?values[k][(m-1)/2]:(values[k][m/2-1]+values[k][m/2])/2;}
 }
 return {width:grid.width,height:grid.height,rgb,support,layers:layers.length};
}
