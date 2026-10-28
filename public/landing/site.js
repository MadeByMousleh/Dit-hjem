const toggle=document.querySelector('.menu-toggle');
const navigation=document.querySelector('#navigation');
function closeMenu(){toggle?.setAttribute('aria-expanded','false');toggle?.setAttribute('aria-label','Åbn menu');navigation?.classList.remove('is-open');}
toggle?.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Luk menu':'Åbn menu');navigation.classList.toggle('is-open',open);});
navigation?.addEventListener('click',event=>{if(event.target.closest('a'))closeMenu();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&toggle?.getAttribute('aria-expanded')==='true'){closeMenu();toggle.focus();}});
document.addEventListener('click',event=>{if(!event.target.closest('.header'))closeMenu();});

// Progressive enhancement: content stays visible without JS/observer support.
// IntersectionObserver replaces scroll listeners and per-frame JS work.
const root=document.documentElement;
const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
const motionButton=document.querySelector('.motion-toggle');
const heroArt=document.querySelector('.hero-art');
let motionPaused=false;
const revealTargets=[...document.querySelectorAll('.hero-copy>*,.topics>*,.section-copy>:not(ul),.feature-list li,.phone-stage,.home-copy>*,.home-features article,.section-heading>*,.steps article,.faq-grid>div:first-child>*,.faq-list details,.download-grid>div:first-child>*,.download-card,.footer-top>*')];
let revealObserver;
function reveal(element){element.classList.remove('reveal-pending');element.classList.add('is-revealed');revealObserver?.unobserve(element);}
if('IntersectionObserver' in window){
 revealObserver=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting)reveal(entry.target);},{threshold:.08,rootMargin:'0px 0px -28px 0px'});
 const siblingIndex=new WeakMap();
 for(const element of revealTargets){
  element.dataset.reveal='';
  const index=siblingIndex.get(element.parentElement)??0;siblingIndex.set(element.parentElement,index+1);
  element.style.setProperty('--reveal-delay',Math.min(index,3)*65+'ms');
  if(!reducedMotion.matches)element.classList.add('reveal-pending');
  revealObserver.observe(element);
 }
 const sceneObserver=new IntersectionObserver(entries=>{for(const entry of entries)entry.target.dataset.inView=String(entry.isIntersecting);},{threshold:0});
 if(heroArt)sceneObserver.observe(heroArt);
}else if(heroArt){heroArt.dataset.inView='true';}
function updateMotion(){
 root.dataset.motion=reducedMotion.matches||motionPaused?'paused':'running';
 root.dataset.pageVisible=String(!document.hidden);
 if(motionButton){
  motionButton.hidden=reducedMotion.matches;
  motionButton.setAttribute('aria-pressed',String(motionPaused));
  motionButton.querySelector('.motion-label').textContent=motionPaused?'Start bevægelse':'Pause bevægelse';
  motionButton.firstElementChild.textContent=motionPaused?'▷':'Ⅱ';
 }
 if(reducedMotion.matches||motionPaused)revealTargets.forEach(reveal);
}
motionButton?.addEventListener('click',()=>{motionPaused=!motionPaused;updateMotion();});
reducedMotion.addEventListener('change',updateMotion);
document.addEventListener('visibilitychange',updateMotion);
document.addEventListener('focusin',event=>{const target=event.target.closest('[data-reveal]');if(target)reveal(target);});
updateMotion();
