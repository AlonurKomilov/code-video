/* Checks that need the renderer. Each one still carries its known-bad case. */
import {check} from './lib.mjs';
import {pixels,matOf,CHARACTER,open,close} from './browser.mjs';
import {SHOTS,STARTS} from '../src/shots.mjs';
import {FPS} from '../src/sheet.mjs';
const W=200,H=144;   // small on purpose: every check here is a ratio or a count, not a look

/* ===== ISH HAJMI: PRIMITIV SANOG'I, SOAT EMAS =====
   Renderer har nurda nechta primitivni tekshirganini 3-kanalga yozadi, va shu
   son mashinaga bog'liq emas -- qaysi kompyuterda yursa ham bir xil chiqadi.
   To'yingan zond o'lchov emas: agar piksel 255 ga tirralsa, nisbat "kamida
   shuncha" degan pol bo'lib qoladi, shuning uchun to'yinish xato beradi. */
const prim=async(frame,opt,wmax)=>{
 const p=await pixels(frame,W,H,{...opt,wmax},3); let s=0,sat=0;
 for(let k=0;k<W*H;k++){ s+=p[k*4]; if(p[k*4]>=255) sat++; }
 if(sat>W*H*0.001) throw new Error(`work probe saturated on ${sat} pixels at ${wmax} full scale`);
 return wmax*(s/(W*H))/255;};
const diff=(a,b)=>{let n=0;for(let k=0;k<a.length;k+=4)
 if(a[k]!==b[k]||a[k+1]!==b[k+1]||a[k+2]!==b[k+2])n++; return n/(a.length/4);};

await check({name:'determinism', unit:'fraction of pixels',
 measure:async()=>diff(await pixels(120,W,H), await pixels(120,W,H)),
 pass:v=>v===0,
 calibrate:async()=>diff(await pixels(120,W,H), await pixels(121,W,H)),
 note:'same frame twice must be identical; the next frame must not be, or the comparison sees nothing'});

/* the fold: mod repeats the street, and the neighbouring cell must be evaluated or
   the distance bound is wrong and rays go through the walls */
await check({name:'street-fold', unit:'fraction of pixels',
 measure:async()=>diff(await pixels(36,W,H,{nbr:1}), await pixels(36,W,H,{nbr:1})),
 pass:v=>v<0.002,
 calibrate:async()=>diff(await pixels(36,W,H,{nbr:1}), await pixels(36,W,H,{nbr:0})),
 note:'omitting the neighbour cells tears holes at every cell seam'});

/* THE COST OF A FOLDED WORLD DOES NOT GROW WITH HOW MUCH IS IN IT.

   This was wall-clock until CI proved it could not be. The oq-kocha tree was
   byte-identical across three runs and the job failed once and passed twice; the
   same job took 43 minutes on one runner and 75 on another, a 1.7x swing in
   machine speed. Six repeats of the old ratio on an idle box already wandered
   0.957 to 1.045 against a 1.35 threshold -- and the primitive count gave 0.9823
   six times out of six, spread exactly zero.

   The lesson was already written down one check below, on bounds-save-work. It
   had simply never been applied here, and so this check reported the runner's
   luck and called it the renderer's cost. */
await check({name:'street-cost', unit:'x primitive evals for 7.6x buildings',
 measure:async()=>(await prim(36,{cell:0.80},8192))/(await prim(36,{cell:6.10},8192)),
 pass:v=>v<1.35,
 /* Can this probe see a cost difference AT ALL? Turning the bounds off is a cost
    change the suite has already measured -- if the probe cannot register that,
    it cannot register anything, and the passing number above means nothing. */
 calibrate:async()=>(await prim(209,{bound:0},32768))/(await prim(209,{bound:1},4096)),
 note:'primitive evaluations, not milliseconds: the same number on any machine'});

/* interior line art: ink where forms meet, and nowhere else */
await check({name:'line-art', unit:'ink valley, levels',
 measure:async()=>{
  const mat=await pixels(209,W,H,{},1), lin=await pixels(209,W,H,{},2);
  const on =await pixels(209,W,H,{lines:1}), off=await pixels(209,W,H,{lines:0});
  const n=W*H; let sum=0,cnt=0;
  const L=(p,i)=>p[i*4];
  for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){
   const i=y*W+x, m=matOf(mat[i*4]); if(!CHARACTER(m))continue;
   let edge=false;
   for(const [dy,dx] of [[0,1],[0,-1],[1,0],[-1,0]]){
    const m2=matOf(mat[((y+dy)*W+(x+dx))*4]);
    if(CHARACTER(m2)&&m2!==m) edge=true;
   }
   if(!edge)continue;
   let mxOn=0,mxOff=0;
   for(let j=-2;j<=2;j++)for(let k=-2;k<=2;k++){
    const q=((y+j)*W+(x+k)); mxOn=Math.max(mxOn,L(on,q)); mxOff=Math.max(mxOff,L(off,q));
   }
   sum += (mxOn-L(on,i)) - (mxOff-L(off,i)); cnt++;
  }
  return cnt? sum/cnt : 0;},
 pass:v=>v>6,
 calibrate:async()=>0,        // lines off: by construction the valley does not deepen
 note:'measured as ink depth, not as contrast: a central difference skips the very pixel the line is on'});

/* the cheap bounds must actually be cheap. Wall-clock on a shared software renderer
   could not tell a real win from scheduling luck -- three runs of identical code gave
   1122, 1405 and 3234 ms -- so this counts primitive evaluations instead, which is
   exact, repeatable, and the same number on any machine. */
await check({name:'bounds-save-work', unit:'x fewer primitive evals',
 /* A SATURATED PROBE IS NOT A MEASUREMENT. At 4096 full scale the unbounded render
    pinned 38,458 of 41,520 pixels at white, so the ratio it reported was a floor:
    whatever the saving really was, this could only ever say "at least". That guard
    now lives in prim() above, which street-cost shares. */
 measure:async()=>(await prim(209,{bound:0},32768))/(await prim(209,{bound:1},4096)),
 pass:v=>v>1.8,
 calibrate:async()=>1.0,          // bounds on both sides: by construction, no saving
 note:'a bounding sphere for the figure and a slab test for each terrace'});

/* a shot whose subject is outside the frame is an empty shot */
for(let i=0;i<SHOTS.length;i++){
 const sh=SHOTS[i], f=Math.round((STARTS[i]+sh.d*0.5)*FPS);
 const area=async(opt)=>{
  const m=await pixels(f,W,H,opt,1); let d=0;
  for(let k=0;k<W*H;k++) if(CHARACTER(matOf(m[k*4]))) d++;
  return 100*d/(W*H);};
 await check({name:'occupancy/'+sh.k, unit:'% character',
  measure:()=>area({}),
  pass:v=>v>1.0,   // the establishing shot is legitimately 1.7%: the margin is thin by design
  calibrate:()=>area({cam:{ro:[sh.ro[0],sh.ro[1]+9,sh.ro[2]],ta:[sh.ta[0],sh.ta[1]+9,sh.ta[2]],foc:sh.foc}}),
  note:i===0?'counting DARK pixels scored an empty shot higher than a framed one — a wall is darker than two men':undefined});
}
