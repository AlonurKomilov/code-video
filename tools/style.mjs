/* ===== A STYLE IS A DOCUMENT =====
   The architecture already drew this line: pass one writes what was MEASURED about a
   surface and decides nothing about how it looks; pass two settles the look. So the
   style is pass two -- plus the lighting model, which had leaked into pass one and is
   a look decision wherever it sits. This turns those decisions into a file.

   Every entry becomes one uniform, named by its key with an `s` in front, typed by
   how many numbers it has. Nothing here knows what any of them mean; the shaders do.
   The palette is one array of 33 colours, eleven world materials of three tones each,
   indexed straight off the material id -- which is why the ids have to stay
   contiguous from 10 to 20. */
import {readFileSync,readdirSync} from 'fs';
export const TY={1:'float',2:'vec2',3:'vec3',4:'vec4'};
export const MAT0=10, MATN=11;

export function load(dir){
 const files=readdirSync(dir).filter(f=>f.endsWith('.json')).sort();
 const out=files.map(f=>JSON.parse(readFileSync(dir+'/'+f,'utf8')));
 const keys=Object.keys(out[0].p);
 for(const s of out){
  const mine=Object.keys(s.p);
  const miss=keys.filter(k=>!mine.includes(k)), extra=mine.filter(k=>!keys.includes(k));
  /* A STYLE THAT IS MISSING A DECISION IS NOT A STYLE, IT IS A PATCH. If one file can
     leave a parameter out, the shader falls back to whatever the last style set and
     the two stop being comparable -- which is exactly the thing this file exists to
     prevent. Every style answers every question. */
  if(miss.length||extra.length)
   throw new Error(`style ${s.name}: missing [${miss}] extra [${extra}]`);
  /* AND EVERY STYLE MAKES EVERY PROMISE. A style that declares no claim for something
     it changes is a style nothing can check. */
  const cl=Object.keys(out[0].claims||{}).filter(k=>k!=='note');
  const mycl=Object.keys(s.claims||{}).filter(k=>k!=='note');
  const cmiss=cl.filter(k=>!mycl.includes(k));
  if(cmiss.length) throw new Error(`style ${s.name}: claims missing [${cmiss}]`);
  for(let m=MAT0;m<MAT0+MATN;m++){
   const p=s.pal[String(m)];
   if(!p||p.length!==3) throw new Error(`style ${s.name}: material ${m} needs three tones`);
  }
 }
 return out;
}
export function decl(styles){
 const k=styles[0].p;
 return Object.keys(k).map(n=>`uniform ${TY[k[n].length]} s${n};`).join('\n')
      + `\nuniform vec3 sPal[${MATN*3}];\n`;
}
export function js(styles){
 const keys=Object.keys(styles[0].p);
 const rows=styles.map(s=>{
  const pal=[]; for(let m=MAT0;m<MAT0+MATN;m++) for(const c of s.pal[String(m)]) pal.push(...c);
  return ` ${JSON.stringify(s.name)}:{t:${JSON.stringify(s.title)},`
       + keys.map(n=>`${n}:${JSON.stringify(s.p[n])}`).join(',')
       + `,pal:${JSON.stringify(pal)}}`;
 }).join(',\n');
 const setters=keys.map(n=>{
  const d=styles[0].p[n].length;
  return d===1? `if(L.s${n})gl.uniform1f(L.s${n},S.${n}[0]);`
              : `if(L.s${n})gl.uniform${d}fv(L.s${n},S.${n});`;
 }).join('\n ');
 return `const STYLES={\n${rows}\n};
const STYLE_KEYS=${JSON.stringify(keys)};
function styleLocs(gl,p){const L={};for(const n of STYLE_KEYS)L['s'+n]=gl.getUniformLocation(p,'s'+n);
 L.sPal=gl.getUniformLocation(p,'sPal');return L;}
function styleApply(gl,L,S){
 ${setters}
 if(L.sPal)gl.uniform3fv(L.sPal,S.pal);
}`;
}
if(process.argv[1]&&process.argv[1].endsWith('style.mjs')){
 const {writeFileSync,mkdirSync}=await import('fs');
 const dir=process.argv[2]||'src/styles', out=process.argv[3]||'build';
 const st=load(dir);
 mkdirSync(out,{recursive:true});
 writeFileSync(out+'/style.glsl', decl(st));
 writeFileSync(out+'/style.js', js(st));
 console.log(`${st.length} styles, ${Object.keys(st[0].p).length} decisions each`
  +` + ${MATN*3} palette slots: ${st.map(s=>s.name).join(', ')}`);
}
