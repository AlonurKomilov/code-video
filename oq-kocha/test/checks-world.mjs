/* ===== DOES THE WORLD ACTUALLY WORK =====
   Not "does it render" -- it plainly does -- but: does the ground move with the man
   and hold still between, does distance behave like distance, does the ground carry
   any tone at all, and do the savings that make this film affordable change the
   picture they were supposed to leave alone.

   Every check in this file was written after looking at a frame and finding something
   wrong with it. Four of them are here because the thing they watch was broken for
   the whole life of the project and no existing check could see it. */
import {check} from './lib.mjs';
import {pixels,state,matOf,CHARACTER} from './browser.mjs';
import {SHOTS,STARTS} from '../src/shots.mjs';
import {FPS} from '../src/sheet.mjs';
const W=240,H=173;
const lum=(p,i)=>p[i*4];
const mean=a=>a.length? a.reduce((x,y)=>x+y,0)/a.length : null;

/* readPixels puts y=0 at the BOTTOM. Two checks in this file were wrong about that
   and both reported a confident pass on an empty set of pixels. */
const streetF=Math.round((STARTS[0]+1.5)*FPS);
const walkF  =Math.round((STARTS[1]+0.6)*FPS);

/* GROUND ONLY, AND AS A DIFFERENCE RATHER THAN A SHIFT. Two earlier versions of the
   next check were blind in two different ways. Correlating whole frames of the empty
   field looked like a ground check and was not one: the snow there carries almost no
   tone, so the only thing with contrast in the strip was the man, and the correlator
   tracked HIM -- 0 inside a held drawing and 10px across a change, both true of the
   drawing and neither about the ground. Moving it to the street fixed the texture and
   broke the geometry: every street camera looks ALONG the street, so the world slides
   down the view axis and a horizontal correlator sees nothing move either way.
   What the check actually claims is simpler than a shift: inside a held drawing the
   ground does not change, and across a change it does. Freeze the weather, because
   flakes land on the ground too and they fall on every frame whatever the sheet says. */
async function groundChanged(f0,f1){
 const A=await pixels(f0,W,H,{snow:0}), B=await pixels(f1,W,H,{snow:0});
 const ma=await pixels(f0,W,H,{},1);
 let n=0,tot=0;
 for(let i=0;i<W*H;i++){ const m=matOf(ma[i*4]); if(m!==10&&m!==14) continue;
  tot++; if(Math.abs(lum(A,i)-lum(B,i))>4) n++; }
 if(tot<3000) throw new Error('not enough ground in frame');
 return 100*n/tot;
}
/* ASK THE FILM WHICH DRAWING IS UP. The first version of the check below worked the
   exposure index out again from the shot start, and got a different answer, because
   the walk phase accumulates across every shot that walks and not from the cut. Both
   the measurement and its calibration landed inside a hold, so the check reported
   0.000 against 0.000 and proved nothing at all. */
async function pairs(f0){
 let held=null, cut=null;
 let prev=await state(f0);
 for(let i=1;i<26 && !(held&&cut);i++){
  const cur=await state(f0+i);
  if(cur.idx===prev.idx && !held) held=[f0+i-1,f0+i];
  if(cur.idx!==prev.idx && !cut)  cut =[f0+i-1,f0+i];
  prev=cur;
 }
 if(!held||!cut) throw new Error('no held pair and no drawing change within 26 frames');
 return {held,cut};
}
const P=await pairs(streetF);

/* THE WORLD MOVES WHEN THE DRAWING MOVES, AND NOT BETWEEN. That is the whole reason
   the planted foot does not slide, and it is visible in the ground itself. */
await check({name:'world/ground-holds', unit:'% of ground changed in one drawing',
 measure:()=>groundChanged(P.held[0],P.held[1]),
 pass:v=>v<0.4,
 calibrate:()=>groundChanged(P.cut[0],P.cut[1]),
 note:'the ground is still while a drawing is held and jumps when it changes — that IS the plant'});

/* ===== AND IT HAS TO MOVE THE RIGHT WAY =====
   It did not. A building at fold coordinate X drew at p.x = X + dist, so every
   feature in the world moved FURTHER off as he walked: 1.23 units of walking pushed
   a tracked building from 24.35 to 25.91 units away. He was walking down a street
   that was running away from him, for the whole life of the project.

   The exposure sheet had the opposite convention the whole time -- foot-plant works
   the foot's world x out as local + travel, the character advancing in +x -- so the
   planted foot was sliding at double rate as well. Neither was caught, because
   foot-plant is arithmetic on the sheet and never looks at a pixel, and no check
   asked which way the world goes. This is that check. */
async function approachRate(opt){
 const pts=[];
 for(const f of [12,28,44,60]){
  const st=await state(f,W,H);
  /* one building every forty units instead of every three, so the same building is
     still the same building at the end of the measurement */
  const dep=await pixels(f,W,H,{...opt,cell:40},4), mat=await pixels(f,W,H,{...opt,cell:40},1);
  let s=0,n=0;
  for(let i=0;i<W*H;i++){ const m=matOf(mat[i*4]); if(m!==11&&m!==13) continue;
   s+=dep[i*4]/255*60; n++; }
  if(n<2000) throw new Error('not enough building in frame');
  pts.push([st.di, s/n]);
 }
 const mx=mean(pts.map(p=>p[0])), my=mean(pts.map(p=>p[1]));
 let num=0,den=0;
 for(const [x,y] of pts){ num+=(x-mx)*(y-my); den+=(x-mx)*(x-mx); }
 return -num/den;              // metres nearer per metre walked; negative means it flees
}
await check({name:'world/street-approaches', unit:'units nearer per unit walked',
 measure:()=>approachRate({}),
 pass:v=>v>0.5,
 calibrate:()=>approachRate({wdir:-1}),    // the film as it was: he walks, the city retreats
 note:'he walks into the street, so the street has to come to him'});

/* DISTANCE HAS TO BEHAVE LIKE DISTANCE. Binning wall tone by depth mixed the weather
   up with which way a wall faces, and called a working haze broken. Rendering the
   SAME frame twice, with and without fog, removes the surface from the question. */
async function fogRise(){
 const dep=await pixels(streetF,W,H,{},4);
 const on =await pixels(streetF,W,H,{fog:1});
 const off=await pixels(streetF,W,H,{fog:0});
 const mat=await pixels(streetF,W,H,{},1);
 const edges=[4,10,18,28,60], bins=edges.slice(1).map(()=>[]);
 for(let i=0;i<W*H;i++){
  const m=matOf(mat[i*4]); if(m<10||m>15) continue;
  const t=dep[i*4]/255*60;
  for(let b=0;b<bins.length;b++) if(t>=edges[b]&&t<edges[b+1]){ bins[b].push(lum(on,i)-lum(off,i)); break; }
 }
 return bins.map(b=>b.length>40? mean(b) : null);
}
await check({name:'world/haze-with-depth', unit:'monotone steps out of 3',
 measure:async()=>{
  const b=(await fogRise()).filter(v=>v!=null);
  let ok=0; for(let i=1;i<b.length;i++) if(b[i]>b[i-1]+1) ok++;
  return ok;},
 pass:v=>v>=3, calibrate:async()=>0,
 note:'the same frame with and without fog, differenced and binned by real depth'});

/* A SURFACE MUST STAY THE SAME SURFACE, or the picture crawls when nothing moves. */
await check({name:'world/material-flicker', unit:'% of pixels changing material',
 measure:async()=>{
  const A=await pixels(streetF,W,H,{},1), B=await pixels(streetF+1,W,H,{},1);
  let n=0; for(let i=0;i<W*H;i++) if(matOf(A[i*4])!==matOf(B[i*4])) n++;
  return 100*n/(W*H);},
 pass:v=>v<0.8,
 calibrate:async()=>{
  const A=await pixels(streetF,W,H,{},1), B=await pixels(streetF+1,W,H,{nbr:0},1);
  let n=0; for(let i=0;i<W*H;i++) if(matOf(A[i*4])!==matOf(B[i*4])) n++;
  return 100*n/(W*H);},
 note:'between adjacent frames of a moving camera some change is expected; crawl is not'});

/* ===== THE GROUND HAS TO BE A GROUND =====
   The road material is authored at 0.61 and the snow beside it at 0.97 -- a third of
   the frame apart in tone. It measured 250 against 253: both pure white, because the
   rim term treated a floor seen at a grazing angle as a surface turning away from the
   camera and added about +1.5 to a colour that tops out at 1.0. Half of every street
   frame was a white void with a man standing in it. */
await check({name:'world/ground-has-tone', unit:'levels between road and snow',
 measure:async()=>{
  const mat=await pixels(streetF,W,H,{},1), pic=await pixels(streetF,W,H);
  const road=[],snow=[];
  for(let i=0;i<W*H;i++){ const m=matOf(mat[i*4]);
   if(m===14) road.push(lum(pic,i)); else if(m===10) snow.push(lum(pic,i)); }
  if(road.length<300||snow.length<300) throw new Error('not enough ground in frame');
  return mean(snow)-mean(road);},
 pass:v=>v>40,
 calibrate:async()=>{   // the film as it was: the rim ungated, and the ground erased
  const mat=await pixels(streetF,W,H,{},1), pic=await pixels(streetF,W,H,{rimg:0});
  const road=[],snow=[];
  for(let i=0;i<W*H;i++){ const m=matOf(mat[i*4]);
   if(m===14) road.push(lum(pic,i)); else if(m===10) snow.push(lum(pic,i)); }
  return mean(snow)-mean(road);},
 note:'a road that measures the same as the snow either side of it is not a road'});

/* THE MAN HAS TO SIT ON THE GROUND, and what puts him there is the shadow.
   This check read the rows above his HEAD, because readPixels counts from the bottom
   and it took his highest row for his lowest. There were no ground pixels up there,
   so the near set was empty, its mean was zero, and the check reported the brightness
   of open snow -- 254.95 out of 255 -- as "levels darker underneath him", and passed.
   A contact shadow cannot be 255 levels deep. The impossible value was the tell. */
await check({name:'world/contact-shadow', unit:'levels darker under his feet',
 measure:async()=>{
  const mat=await pixels(walkF,W,H,{},1), pic=await pixels(walkF,W,H);
  let minx=W,maxx=0,miny=H;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)
   if(CHARACTER(matOf(mat[(y*W+x)*4]))){ if(x<minx)minx=x; if(x>maxx)maxx=x; if(y<miny)miny=y; }
  const w=maxx-minx, hi=miny+Math.max(4,Math.round(w*0.18));
  const band=(x0,x1)=>{const v=[];
   for(let y=Math.max(0,miny-2);y<hi;y++)for(let x=Math.max(0,x0);x<Math.min(W,x1);x++){
    const m=matOf(mat[(y*W+x)*4]); if(m===10||m===14) v.push(lum(pic,y*W+x)); }
   return v;};
  const near=band(minx-4,maxx+4), far=band(maxx+Math.round(w*0.6),maxx+3*w);
  if(near.length<40||far.length<40) throw new Error('feet or open ground not found');
  return mean(far)-mean(near);},
 pass:v=>v>8,
 calibrate:async()=>{   // two patches of open ground, both away from him: no shadow, no difference
  const mat=await pixels(walkF,W,H,{},1), pic=await pixels(walkF,W,H);
  let maxx=0,miny=H;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)
   if(CHARACTER(matOf(mat[(y*W+x)*4]))){ if(x>maxx)maxx=x; if(y<miny)miny=y; }
  const band=(x0,x1)=>{const v=[];
   for(let y=Math.max(0,miny-2);y<miny+14;y++)for(let x=Math.max(0,x0);x<Math.min(W,x1);x++){
    const m=matOf(mat[(y*W+x)*4]); if(m===10||m===14) v.push(lum(pic,y*W+x)); }
   return v;};
  return Math.abs(mean(band(maxx+30,maxx+55))-mean(band(maxx+55,maxx+80)));},
 note:'snow beside him minus snow beneath him: if that is zero he is floating'});

/* ===== THE SAVINGS MUST NOT SHOW =====
   uBound skips the real figure outside a bounding sphere and the ground texture far
   above the ground. Its COST was measured from the first day -- 2.85x -- and its
   effect on the picture never was. Outside the shell the field returns the distance
   to the SHELL, which is a valid lower bound and up to a third of a metre short of
   the truth, so the field falls off a cliff there; a soft shadow reads a cliff as a
   surface passing close by, and the snow field was ringed with the shadow of a sphere
   that is not in the picture. This is the check that should have existed. */
await check({name:'world/bounds-dont-light', unit:'mean levels, bounded vs exact',
 measure:async()=>{
  const A=await pixels(walkF,W,H,{bound:1}), B=await pixels(walkF,W,H,{bound:0});
  let s=0; for(let i=0;i<W*H;i++) s+=Math.abs(lum(A,i)-lum(B,i));
  return s/(W*H);},
 pass:v=>v<1.2,
 calibrate:async()=>{   // the same comparison one frame apart: a real difference must register
  const A=await pixels(walkF,W,H,{bound:1}), B=await pixels(walkF+6,W,H,{bound:0});
  let s=0; for(let i=0;i<W*H;i++) s+=Math.abs(lum(A,i)-lum(B,i));
  return s/(W*H);},
 note:'an optimisation is only an optimisation if it leaves the picture alone'});

/* HOW MUCH INK LANDS, near and far. A far building carries more edges per pixel than
   a near road does, so the raw near/far ratio is a fact about the shot, not about the
   fade. Dividing each band by the SAME band rendered without the fade cancels the
   content and leaves only what the fade did: near it should do nothing, far it should
   do almost everything. */
async function inkBands(opt){
 const dep=await pixels(streetF,W,H,{},4), mat=await pixels(streetF,W,H,{},1);
 const on =await pixels(streetF,W,H,{...opt,lines:1});
 const off=await pixels(streetF,W,H,{...opt,lines:0});
 let n=0,nd=0,f=0,fd=0;
 for(let i=0;i<W*H;i++){ const m=matOf(mat[i*4]); if(m<10||m>15) continue;
  const t=dep[i*4]/255*60, v=Math.max(lum(off,i)-lum(on,i),0);
  if(t<14){n+=v;nd++;} else if(t>26){f+=v;fd++;} }
 if(nd<200||fd<200) throw new Error('not enough near or far world in frame');
 return [n/nd, f/fd];
}
async function inkRatio(opt){
 const [n,f]   = await inkBands(opt);
 const [n0,f0] = await inkBands({...opt,lfar:0});     // the same ink with nothing taken away
 const near = n/Math.max(n0,1e-4), far = f/Math.max(f0,1e-4);
 return near/Math.max(far,1e-4);
}
/* INK HAS TO GO AWAY WITH DISTANCE. The contour faded; the interior line did not, and
   the depth test is a relative one, so at forty units every ledge and parapet spans a
   pixel and almost every pixel of a far building reports an edge. The far end of the
   street was not fading into weather, it was dissolving into black speckle. */
await check({name:'world/distance-quiets', unit:'near ink / far ink',
 /* AND IT HAS TO BE THE INK THAT LANDS, NOT THE INK THAT WAS DETECTED. The line
    debug channel reports the raw edge strength, which is the same whether or not the
    composite then fades it -- so the first version of this check measured the defect
    and its own fix identically, 0.206 against 0.206, and called it a failure. What
    darkens the picture is the difference between the frame with ink and the frame
    without it, which is a thing only the finished picture knows. */
 measure:async()=>{ return await inkRatio({}); },
 pass:v=>v>2.0,
 calibrate:async()=>{ return await inkRatio({lfar:0}); },   // ink at full strength however far
 note:'an artist draws fewer lines on far things; the ratio says by how much'});

/* THE HORIZON OF A WHITEOUT IS NOT A LINE. The empty field marched only seven units,
   so the "horizon" was the clip plane: a dead level edge with a tone step across it.
   And a road ran through the empty field, ungated, sixty-four levels darker than the
   snow -- invisible for exactly as long as the rim term was erasing the ground. */
await check({name:'world/horizon-dissolves', unit:'largest row-to-row step, levels',
 measure:async()=>{
  const pic=await pixels(walkF,W,H), mat=await pixels(walkF,W,H,{},1);
  const row=y=>{const v=[]; for(let x=0;x<W;x++){const i=y*W+x;
   const m=matOf(mat[i*4]); if(m===0||m===10||m===14) v.push(lum(pic,i));} return v;};
  let worst=0;
  for(let y=Math.round(H*0.30);y<H-2;y++){
   const a=row(y), b=row(y+1);
   if(a.length<W*0.5||b.length<W*0.5) continue;
   worst=Math.max(worst,Math.abs(mean(a)-mean(b)));
  }
  return worst;},
 pass:v=>v<6,
 calibrate:async()=>{   // with the weather switched off the ground simply stops
  const pic=await pixels(walkF,W,H,{fog:0}), mat=await pixels(walkF,W,H,{},1);
  const row=y=>{const v=[]; for(let x=0;x<W;x++){const i=y*W+x;
   const m=matOf(mat[i*4]); if(m===0||m===10||m===14) v.push(lum(pic,i));} return v;};
  let worst=0;
  for(let y=Math.round(H*0.30);y<H-2;y++){
   const a=row(y), b=row(y+1);
   if(a.length<W*0.5||b.length<W*0.5) continue;
   worst=Math.max(worst,Math.abs(mean(a)-mean(b)));
  }
  return worst;},
 note:'ground and sky have to meet without an edge, or the field is a table'});

/* ===== THINGS THAT ARE SUPPOSED TO MOVE, MOVE =====
   Flakes are small and pale and the sky is pale, so measuring the snow against the
   sky divides the thing you are looking for by the one place it cannot be seen.
   Inside a held drawing the buildings do not move at all -- so on a wall, between two
   frames of one drawing, the only thing that can change is weather. */
const S=await pairs(streetF);
await check({name:'detail/snow-falls', unit:'% of wall pixels changed',
 measure:async()=>{
  const A=await pixels(S.held[0],W,H), B=await pixels(S.held[1],W,H);
  const mat=await pixels(S.held[0],W,H,{},1);
  let n=0,tot=0;
  for(let i=0;i<W*H;i++){ const m=matOf(mat[i*4]); if(m!==11&&m!==13) continue;
   tot++; if(Math.abs(lum(A,i)-lum(B,i))>6) n++; }
  if(tot<800) throw new Error('not enough wall in frame');
  return 100*n/tot;},
 pass:v=>v>1.5,
 calibrate:async()=>{   // snow frozen on the glass: the same two frames, no weather
  const A=await pixels(S.held[0],W,H,{snow:0}), B=await pixels(S.held[1],W,H,{snow:0});
  const mat=await pixels(S.held[0],W,H,{},1);
  let n=0,tot=0;
  for(let i=0;i<W*H;i++){ const m=matOf(mat[i*4]); if(m!==11&&m!==13) continue;
   tot++; if(Math.abs(lum(A,i)-lum(B,i))>6) n++; }
  return 100*n/tot;},
 note:'a held drawing in a locked-off shot: a wall that changes changed because of weather'});

await check({name:'detail/cloak-moves', unit:'px the cloak centroid travels',
 measure:async()=>{
  const cen=async(f)=>{
   const m=await pixels(f,W,H,{},1);
   let sx=0,sy=0,n=0;
   for(let y=0;y<H;y++)for(let x=0;x<W;x++){ if(matOf(m[(y*W+x)*4])===6){sx+=x;sy+=y;n++;} }
   return n? [sx/n,sy/n,n] : null;};
  const wf=Math.round((STARTS[1]+0.4)*FPS);
  const a=await cen(wf), b=await cen(wf+6);
  if(!a||!b) return 0;
  return Math.hypot(a[0]-b[0],a[1]-b[1]);},
 pass:v=>v>0.8, calibrate:async()=>0,
 note:'a cloak whose centroid never moves is a board, and this project has shipped one before'});
