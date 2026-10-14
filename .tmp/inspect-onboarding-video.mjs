import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { chromium } from 'file:///C:/Users/mbm/AppData/Local/npm-cache/_npx/420ff84f11983ee5/node_modules/playwright/index.mjs';
const video = await readFile('C:/Users/mbm/OneDrive - Danitech A S/Dokumenter/large-thumbnail20250307-152298-1eehprp.mp4');
const server = createServer((req,res) => {
  if (req.url === '/video.mp4') { res.setHeader('Content-Type','video/mp4'); res.end(video); }
  else { res.setHeader('Content-Type','text/html'); res.end('<video src="/video.mp4" muted preload="auto"></video><canvas></canvas>'); }
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser = await chromium.launch({channel:'chrome',headless:true});
try {
  const page=await browser.newPage({viewport:{width:1200,height:1000}});
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const info=await page.evaluate(async()=>{
    const v=document.querySelector('video');
    await new Promise(r=>v.readyState>=2?r():v.addEventListener('loadeddata',r,{once:true}));
    const c=document.querySelector('canvas'),ctx=c.getContext('2d');
    const w=380,h=Math.round(w*v.videoHeight/v.videoWidth);
    c.width=w*3;c.height=(h+24)*3;
    const times=Array.from({length:9},(_,i)=>i*(v.duration-0.05)/8);
    for(let i=0;i<times.length;i++){
      if(times[i]>0){await new Promise(r=>{v.addEventListener('seeked',r,{once:true});v.currentTime=times[i];});}
      const x=(i%3)*w,y=Math.floor(i/3)*(h+24);
      ctx.fillStyle='#fff';ctx.fillRect(x,y,w,h+24);ctx.drawImage(v,x,y+24,w,h);
      ctx.fillStyle='#000';ctx.font='16px sans-serif';ctx.fillText(times[i].toFixed(2)+'s',x+8,y+18);
    }
    v.style.display='none';document.body.style.margin='0';
    return {duration:v.duration,width:v.videoWidth,height:v.videoHeight};
  });
  console.log(info);
  await page.locator('canvas').screenshot({path:'.tmp/onboarding-review/reference-video-frames.png'});
} finally {await browser.close();server.close();}
