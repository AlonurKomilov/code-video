/* ===== AUDIO =====
   The ear is the one instrument this project does not have, so the soundtrack is
   rendered offline and measured. Each number has a known-bad beside it; without one
   "flatness 0.03" is just a number that happens to look small. */
import {check} from './lib.mjs';
import {open} from './browser.mjs';
import {flatness,roughness,bandpass,rms,peak,dB} from './dsp.mjs';
import {SHOTS,STARTS} from '../src/shots.mjs';
import {idxAt,CYCLE,FPS} from '../src/sheet.mjs';

const pg=await open();
const SECS=8, SR=16000;
const got=await pg.evaluate(([s,sr])=>window.__renderAudio(s,sr),[SECS,SR]);
const X=Float64Array.from(got.pcm), sr=got.sr;
const white=()=>{let s=7,o=new Float64Array(X.length);
 for(let i=0;i<o.length;i++){s=(s*1664525+1013904223)>>>0;o[i]=(s/2147483648-1)*0.2;} return o;};

await check({name:'audio/flatness', unit:'0=tonal 1=hiss',
 measure:()=>flatness(X,sr),
 pass:v=>v<0.20,
 calibrate:()=>flatness(white(),sr),
 note:'wind with a moving resonance, not a noise buffer with the treble turned down'});

await check({name:'audio/roughness', unit:'modulation near 70 Hz',
 measure:()=>roughness(X,sr),
 pass:v=>v<0.15,
 calibrate:()=>{                      // two tones a minor third apart in one critical band
  const o=new Float64Array(X.length);
  for(let i=0;i<o.length;i++){const t=i/sr;
   o[i]=0.25*Math.sin(2*Math.PI*196*t)+0.25*Math.sin(2*Math.PI*233*t);}
  return roughness(o,sr);},
 note:'an interval inside one critical band buzzes; drones are octaves for this reason'});

await check({name:'audio/phone', unit:'dBFS above 400 Hz',
 measure:()=>dB(rms(bandpass(X,sr,400,sr/2-100))),
 pass:v=>v>-30,
 calibrate:()=>dB(rms(bandpass(bandpass(X,sr,0,300),sr,400,sr/2-100))),
 note:'a phone speaker keeps almost nothing below 400 Hz, so that is where the level has to be'});

await check({name:'audio/headroom', unit:'peak',
 measure:()=>peak(X),
 pass:v=>v<0.99,
 calibrate:()=>peak(X.map(v=>v*6)),
 note:'a limiter, not luck'});

/* THE ONE THAT MATTERS: the sound of a foot landing has to be on the frame the foot
   is DRAWN landing. Both come from the same event, and this proves they still do. */
function syncError(shiftFrames){
 /* Each figure has its own phase and its own walking shots, so a step has to be
    checked against the phase of the character who took it. Scoring B's footfalls
    against A's clock was the first version of this check, and it reported one
    drawing of error on a soundtrack that was exactly in sync. */
 let worst=0;
 for(const e of TIMELINE){
  if(e.type!=='step') continue;
  const n=Math.round((e.t+shiftFrames/FPS)*FPS);
  const key = e.who==='b' ? 'bw' : 'aw';
  let ph = e.who==='b' ? 0.37 : 0;
  for(let f=0;f<n;f++){
   const tt=f/FPS; let s=0; for(let j=0;j<SHOTS.length;j++) if(tt>=STARTS[j]) s=j;
   if(SHOTS[s][key]) ph+=(1/FPS)/CYCLE;
  }
  const k=idxAt(ph);
  const d=Math.min((k+8)%8,(k-4+8)%8,(8-k)%8,(4-k+8)%8);
  worst=Math.max(worst,d);
 }
 return worst;
}
const TIMELINE=await pg.evaluate(()=>window.__timeline());
await check({name:'audio/footfall-sync', unit:'drawings away from a contact',
 measure:()=>syncError(0),
 pass:v=>v<=0,
 /* The contact drawing is held three slots -- six frames, a quarter of a second --
    and the foot really is on the ground for all of it, so a two-frame shift is still
    in sync and the first calibration proved nothing. Seven frames leaves the drawing. */
 calibrate:()=>syncError(7),
 note:'the footstep and the snow spray are the same event; this proves they still are'});
