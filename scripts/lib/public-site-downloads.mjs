const symbols={
 appStore:'<svg viewBox="0 0 24 28" aria-hidden="true"><path d="M18.4 14.8c0-2.4 1.9-3.6 2-3.7-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.2-2.8.9-3.5.9-.7 0-1.8-.9-3-.9-1.6 0-3.2.9-4 2.3-1.7 2.9-.5 7.1 1.1 9.5.8 1.1 1.7 2.3 2.9 2.3s1.6-.7 3.1-.7c1.4 0 1.8.7 3.1.7s2.1-1.1 2.9-2.2c.9-1.3 1.3-2.6 1.3-2.7-.1 0-2.6-1-2.6-3.7ZM16.1 7.8c.6-.8 1.1-1.8 1-2.9-1 .1-2.2.7-2.9 1.5-.6.7-1.1 1.8-1 2.8 1.1.1 2.2-.5 2.9-1.4Z" fill="currentColor"/></svg>',
 googlePlay:'<svg viewBox="0 0 24 28" aria-hidden="true"><path d="M2 1v26l14-13L2 1Z" fill="#7DC3BB"/><path d="m2 1 16 9-2 4L2 1Z" fill="#A4CDE8"/><path d="m2 27 16-9-2-4L2 27Z" fill="#E8A9A4"/><path d="m16 14 2-4 5 4-5 4-2-4Z" fill="#EFD994"/></svg>',
};
const escape=value=>value.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
export function renderStoreButtons(config){
 return [['appStore','App Store','apps.apple.com'],['googlePlay','Google Play','play.google.com']].map(([key,title,host])=>{
  const value=config[key];let href;
  if(value){const url=new URL(value);if(url.protocol!=='https:'||url.hostname!==host||url.username||url.password||url.hash)throw Error('Invalid '+title+' app URL');
   if(key==='appStore'&&!/\/id\d+\/?$/.test(url.pathname))throw Error('Use a specific App Store app page');
   if(key==='googlePlay'&&(url.pathname!=='/store/apps/details'||!url.searchParams.get('id')))throw Error('Use a specific Google Play app page');
   href=escape(url.href);
  }
  const contents=symbols[key]+'<span><small>'+(href?'Hent i':'Kommer snart på')+'</small><strong>'+title+'</strong></span>';
  return href?'<a class="store-badge" href="'+href+'" aria-label="Hent Huslyg i '+title+'">'+contents+'</a>':'<span class="store-badge is-pending" aria-label="'+title+' — kommer snart">'+contents+'</span>';
 }).join('');
}
