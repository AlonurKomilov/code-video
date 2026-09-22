/* ===== SOUND =====
   Synthesised, like everything else here: no audio file, no sample. Built so the
   same graph can be rendered offline into a buffer and MEASURED, because the ear
   is the one instrument this project does not have.

   Three rules learned the hard way on an earlier piece:
     1. An event is not a block of hiss. A footfall opens instantly and the top of
        its spectrum dies first; a constant gain over noise is a rectangle and reads
        as tape hiss, not as a sound.
     2. Two tones a small interval apart inside one critical band do not make a
        chord, they make a buzz. Drones are octaves.
     3. What matters is what survives a phone speaker, so the audibility number is
        measured above 400 Hz, not across the whole spectrum.                      */

export function noiseBuffer(ctx, seconds=3){
 const n=Math.floor(ctx.sampleRate*seconds), b=ctx.createBuffer(1,n,ctx.sampleRate);
 const d=b.getChannelData(0);
 let s=22222;
 for(let i=0;i<n;i++){ s=(s*1664525+1013904223)>>>0; d[i]=(s/2147483648)-1; }
 return b;
}
/* SNOW. A footfall in snow is not one crush, it is a few hundred tiny ones inside
   a hundred milliseconds -- the granularity IS the material. A flat decay over
   noise gives you a sandbag. */
export function crunchBuffer(ctx, seed, dur=0.16, bright=0.5){
 const n=Math.floor(ctx.sampleRate*dur), b=ctx.createBuffer(1,n,ctx.sampleRate);
 const d=b.getChannelData(0);
 let s=(seed*2654435761)>>>0;
 const rnd=()=>{s=(s*1664525+1013904223)>>>0; return s/4294967296;};
 let grain=0, gl=0;
 for(let i=0;i<n;i++){
  const t=i/n;
  if(gl<=0){ gl=Math.floor(ctx.sampleRate*(0.0008+rnd()*0.0045)); grain=(rnd()*2-1)*(0.35+rnd()*0.65); }
  gl--;
  const env=Math.pow(1-t,2.2+bright*1.6);
  d[i]=(rnd()*2-1)*grain*env;
 }
 return b;
}
export function buildBus(ctx){
 const master=ctx.createGain(); master.gain.value=1.00;
 /* a limiter, not a compressor doing a limiter's job badly */
 const lim=ctx.createDynamicsCompressor();
 lim.threshold.value=-6; lim.knee.value=2; lim.ratio.value=20;
 lim.attack.value=0.002; lim.release.value=0.14;
 master.connect(lim).connect(ctx.destination);
 return {master,lim};
}
export function buildBeds(ctx, master, noise){
 const mk=(type,f,q,g)=>{const b=ctx.createBiquadFilter();b.type=type;b.frequency.value=f;b.Q.value=q;return b;};
 const src=ctx.createBufferSource(); src.buffer=noise; src.loop=true;
 /* WIND is not hiss with the treble off. It has a resonance, and the resonance
    MOVES -- that movement is the whole of what makes it read as air and not tape. */
 const w1=mk('bandpass',320,1.5), w2=mk('bandpass',980,2.2), w3=mk('lowpass',180,0.8);
 const g1=ctx.createGain(), g2=ctx.createGain(), g3=ctx.createGain();
 g1.gain.value=0.0; g2.gain.value=0.0; g3.gain.value=0.0;
 src.connect(w1).connect(g1); src.connect(w2).connect(g2); src.connect(w3).connect(g3);
 const windSum=ctx.createGain(); windSum.gain.value=1.0;
 g1.connect(windSum); g2.connect(windSum); g3.connect(windSum);
 windSum.connect(master);
 /* the gusts: two rates, so it breathes instead of pulsing */
 const lfo=(rate,depth,target,base)=>{
  const o=ctx.createOscillator(); o.type='sine'; o.frequency.value=rate;
  const a=ctx.createGain(); a.gain.value=depth;
  o.connect(a).connect(target); target.value=base; o.start(); return o;
 };
 lfo(0.073, 260, w1.frequency, 360);
 lfo(0.041, 520, w2.frequency, 1050);
 const gust=ctx.createGain(); gust.gain.value=1;
 /* CITY: an octave, never a third. Two close partials in one critical band buzz. */
 const c1=ctx.createOscillator(), c2=ctx.createOscillator();
 c1.type='sawtooth'; c2.type='sawtooth'; c1.frequency.value=48; c2.frequency.value=96;
 const clp=mk('lowpass',210,0.7), cg=ctx.createGain(); cg.gain.value=0;
 c1.connect(clp); c2.connect(clp); clp.connect(cg).connect(master);
 const cn=ctx.createBufferSource(); cn.buffer=noise; cn.loop=true;
 const cbp=mk('bandpass',150,0.9), cng=ctx.createGain(); cng.gain.value=0;
 cn.connect(cbp).connect(cng).connect(master);
 src.start(); cn.start(); c1.start(); c2.start();
 return {
  wind:{a:g1.gain,b:g2.gain,c:g3.gain},
  city:{tone:cg.gain,air:cng.gain},
  set(windLvl, cityLvl, at, glide=0.25){
   const S=(p,v)=>p.setTargetAtTime(v,at,glide);
   S(g1.gain, 0.400*windLvl); S(g2.gain, 0.330*windLvl); S(g3.gain, 0.330*windLvl);
   S(cg.gain, 0.070*cityLvl); S(cng.gain, 0.210*cityLvl);
  }
 };
}
/* EVENTS. Each one opens fast and its top end dies first. */
export function makeVoices(ctx, master, noise, crunches){
 const pan=(x)=>{const p=ctx.createStereoPanner(); p.pan.value=x; p.connect(master); return p;};
 return {
  step(t, gainv, x, size){
   const s=ctx.createBufferSource();
   s.buffer=crunches[(Math.abs(Math.round(t*97))|0)%crunches.length];
   s.playbackRate.value=0.82+((t*13.7)%1)*0.5;
   const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=2600*size; bp.Q.value=0.8;
   const g=ctx.createGain();
   g.gain.setValueAtTime(0,t);
   g.gain.linearRampToValueAtTime(gainv*3.0,t+0.004);       // instant, the way a step lands
   g.gain.exponentialRampToValueAtTime(0.0005,t+0.20);
   bp.frequency.setValueAtTime(3200*size,t);
   bp.frequency.exponentialRampToValueAtTime(900*size,t+0.16);   // the top goes first
   s.connect(bp).connect(g).connect(pan(x)); s.start(t); s.stop(t+0.26);
   /* and the weight underneath it */
   const l=ctx.createBufferSource(); l.buffer=noise; l.loop=true;
   const lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=190; lp.Q.value=0.9;
   const lg=ctx.createGain();
   lg.gain.setValueAtTime(0,t);
   lg.gain.linearRampToValueAtTime(gainv*1.45,t+0.006);
   lg.gain.exponentialRampToValueAtTime(0.0004,t+0.11);
   l.connect(lp).connect(lg).connect(pan(x*0.4)); l.start(t,(t*7)%2); l.stop(t+0.15);
  },
  cloth(t, gainv, x){
   const s=ctx.createBufferSource(); s.buffer=noise; s.loop=true;
   const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=2100; bp.Q.value=0.7;
   const g=ctx.createGain();
   g.gain.setValueAtTime(0,t);
   g.gain.linearRampToValueAtTime(gainv*2.0,t+0.03);
   g.gain.exponentialRampToValueAtTime(0.0004,t+0.30);
   bp.frequency.setValueAtTime(2600,t); bp.frequency.exponentialRampToValueAtTime(950,t+0.28);
   s.connect(bp).connect(g).connect(pan(x)); s.start(t,(t*3)%2); s.stop(t+0.34);
  },
  breath(t, gainv){
   const s=ctx.createBufferSource(); s.buffer=noise; s.loop=true;
   const bp=ctx.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=640; bp.Q.value=1.1;
   const g=ctx.createGain();
   g.gain.setValueAtTime(0,t);
   g.gain.linearRampToValueAtTime(gainv*2.2,t+0.12);
   g.gain.exponentialRampToValueAtTime(0.0004,t+0.62);
   s.connect(bp).connect(g).connect(pan(0.05)); s.start(t,(t*5)%2); s.stop(t+0.68);
  },
  metal(t, gainv, x){
   /* a bell is inharmonic: 1.00, 2.76, 5.40 -- harmonic partials give you a flute */
   for(const [r,a] of [[1,1],[2.76,0.5],[5.40,0.22]]){
    const o=ctx.createOscillator(); o.type='sine'; o.frequency.value=430*r;
    const g=ctx.createGain();
    g.gain.setValueAtTime(0,t);
    g.gain.linearRampToValueAtTime(gainv*a*2.4,t+0.003);
    g.gain.exponentialRampToValueAtTime(0.0003,t+0.55/Math.sqrt(r));
    o.connect(g).connect(pan(x)); o.start(t); o.stop(t+0.7);
   }
  }
 };
}
