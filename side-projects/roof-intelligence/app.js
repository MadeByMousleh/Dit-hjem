const $=id=>document.getElementById(id),names={chimney:'Skorsten',unknown:'Usikker',not_object:'Ingen skorsten i rammen'};
const el=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;};let signature='';
const drafts=new Map();
const boxDrafts=new Map();let editing=false;
const markerColors=['#ff3b30','#00bfff','#ffd600','#00d970','#d966ff','#ff8c00'];
function photoReview(house,objects){
 const article=el('article'),frame=el('div'),image=el('img'),rows=el('div');
 frame.className='photo-frame';rows.className='review-rows';
 image.alt=`Hele ${objects[0].kind==='aerial'?'skråfotoet':'EDC-fotoet'} med nummererede tagfund`;
 image.loading='lazy';
 const source='/source?house='+encodeURIComponent(house.id)+'&view='+encodeURIComponent(objects[0].viewId);
 frame.append(image);
 const markers=[];let activeEdit=null,start=null;
 const help=el('p','Forkert ramme? Vælg Ret ramme, og træk en ny, tæt ramme omkring objektet. Vælg Forkert fund, hvis der slet ikke er et objekt.');
 function position(marker,box){Object.assign(marker.style,{left:`${box[0]*100}%`,top:`${box[1]*100}%`,width:`${(box[2]-box[0])*100}%`,height:`${(box[3]-box[1])*100}%`});marker.hidden=false;}
 function point(event){const r=frame.getBoundingClientRect();return [Math.max(0,Math.min(1,(event.clientX-r.left)/r.width)),Math.max(0,Math.min(1,(event.clientY-r.top)/r.height))];}
 frame.onpointerdown=event=>{if(!activeEdit)return;event.preventDefault();start=point(event);frame.setPointerCapture(event.pointerId);};
 frame.onpointermove=event=>{if(!start||!activeEdit)return;const end=point(event);position(activeEdit.marker,[Math.min(start[0],end[0]),Math.min(start[1],end[1]),Math.max(start[0],end[0]),Math.max(start[1],end[1])]);};
 frame.onpointerup=event=>{if(!start||!activeEdit)return;const end=point(event),box=[Math.min(start[0],end[0]),Math.min(start[1],end[1]),Math.max(start[0],end[0]),Math.max(start[1],end[1])];if((box[2]-box[0])*image.naturalWidth>=8&&(box[3]-box[1])*image.naturalHeight>=8){boxDrafts.set(activeEdit.object.id,box);activeEdit.info.textContent='Ramme rettet · vælg type og gem';}else{const old=boxDrafts.get(activeEdit.object.id)??activeEdit.object.review?.boxNormalized??activeEdit.object.box.map((v,i)=>v/(i%2?image.naturalHeight:image.naturalWidth));position(activeEdit.marker,old);}start=null;activeEdit=null;editing=false;frame.classList.remove('editing');};
 frame.onpointercancel=()=>{if(activeEdit){const o=activeEdit.object;position(activeEdit.marker,boxDrafts.get(o.id)??o.review?.boxNormalized??o.box.map((v,i)=>v/(i%2?image.naturalHeight:image.naturalWidth)));}start=null;activeEdit=null;editing=false;frame.classList.remove('editing');};
 objects.forEach((object,index)=>{
  const category=object.review?.category??object.category;
  const label=names[category]??'Usikker';
  const number=index+1,marker=el('button'),row=el('div'),color=markerColors[index%markerColors.length];
  marker.type='button';marker.className='marker';marker.hidden=true;marker.style.setProperty('--marker-color',color);
  marker.setAttribute('aria-label',`Markering ${number}: ${label}`);
  row.className='review-row';row.dataset.objectId=object.id;row.dataset.houseId=house.id;row.dataset.viewId=object.viewId;
  const heading=el('strong'),swatch=el('span'),info=el('small',`AI-forslag · ${(object.score*100).toFixed(0)} % detektorscore${object.review?' · Kontrolleret':''}`);
  swatch.className='color-swatch';swatch.style.backgroundColor=color;swatch.setAttribute('aria-hidden','true');heading.append(swatch,document.createTextNode(label));
  const select=el('select');select.setAttribute('aria-label',`Objekttype for markering ${number}`);
  for(const [value,label]of Object.entries(names)){const option=el('option',label);option.value=value;select.append(option);}
  const chosen=drafts.get(object.id)??category;
  select.value=Object.hasOwn(names,chosen)?chosen:'unknown';
  select.onchange=()=>drafts.set(object.id,select.value);
  const activate=()=>{for(const entry of markers){entry.marker.classList.toggle('selected',entry.marker===marker);entry.row.classList.toggle('selected',entry.row===row);}};
  marker.onclick=()=>{activate();select.focus({preventScroll:true});};
  row.addEventListener('focusin',activate);
  const save=el('button',object.review?'Gemt for denne markering':'Bekræft kun denne markering');save.type='button';
  const edit=el('button','Ret ramme');edit.type='button';edit.className='edit-box';edit.onclick=()=>{activate();activeEdit={marker,object,info};editing=true;frame.classList.add('editing');help.textContent=`Tegn ramme ${number}: træk fra det ene hjørne af objektet til det modsatte hjørne. Gem bagefter.`;frame.scrollIntoView({block:'center',behavior:'smooth'});};
  save.onclick=async()=>{save.disabled=true;try{const result=await post('/api/review',{houseId:house.id,viewId:object.viewId,id:object.id,category:select.value,boxNormalized:boxDrafts.get(object.id)??object.review?.boxNormalized});object.review=result.review;drafts.delete(object.id);boxDrafts.delete(object.id);info.textContent=`Gemt: ${names[select.value]} · kun denne markering på dette foto`;save.textContent='Gemt for denne markering';await refresh();}catch(e){$('error').textContent=e.message;}finally{save.disabled=false;}};
  row.append(heading,info,select,edit,save);rows.append(row);frame.append(marker);markers.push({marker,row,object});
 });
 image.onload=()=>{
  for(const {marker,object}of markers){
   const corrected=boxDrafts.get(object.id)??object.review?.boxNormalized;if(corrected){position(marker,corrected);continue;}
   const box=object.box;if(!Array.isArray(box)||box.length!==4||!box.every(Number.isFinite))continue;
   const [left,top,right,bottom]=box.map((value,index)=>Math.max(0,Math.min(index%2?image.naturalHeight:image.naturalWidth,value)));
   if(right<=left||bottom<=top)continue;
   Object.assign(marker.style,{left:`${left/image.naturalWidth*100}%`,top:`${top/image.naturalHeight*100}%`,width:`${(right-left)/image.naturalWidth*100}%`,height:`${(bottom-top)/image.naturalHeight*100}%`});marker.hidden=false;
  }
 };
 image.onerror=()=>{article.append(el('p','Kildefotoet kunne ikke indlæses. Genindlæs siden for at prøve igen.'));};
 image.src=source;
 article.append(el('h3',`${objects[0].kind==='aerial'?'Skråfoto':'EDC'} · ${objects[0].viewId}`),help,frame,rows);
 return article;
}
async function post(path,body){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','x-roof-pilot':'1'},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Error(data.error);return data;}
async function refresh(){try{
 const r=await fetch('/api/status');if(!r.ok)throw Error('Piloten kunne ikke hentes');const data=await r.json();
 $('status').textContent=`${data.progress?.status??'Afventer'} · ${data.progress?.completed??0}/${data.progress?.total??0} billeder · ${data.eligibleObjects} brugbare skråfoto-eksempler fra ${data.eligibleHouses} huse · ${data.humanReviews} kontrollerede udsnit`;
 $('training').textContent='Vi samler godkendte skorstensmarkeringer. Der er endnu ingen trænet skorstensdetektor.';$('train').hidden=true;
 const key=JSON.stringify(data.houses.map(({profile,...house})=>({...house,objects:house.objects.map(({review,...object})=>object)})));if(key===signature||editing)return;signature=key;$('houses').replaceChildren();
 for(const house of data.houses){const section=el('section');section.append(el('h2',house.address??house.id),el('p',house.split==='test'?'Reserveret til test':'Træningsgruppe'));const cards=el('div');cards.className='cards';
  const views=new Map();for(const object of house.objects){if(!views.has(object.viewId))views.set(object.viewId,[]);views.get(object.viewId).push(object);}for(const objects of views.values())cards.append(photoReview(house,objects));
  section.append(cards);if(house.viewErrors?.length)section.append(el('p',`${house.viewErrors.length} billeder kunne ikke analyseres.`));$('houses').append(section);
 }
}catch(e){$('error').textContent=e.message;}}
$('train').onclick=async()=>{try{await post('/api/train',{});await refresh();}catch(e){$('error').textContent=e.message;}};void refresh();setInterval(()=>void refresh(),5000);
