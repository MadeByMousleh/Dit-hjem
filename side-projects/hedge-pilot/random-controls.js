export function installRandomHouseControls({canNavigate}){
 const button=document.createElement('button'),status=document.createElement('p'),panel=document.createElement('section');button.id='random-house';button.textContent='Vælg tilfældigt EDC-hus';status.id='random-house-status';status.className='note';panel.className='random-house-panel';panel.append(button,status);document.getElementById('house-picker').closest('label').before(panel);
 const key='hedge-random-house-job';let state={status:'idle'},posting=false,polling=false;
 function pending(){return sessionStorage.getItem(key)===state.startedAt;}
 function open(){if(!canNavigate()){status.textContent='Nyt hus er klar. Gem eller ryd din åbne penselmarkering, og tryk Åbn det nye hus.';return false;}const target=new URL(state.url,location.href);if(target.origin!==location.origin)throw Error('Ugyldigt link til hus');sessionStorage.removeItem(key);location.assign(target.href);return true;}
 function render(){
  button.disabled=posting||state.status==='running';button.textContent=state.status==='done'&&pending()?'Åbn det nye hus':'Vælg tilfældigt EDC-hus';
  if(state.status==='running'){const seconds=Math.max(0,Math.floor((Date.now()-Date.parse(state.startedAt))/1000));status.textContent=`${state.label?state.label+' · ':''}${state.message} · ${seconds} sek.`;}
  else status.textContent=state.status==='idle'?'Vælger blandt de gemte EDC-huse, henter LiDAR og havefotos og viser modellens forslag automatisk.':`${state.label?state.label+' · ':''}${state.message??''}`;
  if(state.status==='done'&&pending()&&canNavigate())open();
  if(state.status==='failed')sessionStorage.removeItem(key);
 }
 async function poll(){if(polling)return;polling=true;try{const r=await fetch('/api/random-house');if(!r.ok)throw Error('Status kunne ikke hentes');state=await r.json();render();}catch(e){status.textContent=e.message;}finally{polling=false;}}
 button.onclick=async()=>{
  if(state.status==='done'&&pending()){open();return;}
  if(!canNavigate()){status.textContent='Gem eller ryd din åbne penselmarkering, før du vælger et nyt hus.';return;}
  posting=true;render();try{const r=await fetch('/api/random-house',{method:'POST',headers:{'Content-Type':'application/json','x-hedge-pilot':'1'},body:'{}'}),data=await r.json();if(!r.ok)throw Error(data.error);state=data;sessionStorage.setItem(key,state.startedAt);render();}catch(e){status.textContent=e.message;}finally{posting=false;button.disabled=state.status==='running';}
 };
 void poll();const timer=setInterval(()=>void poll(),1500);window.addEventListener('pagehide',()=>clearInterval(timer),{once:true});
}
