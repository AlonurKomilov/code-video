import {chromium} from 'playwright';
import {existsSync,readdirSync} from 'fs';
/* CI installs its own browser; this box has one at a fixed path. Look, do not assume. */
function findChrome(){
 const root='/opt/pw-browsers';
 if(!existsSync(root)) return null;
 const dirs=readdirSync(root).filter(d=>d.startsWith('chromium')&&!d.includes('headless'))
   .sort().reverse();
 for(const d of dirs){
  const p=`${root}/${d}/chrome-linux/chrome`;
  if(existsSync(p)) return p;
 }
 return null;
}
export const PAGE='file://'+new URL('../build/oq-kocha.html',import.meta.url).pathname;
let browser=null, page=null;
export async function open(){
 if(page) return page;
 /* SwiftShader, so the audit runs on a build machine with no GPU at all. It is slow
    and that is fine: nothing here is measured in absolute milliseconds except the
    cost check, which is a ratio against itself. */
 const args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required'];
 const exe=process.env.QALAM_CHROME || findChrome();
 browser=await chromium.launch(exe?{args,executablePath:exe}:{args});
 page=await browser.newPage({viewport:{width:820,height:1000}});
 const errs=[];
 page.on('pageerror',e=>errs.push(String(e.message)));
 page.on('console',m=>{if(m.type()==='error'&&!/net::/.test(m.text()))errs.push(m.text());});
 page.__errs=errs;
 await page.goto(PAGE); await page.waitForTimeout(600);
 if(errs.length) throw new Error('page errors: '+errs.join(' | '));
 return page;
}
export async function close(){ if(browser) await browser.close(); browser=page=null; }
process.on("exit",()=>{ try{ browser&&browser.close(); }catch(e){} });
/* pixels of one frame, rendered deterministically */
export async function pixels(frame,w,h,opt={},mode=0){   // 0 picture 1 material 2 line 3 work
 const pg=await open();
 return Uint8Array.from(await pg.evaluate(([frame,w,h,opt,mode])=>{
  window.__resetOpt(); window.__opt(opt);
  (mode===1?window.__matFrame:mode===2?window.__lineFrame:mode===3?window.__primFrame:window.__frameTo)(frame,w,h);
  const c=document.querySelector('canvas'), g=c.getContext('webgl2');
  const px=new Uint8Array(c.width*c.height*4);
  g.readPixels(0,0,c.width,c.height,g.RGBA,g.UNSIGNED_BYTE,px);
  window.__resetOpt();
  return Array.from(px);
 },[frame,w,h,opt,mode]));
}
export async function timed(frame,w,h,opt={}){
 const pg=await open();
 return await pg.evaluate(([frame,w,h,opt])=>{
  window.__resetOpt(); window.__opt(opt);
  const t0=performance.now(); window.__frameTo(frame,w,h);
  const c=document.querySelector('canvas'), g=c.getContext('webgl2');
  const px=new Uint8Array(4); g.readPixels(0,0,1,1,g.RGBA,g.UNSIGNED_BYTE,px);  // force the pipe
  const ms=performance.now()-t0; window.__resetOpt(); return ms;
 },[frame,w,h,opt]);
}
export const CHARACTER = m => (m>=1&&m<=6)||(m>=16&&m<=26);
export const matOf = v => Math.round(v/255*32);
