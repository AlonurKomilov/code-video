/* ===== THE BUILDER =====
   A character is a JSON document. This turns it into GLSL. Nothing about the
   hooded man is in this file and nothing about GLSL is in his -- which is the
   whole point: the next character is a new document, not a new shader. */
import {readFileSync, writeFileSync} from 'fs';

const JOINT = {hip:0, shoulder:1, head:2, neck:3,
 'knee.n':4,'ankle.n':5,'toe.n':6,'elbow.n':7,'hand.n':8,
 'knee.f':9,'ankle.f':10,'toe.f':11,'elbow.f':12,'hand.f':13,
 'cloak.mid':14,'cloak.hem':15};

const f = v => { const s=String(v); return /[.eE]/.test(s)?s:s+'.0'; };
const v3 = a => `vec3(${a.map(f).join(',')})`;
const J  = n => { if(!(n in JOINT)) throw new Error('unknown joint: '+n); return `J[${JOINT[n]}]`; };

function axis(c){                                   // one component of a point
 if(typeof c==='number') return f(c);
 const base = c.mix ? `mix(${pt(c.mix[0])}.${c.a},${pt(c.mix[1])}.${c.a},${f(c.mix[2])})`
                    : `${pt(c.j)}.${c.a}`;
 return c.add!==undefined ? `(${base}${c.add<0?'-':'+'}${f(Math.abs(c.add))})` : base;
}
function pt(n){
 if(typeof n==='string') return J(n);
 if(Array.isArray(n))    return v3(n);
 let b;
 if(n.axes)      b = `vec3(${n.axes.map(axis).join(',')})`;
 else if(n.mix)  b = `mix(${pt(n.mix[0])},${pt(n.mix[1])},${f(n.mix[2])})`;
 else if(n.p!==undefined) b = pt(n.p);
 else throw new Error('unreadable point: '+JSON.stringify(n));
 if(n.add) b = `(${b}+${v3(n.add)})`;
 return b;
}
function shape(s){
 if(s.cone)  return `sdRoundCone(p,${pt(s.cone[0])},${pt(s.cone[1])},${f(s.cone[2])},${f(s.cone[3])})`;
 if(s.ellip){
  /* p-A-B, not p-(A+B). They are the same number in algebra and not always the
     same float -- and a cel band is a hard step, so one last-bit difference does
     not stay small, it flips a whole pixel to the next tone. Emit the association
     the hand-written shader used, or the proof of equivalence fails on noise. */
  const c=s.ellip[0];
  const head=(c && typeof c==='object' && !Array.isArray(c) && c.add && (c.p!==undefined||c.mix))
   ? `p-${pt(c.p!==undefined?c.p:{mix:c.mix})}-${v3(c.add)}`
   : `p-${pt(c)}`;
  return `sdEllipsoid(${head},${v3(s.ellip[1])})`;
 }
 if(s.sheet) return `sdSheet(p,${pt(s.sheet[0])},${pt(s.sheet[1])},`
                   +`${f(s.sheet[2])},${f(s.sheet[3])},${f(s.sheet[4])},${f(s.sheet[5])})`;
 if(s.box)   return `sdBoxR(p-${pt(s.box[0])},${v3(s.box[1])},${f(s.box[2])})`;
 if(s.smin)  return s.smin.map(shape).reduce((a,b)=>`smin(${a},${b},${f(s.k)})`);
 if(s.min)   return s.min.map(shape).reduce((a,b)=>`min(${a},${b})`);
 if(s.sub)   return `max(${shape(s.sub[0])},-(${shape(s.sub[1])}))`;
 throw new Error('unreadable shape: '+JSON.stringify(s));
}
function matId(ch,name){
 const m=ch.materials[name]; if(!m) throw new Error('unknown material: '+name); return m.id;
}
export function buildMap(ch){
 const L=[];
 L.push(`/* ${ch.name} -- generated from characters/${ch.name}.json, do not hand-edit */`);
 L.push(`vec2 fig_${ch.name.replace(/[^a-z0-9]/gi,'_')}(vec3 p, vec3 J[16]){`);
 L.push(' float d,t;');
 const items=ch.body.of;
 L.push(` d=${shape(items[0])};` + (items[0].note?`   // ${items[0].note}`:''));
 for(const it of items.slice(1)){
  if(it.joinK===undefined) throw new Error('body part after the first needs joinK: '+(it.note||''));
  L.push(` d=smin(d,${shape(it)},${f(it.joinK)});` + (it.note?`   // ${it.note}`:''));
 }
 const off=ch.matOffset||0;
 L.push(` vec2 r=vec2(d,${f(matId(ch,ch.body.mat)+off)});`);
 for(const o of ch.over){
  L.push(` t=${shape(o)}; if(t<r.x) r=vec2(t,${f(matId(ch,o.mat)+off)});` + (o.note?`   // ${o.note}`:''));
 }
 L.push(' return r;');
 L.push('}');
 return L.join('\n');
}
export function buildRamp(ch){
 const ms=Object.entries(ch.materials).map(([n,m])=>({n,...m})).sort((a,b)=>a.id-b.id);
 const L=[];
 ms.forEach((m,i)=>{
  const head = i===0 ? `  if(mat<${f(m.id+0.5)})` : (i===ms.length-1 ? '  else' : `  else if(mat<${f(m.id+0.5)})`);
  L.push(`${head}{ c0=${v3(m.ramp[0])}; c1=${v3(m.ramp[1])}; c2=${v3(m.ramp[2])}; }   // ${m.n}`);
 });
 return L.join('\n');
}
/* TWO FIGURES IN ONE FRAME. Each character compiles to its own function taking its
   own joint array, and mapFig unions them. The second is queried in a mirrored
   space so he faces the other way -- one sign, not a second character. Materials
   are offset so the two palettes do not collide in the one ramp the composite
   pass reads. */
const args=process.argv.slice(2);
if(args.length){
 const outPath=args[args.length-1];
 const chars=args.slice(0,-1).map((p,i)=>{
  const ch=JSON.parse(readFileSync(p,'utf8')); ch.matOffset=i*20; return ch;});
 let frag=readFileSync(new URL('../src/geo.frag',import.meta.url),'utf8');
 const fns=chars.map(buildMap).join('\n');
 const nm=(c)=>'fig_'+c.name.replace(/[^a-z0-9]/gi,'_');
 const disp=[
  'vec2 mapFig(vec3 p){',
  ' /* the bound first: in a street shot the man is a few percent of the frame and',
  '    every other ray was paying for forty primitives to find that out. */',
  ' vec3 pa=p-uPosA;',
  ' float ba=length(pa-FIG_C)-FIG_R;',
  ` bool fa=(uBound<0.5)||ba<=0.04; PRIMC+=fa?40:1;`,
  ` vec2 a = fa ? ${nm(chars[0])}(pa, JA) : vec2(ba,1.0);`,
  ' if(uTwo<0.5) return a;',
  ' vec3 q=p-uPosB; q.x=-q.x;              // mirrored: he faces the other way',
  ' float bb=length(q-FIG_C)-FIG_R;',
  ` bool fb=(uBound<0.5)||bb<=0.04; PRIMC+=fb?40:1;`,
  ` vec2 b = fb ? ${nm(chars[1]||chars[0])}(q, JB) : vec2(bb,21.0);`,
  ' return b.x<a.x? b : a;',
  '}'].join('\n');
 frag=frag.replace('//#CHARACTER_MAP',fns+'\n'+disp);
 writeFileSync(outPath,frag);
 /* 12 palette slots: 1-6 for the first character, 21-26 for the second */
 const ramp=[];
 for(let c=0;c<2;c++){
  const ch=chars[c]||chars[0];
  const ms=Object.values(ch.materials).sort((a,b)=>a.id-b.id);
  for(let i=1;i<=6;i++){const m=ms.find(x=>x.id===i);
   for(let k=0;k<3;k++) ramp.push(m?m.ramp[k]:[0,0,0]);}
 }
 writeFileSync(outPath.replace(/\.frag$/,'.ramp.json'),JSON.stringify(ramp));
 console.log(chars.map(c=>`${c.name}(+${c.matOffset})`).join(' + ')
  +` -> ${frag.length} bytes, ${ramp.length} ramp entries`);
}
