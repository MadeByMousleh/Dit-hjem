// Full-window original-image workspace shared by both annotation tools.
export function imageWorkspace(photo,{onPoint,overlay}={}){
  const root=document.createElement('div');root.className='image-workspace';
  const toolbar=document.createElement('div');toolbar.className='image-tools';
  const canvas=document.createElement('canvas');canvas.tabIndex=0;canvas.setAttribute('aria-label','Originalfoto. Klik for at markere. Brug zoom eller flyt billedet for detaljer.');
  const image=new Image();let zoom=1,pan=[0,0],mode='draw',size=[1,1],loaded=false,gesture=null,space=false;
  const pointers=new Map();
  const button=text=>{const b=document.createElement('button');b.type='button';b.textContent=text;toolbar.append(b);return b;};
  const drawButton=button('Tegn'),panButton=button('Flyt'),minus=button('−'),plus=button('+'),fit=button('Tilpas billede'),fullscreen=button('Fuld skærm');
  const level=document.createElement('output');level.setAttribute('aria-label','Zoom');toolbar.append(level);
  const scale=()=>Math.min(size[0]/(image.naturalWidth||1),size[1]/(image.naturalHeight||1))*.96*zoom;
  const offset=()=>{const s=scale();return [(size[0]-image.naturalWidth*s)/2+pan[0],(size[1]-image.naturalHeight*s)/2+pan[1]];};
  const pointAt=(x,y)=>{const s=scale(),o=offset();return [(x-o[0])/(image.naturalWidth*s),(y-o[1])/(image.naturalHeight*s)];};
  const redraw=()=>{
    const dpr=Math.min(devicePixelRatio||1,2),ctx=canvas.getContext('2d');
    if(canvas.width!==Math.round(size[0]*dpr)||canvas.height!==Math.round(size[1]*dpr)){canvas.width=Math.round(size[0]*dpr);canvas.height=Math.round(size[1]*dpr);}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,...size);
    if(loaded){const s=scale(),o=offset();canvas.dataset.imageRect=JSON.stringify({x:o[0],y:o[1],width:image.naturalWidth*s,height:image.naturalHeight*s});canvas.dataset.naturalWidth=String(image.naturalWidth);ctx.save();ctx.translate(...o);ctx.scale(s,s);ctx.drawImage(image,0,0);overlay?.(ctx,{width:image.naturalWidth,height:image.naturalHeight,scale:s});ctx.restore();}
    drawButton.setAttribute('aria-pressed',String(mode==='draw'));panButton.setAttribute('aria-pressed',String(mode==='pan'));
    canvas.style.cursor=mode==='pan'?'grab':'crosshair';level.textContent=Math.round(zoom*100)+'%';
  };
  const zoomAt=(factor,x=size[0]/2,y=size[1]/2)=>{
    if(!loaded)return;const p=pointAt(x,y);zoom=Math.max(1,Math.min(12,zoom*factor));const s=scale();
    pan=[x-p[0]*image.naturalWidth*s-(size[0]-image.naturalWidth*s)/2,y-p[1]*image.naturalHeight*s-(size[1]-image.naturalHeight*s)/2];redraw();
  };
  drawButton.onclick=()=>{mode='draw';redraw();};panButton.onclick=()=>{mode='pan';redraw();};
  plus.onclick=()=>zoomAt(1.4);minus.onclick=()=>zoomAt(1/1.4);fit.onclick=()=>{zoom=1;pan=[0,0];redraw();};
  fullscreen.onclick=()=>{if(document.fullscreenElement)void document.exitFullscreen?.();else void document.documentElement.requestFullscreen?.().catch(()=>{});};
  const location=e=>{const r=canvas.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top];};
  canvas.onwheel=e=>{e.preventDefault();zoomAt(Math.exp(-e.deltaY*.002),...location(e));};
  canvas.onpointerdown=e=>{
    if(!loaded)return;e.preventDefault();canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);
    const p=location(e);pointers.set(e.pointerId,{p,start:p,pan:[...pan],moved:false,draw:mode==='draw'&&!space&&e.button===0});
    if(pointers.size===2){for(const v of pointers.values())v.draw=false;const a=[...pointers.values()].map(v=>v.p);gesture={distance:Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]),centre:[(a[0][0]+a[1][0])/2,(a[0][1]+a[1][1])/2]};}
  };
  canvas.onpointermove=e=>{
    const state=pointers.get(e.pointerId);if(!state)return;const p=location(e);state.p=p;
    if(Math.hypot(p[0]-state.start[0],p[1]-state.start[1])>4)state.moved=true;
    if(pointers.size>=2&&gesture){const a=[...pointers.values()].slice(0,2).map(v=>v.p),distance=Math.hypot(a[0][0]-a[1][0],a[0][1]-a[1][1]),centre=[(a[0][0]+a[1][0])/2,(a[0][1]+a[1][1])/2];zoomAt(distance/Math.max(1,gesture.distance),...gesture.centre);pan[0]+=centre[0]-gesture.centre[0];pan[1]+=centre[1]-gesture.centre[1];gesture={distance,centre};redraw();}
    else if(!state.draw){pan=[state.pan[0]+p[0]-state.start[0],state.pan[1]+p[1]-state.start[1]];redraw();}
  };
  const release=(e,cancel=false)=>{
    const state=pointers.get(e.pointerId);if(!state)return;
    if(!cancel&&state.draw&&!state.moved&&pointers.size===1){const p=pointAt(...location(e));if(p.every(v=>v>=0&&v<=1))onPoint?.(p);}
    pointers.delete(e.pointerId);if(pointers.size===1&&gesture){const remaining=[...pointers.values()][0];remaining.start=remaining.p;remaining.pan=[...pan];remaining.draw=false;remaining.moved=true;gesture=null;}if(!pointers.size)gesture=null;
  };
  canvas.onpointerup=e=>release(e);canvas.onpointercancel=e=>release(e,true);
  canvas.onkeydown=e=>{if(e.code==='Space'){space=true;e.preventDefault();}if(e.key==='+'||e.key==='='){zoomAt(1.4);e.preventDefault();}if(e.key==='-'){zoomAt(1/1.4);e.preventDefault();}};
  canvas.onkeyup=e=>{if(e.code==='Space')space=false;};canvas.onblur=()=>{space=false;};
  root.append(canvas);const observer=new ResizeObserver(entries=>{const r=entries[0].contentRect;size=[Math.max(1,r.width),Math.max(1,r.height)];redraw();});observer.observe(root);
  image.onload=()=>{loaded=true;redraw();};image.src=photo.image;
  return {root,toolbar,canvas,redraw,get dimensions(){return [image.naturalWidth,image.naturalHeight];},get loaded(){return loaded;},destroy:()=>{observer.disconnect();pointers.clear();image.onload=null;},
    // Exposed geometry is also used by browser checks of normalized coordinates.
    imagePoint:p=>{const o=offset(),s=scale();return [o[0]+p[0]*image.naturalWidth*s,o[1]+p[1]*image.naturalHeight*s];}};
}

export function drawOutline(ctx,points,{width,height,scale},color='#00e69b',selected=true){
  if(!points.length)return;ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x*width,y*height):ctx.moveTo(x*width,y*height));
  if(points.length>=3){ctx.closePath();ctx.fillStyle=color+'35';ctx.fill();}ctx.strokeStyle=color;ctx.lineWidth=(selected?2.5:1.5)/scale;ctx.stroke();
  if(selected)for(const [x,y] of points){ctx.beginPath();ctx.arc(x*width,y*height,4/scale,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();ctx.stroke();}
}
