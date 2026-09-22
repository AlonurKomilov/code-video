/* Checks that need no browser: the exposure sheet, the model sheet, the cuts. */
import {readFileSync} from 'fs';
import {check} from './lib.mjs';
import {HOLDS,SLOTS,TRAVEL,CYCLE,idxAt,travel,walkFrom} from '../src/sheet.mjs';
import {SHOTS} from '../src/shots.mjs';
const POSES=JSON.parse(readFileSync(new URL('../src/poses.json',import.meta.url),'utf8'));
const WALK=walkFrom(POSES.PW);
const D=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);

/* the planted foot is FIXED IN THE WORLD: ankle_x + distance travelled must not move */
function plantDrift(travelFn){
 let worst=0;
 for(let f=0;f<=96;f++){
  const ph=f/96*3;                                  // three cycles
  const i=idxAt(ph);
  if(i>4) continue;                                 // drawings 0-4: the near foot is down
  const x=WALK[i].na[0]/100 + travelFn(ph);
  if(i===0) plantDrift.ref=x;
  if(plantDrift.ref!==undefined) worst=Math.max(worst,Math.abs(x-plantDrift.ref));
 }
 return worst;
}
const SPEED=TRAVEL/CYCLE;
await check({name:'foot-plant', unit:'body-heights',
 measure:()=>plantDrift(travel),
 pass:v=>v<0.004,
 calibrate:()=>plantDrift(ph=>ph*TRAVEL),            // constant velocity: the old bug
 note:'the world steps when the drawing steps; a constant velocity under an uneven timing chart slides the foot'});

/* one body, drawn sixteen times: the bones do not change length between drawings */
function limbSpread(poses){
 /* Measured as a PERCENTAGE of the limb's own mean length, not in raw units: a
    2-unit wobble means nothing on a 25-unit thigh and everything on a 4-unit hand,
    and an absolute threshold loose enough for one is blind to the other. */
 const keys={thighN:K=>D([0,K.hip],K.nk), shinN:K=>D(K.nk,K.na),
             thighF:K=>D([0,K.hip],K.fk), shinF:K=>D(K.fk,K.fa),
             upN:K=>D(K.sh,K.neb), foreN:K=>D(K.neb,K.nh)};
 let worst=0;
 for(const fn of Object.values(keys)){
  const v=poses.map(fn), mean=v.reduce((a,b)=>a+b,0)/v.length;
  worst=Math.max(worst, 100*(Math.max(...v)-Math.min(...v))/mean);
 }
 return worst;
}
await check({name:'model-sheet', unit:'% of limb length',
 measure:()=>limbSpread(WALK),
 pass:v=>v<5.0,
 calibrate:()=>{                                   // one thigh stretched 8%: a rubber limb
  const bent=WALK.map(p=>({...p})), k=bent[3];
  const dx=k.nk[0]-0, dy=k.nk[1]-k.hip;
  bent[3]={...k, nk:[0+dx*1.08, k.hip+dy*1.08]};
  return limbSpread(bent);},
 note:'a limb that changes length between drawings is a rubber limb'});

/* cuts: MATCH on purpose, CLEAN for a real change, and nothing in the middle */
function jumps(shots){
 let n=0;
 for(let i=1;i<shots.length;i++){
  const r=shots[i].sz/shots[i-1].sz;
  const match=(r>=0.98&&r<=1.02), clean=(r>=1.45||r<=1/1.45);
  if(!match&&!clean) n++;
 }
 return n;
}
await check({name:'cut-sizes', unit:'JUMP cuts',
 measure:()=>jumps(SHOTS),
 pass:v=>v===0,
 calibrate:()=>jumps(SHOTS.concat([{...SHOTS[0],sz:SHOTS[SHOTS.length-1].sz*1.2}])),
 note:'a 1.05-1.44x change of size is the zone the eye reads as a mistake'});

/* the sheet itself has to add up */
await check({name:'sheet-arithmetic', unit:'slots',
 measure:()=>SLOTS-HOLDS.reduce((a,b)=>a+b,0),
 pass:v=>v===0,
 calibrate:()=>1,
 note:`${HOLDS.join('·')} at 12 drawings a second = ${CYCLE.toFixed(3)}s a cycle`});
