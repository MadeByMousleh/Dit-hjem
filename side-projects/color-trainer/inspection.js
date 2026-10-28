import {photoKey,maskFromRuns} from './sampling.mjs';
import {editPolygon} from './polygon-editor.js';

export function renderEvidence(task,{onSelection,onEditing,candidate}={}){
  const container=document.getElementById('photos');container.replaceChildren();
  const accepted=candidate?candidate.views.filter(v=>v.feature).map(v=>({...v,contextCrop:[0,0,v.width,v.height],contextSize:[v.width,v.height],sampleRuns:v.usableRuns})):task.faces.flatMap(f=>f.patches),rejected=candidate?[]:task.rejectedViews??[];
  for(const photo of task.photos.filter(p=>p.direction!=='nadir')){
    const figure=document.createElement('figure'),image=document.createElement('img'),caption=document.createElement('figcaption');
    const wrapper=document.createElement('div');wrapper.className='photo-evidence';
    image.alt=`Skråfoto ${photo.direction}`;
    const matches=p=>p.photoKey?p.photoKey===photoKey(photo):p.viewId?.startsWith(`${photo.direction}-`)&&task.photos.filter(x=>x.direction===photo.direction).length===1;
    const views=[...accepted.filter(matches).map(p=>({p,rejected:false})),...rejected.filter(matches).map(p=>({p,rejected:true}))];
    const canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');
    image.onload=()=>{
      canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
      const ctx=canvas.getContext('2d');
      for(const {p,rejected} of views){
        if(!p.contextCrop)continue;
        const [left,top,right,bottom]=p.contextCrop;
        if(p.contextSize&&(p.contextSize[0]!==canvas.width||p.contextSize[1]!==canvas.height))continue;
        if(!p.maskRuns){ctx.strokeStyle='#d97706';ctx.lineWidth=2;ctx.setLineDash([5,4]);ctx.strokeRect(left,top,right-left,bottom-top);ctx.setLineDash([]);continue;}
        const paint=(runs,alpha)=>{
          // Validate before drawing; malformed coordinates never become overlays.
          maskFromRuns(runs,p.width,p.height);
          ctx.fillStyle=rejected?`rgba(234,115,20,${alpha})`:candidate?`rgba(35,135,255,${alpha})`:`rgba(0,190,115,${alpha})`;
          for(const [start,length] of runs){let at=start,remaining=length;
            while(remaining){const count=Math.min(remaining,p.width-at%p.width);ctx.fillRect(left+at%p.width,top+Math.floor(at/p.width),count,1);at+=count;remaining-=count;}
          }
        };
        paint(p.maskRuns,.28);if(!rejected&&p.sampleRuns)paint(p.sampleRuns,.9);
      }
    };
    image.src=photo.image;wrapper.append(image,canvas);figure.append(wrapper);
    caption.textContent=`${photo.direction} · ${photo.capturedAt.slice(0,10)} · © Klimadatastyrelsen · ${views.filter(v=>!v.rejected).length} brugbare udsnit`;
    figure.append(caption);
    if(onSelection){
      const button=document.createElement('button');button.type='button';button.className='sampling-action';
      const existing=task.manualSelections?.find(s=>s.photoKey===photoKey(photo));
      button.textContent=existing?'Ret tegnet område':'Ret facadeområde';
      button.onclick=()=>editPolygon(photo,existing,points=>onSelection(photoKey(photo),points),onEditing);
      figure.append(button);
    }
    for(const {p} of views.filter(v=>v.rejected)){
      const note=document.createElement('p');note.className='evidence-warning';note.textContent=`Udeladt: ${p.rejectionReason||p.quality?.reason||'Utilstrækkeligt facadeudsnit'}`;figure.append(note);
    }
    container.append(figure);
  }
}
