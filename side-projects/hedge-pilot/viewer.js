import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {boxSegments} from './shape.mjs';
import {projectPhoto} from '../../src/services/home-photo-projection.mjs';
import {installBrush} from './brush.js';
import {installRandomHouseControls} from './random-controls.js';
const $=id=>document.getElementById(id),el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
const colors=['#e9413b','#008bd1','#bb5cdb','#db9500','#00a477','#e5559d'];
async function main(){
 const catalogResponse=await fetch('/api/houses');if(!catalogResponse.ok)throw Error('Huslisten kunne ikke indlæses');const catalog=await catalogResponse.json();
 const chosen=new URL(location.href).searchParams.get('house')??catalog.houses.find(h=>h.ready)?.id;
 const picker=el('select');picker.id='house-picker';picker.setAttribute('aria-label','Vælg hus');
 for(const h of catalog.houses){const option=el('option',h.label+(h.ready?'':' · afventer LiDAR og havefotos'));option.value=h.id;option.disabled=!h.ready;picker.append(option);}picker.value=chosen;
 picker.onchange=()=>{const target=new URL(location.href);target.searchParams.set('house',picker.value);location.href=target.href;};
 const pickerLabel=el('label','Vælg hus: ');pickerLabel.append(picker);$('scene').before(pickerLabel);
 const response=await fetch('/api/data?house='+encodeURIComponent(chosen));const data=await response.json();if(!response.ok)throw Error(data.error??'Data kunne ikke indlæses');
 const points=data.points,origin=points[0],scene=new THREE.Scene();scene.background=new THREE.Color('#e4e7e1');
 const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));$('scene').append(renderer.domElement);
 const camera=new THREE.PerspectiveCamera(45,1,.1,1000),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minDistance=3;controls.maxDistance=160;controls.maxPolarAngle=Math.PI*.49;
 const local=p=>new THREE.Vector3(p[0]-origin[0],p[2]-origin[2],-(p[1]-origin[1]));
 const bounds=new THREE.Box3(),positions=[],pointColors=[];
 for(const p of points){if(![2,3,4,5,6].includes(p[3]))continue;const v=local(p);bounds.expandByPoint(v);positions.push(v.x,v.y,v.z);const c=new THREE.Color(p[3]===2?'#a58a69':p[3]===6?'#7c8286':'#3f7952');pointColors.push(c.r,c.g,c.b);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(pointColors,3));scene.add(new THREE.Points(geometry,new THREE.PointsMaterial({size:.14,vertexColors:true})));
 const center=bounds.getCenter(new THREE.Vector3()),span=bounds.getSize(new THREE.Vector3()).length();controls.target.copy(center);
 function orbit(){camera.position.copy(center).add(new THREE.Vector3(span*.6,span*.75,span*.65));camera.up.set(0,1,0);controls.update();}
 $('orbit').onclick=orbit;$('top').onclick=()=>{camera.position.copy(center).add(new THREE.Vector3(0,span,0.01));controls.update();};orbit();
 const groups=new Map(),cards=new Map(),paths=new Map();let selected=null,visible=true;
 function draw(c){
  const segments=boxSegments(c),line=groups.get(c.id);
  const previous=line.geometry;line.geometry=new THREE.BufferGeometry().setFromPoints(segments.flat().map(local));previous.dispose();
  for(const path of paths.get(c.id)??[]){const view=path.hedgeView,[l,t,r,b]=view.camera.crop;let d='';for(const segment of segments){const projected=segment.map(point=>projectPhoto(view.camera,point));if(projected.some(p=>!p))continue;const pixels=projected.map(p=>[(p[0]-l)/(r-l)*view.width,(p[1]-t)/(b-t)*view.height]);d+=`M ${pixels[0].join(' ')} L ${pixels[1].join(' ')} `;}path.setAttribute('d',d);}
 }
 function select(id){selected=id;for(const [key,group]of groups){group.material.opacity=key===id?1:.45;cards.get(key).classList.toggle('active',key===id);}for(const [key,list]of paths)for(const path of list){path.style.opacity=key===id?'1':'.25';path.style.strokeWidth=key===id?'1.5':'1';}}
 for(const [i,c]of data.analysis.candidates.entries()){
  const color=colors[i%colors.length];
  const line=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color,transparent:true,opacity:.7}));scene.add(line);groups.set(c.id,line);draw(c);
  const card=el('article');card.className='candidate';card.style.setProperty('--color',color);const focus=el('button','Vis dette forløb');focus.onclick=()=>select(c.id);
  const heading=el('strong'),swatch=el('span');swatch.className='swatch';heading.append(swatch,document.createTextNode('Forslag · kun vejledning'));
  card.append(heading,focus);$('candidates').append(card);cards.set(c.id,card);
 }
 $('toggle').onclick=()=>{visible=!visible;for(const group of groups.values())group.visible=visible;for(const list of paths.values())for(const path of list)path.style.display=visible?'':'none';$('toggle').textContent=visible?'Skjul forslag':'Vis forslag';};
 for(const view of data.views){const card=el('article'),frame=el('div'),image=el('img');frame.className='photo';image.src='/photo?house='+encodeURIComponent(data.addressId)+'&id='+view.id;image.alt=view.contextLabel??('Foto fra '+view.direction);image.loading='lazy';frame.append(image);const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox',`0 0 ${view.width} ${view.height}`);svg.setAttribute('preserveAspectRatio','none');for(const entry of view.paths){const index=data.analysis.candidates.findIndex(c=>c.id===entry.id),path=document.createElementNS(svg.namespaceURI,'path');path.hedgeView=view;path.setAttribute('fill','none');path.setAttribute('stroke',colors[index%colors.length]);path.setAttribute('stroke-width','1');path.setAttribute('vector-effect','non-scaling-stroke');svg.append(path);const list=paths.get(entry.id)??[];list.push(path);paths.set(entry.id,list);}frame.append(svg);card.append(el('h3',view.contextLabel??view.direction),el('p',String(view.capturedAt??'Optagelsesdato ukendt')),frame);$('photos').append(card);}
 $('status').textContent=`${data.analysis.vegetationPoints.toLocaleString('da-DK')} målte vegetationspunkter · ${groups.size} mulige hækforløb · ${data.views.length} skråfotos. Forslag og vurderinger ændrer ikke appens model. Fotos: © KDS / Dataforsyningen · CC BY 4.0.`;
 if(!groups.size)$('candidates').append(el('p','Ingen tydelige sammenhængende forløb fundet med de konservative grænser. Vegetationen vises stadig i 3D.'));
 const observer=new ResizeObserver(()=>{const r=$('scene').getBoundingClientRect();renderer.setSize(r.width,r.height);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();});observer.observe($('scene'));
 renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});
 for(const candidate of data.analysis.candidates)draw(candidate);
 if(groups.size)select(groups.keys().next().value);
 const proposalPoints=new THREE.Points(new THREE.BufferGeometry(),new THREE.PointsMaterial({color:'#ff8c00',size:.2,depthTest:true}));scene.add(proposalPoints);
 const proposalStatus=el('p');proposalStatus.id='proposal-status';proposalStatus.className='note';document.getElementById('scene').after(proposalStatus);
 const connectedNote=el('p','Orange forslag følger sammenhængende vegetation og kan også ramme buske. Kun dine gemte penselpunkter er hæk; Afslut haven gemmer resten som ikke-hæk.');connectedNote.className='note';proposalStatus.after(connectedNote);
 const proposalToggle=el('button','Skjul lærte punktforslag');proposalToggle.id='toggle-learned';proposalStatus.after(proposalToggle);proposalToggle.onclick=()=>{proposalPoints.visible=!proposalPoints.visible;proposalToggle.textContent=proposalPoints.visible?'Skjul lærte punktforslag':'Vis lærte punktforslag';};
 function showSuggestions(value){const indices=value?.indices??[],old=proposalPoints.geometry;proposalPoints.geometry=new THREE.BufferGeometry().setFromPoints(indices.map(i=>local(points[i])));old.dispose();renderer.domElement.dataset.suggestedPointCount=String(indices.length);const unseen=value?.seenInTraining===false?'Nyt hus · har ikke været med i træningen. ':'';proposalStatus.textContent=unseen+`${indices.length.toLocaleString('da-DK')} ikke-godkendte AI-forslag (orange). Først din godkendelse gør punkterne til hæk. Godkendte punkter er lysegrønne; din åbne penselmarkering er gul.`;}
 async function refreshSuggestions(){const response=await fetch('/api/data?house='+encodeURIComponent(data.addressId));if(!response.ok)throw Error('Punktforslag kunne ikke hentes');showSuggestions((await response.json()).learnedSuggestions);}
 showSuggestions(data.learnedSuggestions);
 const brush=installBrush({scene,camera,controls,renderer,points,local,data,onSaved:refreshSuggestions});
 installRandomHouseControls({canNavigate:()=>!brush.hasUnsavedChanges()&&!brush.isBusy()});
 const training=await fetch('/api/training').then(r=>r.json());
 const trainingNote=el('p');trainingNote.id='training-status';trainingNote.className='note';
 const describeTraining=result=>result.status==='trained-classifier'?`Model trænet på ${result.trainingPoints} hækpunkter og ${result.negativePoints} ikke-hækpunkter fra ${result.trainingHouses} haver. Orange punkter er forslag, ikke godkendelser. Ingen uafhængig nøjagtighedstest endnu.`:result.status==='trained-similarity'?`Lighedsmodel lært fra ${result.trainingPoints} gemte hækpunkter i ${result.trainingHouses} haver. Ingen uafhængig nøjagtighedstest endnu. Orange forslag er kun vejledning.`:'Kun gemte penselprikker bruges. Der er endnu ikke nok brugbare hækpunkter til en forsøgsmodel.';
 trainingNote.textContent=describeTraining(training);document.getElementById('status').after(trainingNote);
 const fusionNote=el('p','Træningen kombinerer LiDAR med farve og struktur fra kalibrerede skråfotos. Et dybdetjek fravælger billeder ved målte forhindringer; skjulte områder kan stadig mangle. Kun dine gemte penselmarkeringer er facit.');fusionNote.className='note';trainingNote.after(fusionNote);
 const trainButton=el('button','Start træning');trainButton.id='train-pilot';
 const progress=el('progress');progress.id='training-progress';progress.max=100;progress.value=0;progress.hidden=true;progress.style.width='100%';progress.setAttribute('aria-label','Træningens fremdrift');
 const progressNote=el('p');progressNote.id='training-progress-status';progressNote.setAttribute('role','status');trainingNote.after(trainButton,progress,progressNote);
 trainButton.onclick=async()=>{
  if(brush.hasUnsavedChanges()||brush.isBusy()){progressNote.textContent='Gem eller ryd din åbne penselmarkering først. Træningen bruger dine gemte punkter.';return;}
  trainButton.disabled=true;progress.hidden=false;progress.value=0;progressNote.textContent='Starter træning …';let polling=false;
  const poll=async()=>{if(polling)return;polling=true;try{const r=await fetch('/api/train-progress');if(r.ok){const value=await r.json();if(value.status==='running'){progress.value=value.percent;progressNote.textContent=`${value.percent}% · ${value.message}`;}}}finally{polling=false;}};
  const timer=setInterval(()=>void poll().catch(()=>{}),400);
  try{const response=await fetch('/api/train',{method:'POST',headers:{'Content-Type':'application/json','x-hedge-pilot':'1'},body:'{}'}),result=await response.json();if(!response.ok)throw Error(result.error);clearInterval(timer);trainingNote.textContent=describeTraining(result);await refreshSuggestions();progress.value=100;progressNote.textContent='100% · Træning færdig. Huset viser nu de nye orange hækforslag. Kun din godkendelse gør dem til hæk.';}
  catch(e){progressNote.textContent='Træningen eller opdateringen mislykkedes: '+e.message;}
  finally{clearInterval(timer);trainButton.disabled=false;}
 };
}
main().catch(e=>{$('error').textContent=e.message;});
