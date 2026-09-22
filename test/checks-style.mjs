/* ===== A STYLE IS A DOCUMENT, AND THESE ARE ITS TERMS =====
   The renderer already drew this line for itself: pass one writes what was MEASURED
   about a surface and decides nothing about how it looks; pass two settles the look.
   So the style IS pass two -- plus the lighting model, which had leaked into pass one
   and is a look decision wherever it sits. src/styles/ holds those decisions.

   The reason to write it down is not tidiness. It is that a style boundary you have
   never crossed is not a boundary, it is a folder. Two styles, and three things that
   have to be true between them:

     a style may change every tone in the picture
     and it may not move a single edge
     and it has to keep its own promises, which are its own numbers.

   The third is the one that makes this more than a palette swap. Thick air and ink
   that thins into it are decisions oq-qalam made; tekis-cel decided otherwise, so its
   horizon may show and its ink may keep its weight -- and both still have to reject
   the same deliberately broken render. */
import {check} from './lib.mjs';
import {pixels,matOf} from './browser.mjs';
import {SHOTS,STARTS} from '../src/shots.mjs';
import {FPS} from '../src/sheet.mjs';
import {load} from '../tools/style.mjs';
const W=240,H=173;
const lum=(p,i)=>p[i*4];
const mean=a=>a.length? a.reduce((x,y)=>x+y,0)/a.length : null;
const STYLES=load(new URL('../src/styles',import.meta.url).pathname);
const NAMES=STYLES.map(s=>s.name);
const streetF=Math.round((STARTS[0]+1.5)*FPS), walkF=Math.round((STARTS[1]+0.6)*FPS);

/* EVERY STYLE ANSWERS EVERY QUESTION. If one file may leave a decision out, the
   shader keeps whatever the last style set and the two stop being comparable --
   which is the one thing a style file exists to prevent. Enforced at build time by
   tools/style.mjs; measured here so it is visible in the table with everything else. */
await check({name:'style/all-questions-answered', unit:'decisions the thinnest style is missing',
 measure:()=>{
  const keys=Object.keys(STYLES[0].p), cl=Object.keys(STYLES[0].claims).filter(k=>k!=='note');
  let worst=0;
  for(const s of STYLES){
   const miss=keys.filter(k=>!(k in s.p)).length
             + cl.filter(k=>!(k in s.claims)).length
             + (s.pal? 0 : 1);
   worst=Math.max(worst,miss);
  }
  return worst;},
 pass:v=>v===0,
 calibrate:()=>{                       // a style with one decision taken out of it
  const keys=Object.keys(STYLES[0].p), thin={...STYLES[0].p}; delete thin[keys[3]];
  return keys.filter(k=>!(k in thin)).length;},
 note:`${NAMES.length} styles, ${Object.keys(STYLES[0].p).length} decisions and ${Object.keys(STYLES[0].claims).length-1} claims each`});

/* A STYLE MAY CHANGE EVERY TONE AND MAY NOT MOVE AN EDGE. That is the whole boundary,
   and it is exactly measurable: the material and depth buffers are what pass one
   measured about the world, so if swapping the style disturbs either of them, what
   changed was not the style -- it was the film. */
async function buffersDiffer(a,b,mode){
 let worst=0;
 for(const f of [streetF,walkF]){
  const A=await pixels(f,W,H,{style:a},mode), B=await pixels(f,W,H,{style:b},mode);
  let n=0; for(let i=0;i<W*H;i++) if(A[i*4]!==B[i*4]) n++;
  worst=Math.max(worst,100*n/(W*H));
 }
 return worst;
}
await check({name:'style/leaves-the-drawing-alone', unit:'% of material pixels that moved',
 measure:()=>buffersDiffer(NAMES[0],NAMES[1],1),
 pass:v=>v===0,
 calibrate:async()=>{     // a "style" that also respaces the street: a world change wearing a look
  const A=await pixels(streetF,W,H,{style:NAMES[0]},1), B=await pixels(streetF,W,H,{style:NAMES[1],cell:3.6},1);
  let n=0; for(let i=0;i<W*H;i++) if(matOf(A[i*4])!==matOf(B[i*4])) n++;
  return 100*n/(W*H);},
 note:'the material buffer is what pass one measured; a look has no business in it'});

await check({name:'style/leaves-the-depth-alone', unit:'% of depth pixels that moved',
 measure:()=>buffersDiffer(NAMES[0],NAMES[1],4),
 pass:v=>v<0.2,
 calibrate:async()=>{
  const A=await pixels(streetF,W,H,{style:NAMES[0]},4), B=await pixels(streetF,W,H,{style:NAMES[1],cell:3.6},4);
  let n=0; for(let i=0;i<W*H;i++) if(A[i*4]!==B[i*4]) n++;
  return 100*n/(W*H);},
 note:'same geometry, same distances — whatever the marks on top of them look like'});

/* AND IT HAS TO ACTUALLY BE A SECOND STYLE. Two files that render the same picture
   are one style stored twice, and the boundary they draw is imaginary. */
await check({name:'style/changes-the-picture', unit:'mean levels between the two styles',
 measure:async()=>{
  let worst=0;
  for(const f of [streetF,walkF]){
   const A=await pixels(f,W,H,{style:NAMES[0]}), B=await pixels(f,W,H,{style:NAMES[1]});
   let s=0; for(let i=0;i<W*H;i++) s+=Math.abs(lum(A,i)-lum(B,i));
   worst=Math.max(worst,s/(W*H));
  }
  return worst;},
 pass:v=>v>8,
 calibrate:async()=>{     // a style against itself
  const A=await pixels(streetF,W,H,{style:NAMES[0]}), B=await pixels(streetF,W,H,{style:NAMES[0]});
  let s=0; for(let i=0;i<W*H;i++) s+=Math.abs(lum(A,i)-lum(B,i));
  return s/(W*H);},
 note:'a second style that renders the first style is one style stored twice'});

/* ===== EACH STYLE KEEPS ITS OWN PROMISES =====
   The threshold is part of the style. tekis-cel is allowed a horizon oq-qalam is not,
   and is allowed ink that barely thins -- but a looser claim is still a claim, and
   every one of them is measured against the same broken render and has to reject it. */
async function horizonStep(st,opt){
 const pic=await pixels(walkF,W,H,{style:st,...opt}), mat=await pixels(walkF,W,H,{style:st},1);
 const row=y=>{const v=[]; for(let x=0;x<W;x++){ const i=y*W+x, m=matOf(mat[i*4]);
  if(m===0||m===10||m===14) v.push(lum(pic,i)); } return v;};
 let worst=0;
 for(let y=Math.round(H*0.30);y<H-2;y++){
  const a=row(y), b=row(y+1);
  if(a.length<W*0.5||b.length<W*0.5) continue;
  worst=Math.max(worst,Math.abs(mean(a)-mean(b)));
 }
 return worst;
}
async function groundTone(st){
 const mat=await pixels(streetF,W,H,{style:st},1), pic=await pixels(streetF,W,H,{style:st});
 const road=[],snow=[];
 for(let i=0;i<W*H;i++){ const m=matOf(mat[i*4]);
  if(m===14) road.push(lum(pic,i)); else if(m===10) snow.push(lum(pic,i)); }
 return mean(snow)-mean(road);
}
const test={
 horizonStep:{ m:st=>horizonStep(st,{}),        c:st=>horizonStep(st,{fog:0}) },
 groundTone: { m:st=>groundTone(st),            c:st=>groundTone(st) }   // see below
};
for(const s of STYLES){
 for(const key of ['horizonStep','groundTone']){
  const [op,limit,what]=s.claims[key];
  const ok=v=>op==='<'? v<limit : v>limit;
  await check({name:`claim/${s.name}/${key}`, unit:what,
   measure:()=>test[key].m(s.name),
   pass:ok,
   calibrate:key==='horizonStep'
    ? ()=>test.horizonStep.c(s.name)          // the weather switched off: the ground stops
    : async()=>{                              // the rim ungated: the ground erased to white
       const mat=await pixels(streetF,W,H,{style:s.name},1);
       const pic=await pixels(streetF,W,H,{style:s.name,rimg:0});
       const road=[],snow=[];
       for(let i=0;i<W*H;i++){ const m=matOf(mat[i*4]);
        if(m===14) road.push(lum(pic,i)); else if(m===10) snow.push(lum(pic,i)); }
       return mean(snow)-mean(road);},
   note:`${s.title}: ${op} ${limit}`});
 }
}
