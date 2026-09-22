/* ===== SANOQ — manbadan sanab olinadi, hech narsa taxmin qilinmaydi =====
   "Uslub" degani loyiha qanday qurilganligi. Buni his qilib yozib bo'lmaydi: u
   manbada turibdi va sanalishi kerak. Bu fayl bitta ishni qiladi — kodni o'qiydi va
   raqam qaytaradi. Nima ma'no anglatishini bilmaydi; kartaning ishi shu. */
import {readFileSync,statSync} from 'fs';

const DRAW=['beginPath','moveTo','lineTo','arc','arcTo','bezierCurveTo','quadraticCurveTo',
            'ellipse','rect','fillRect','strokeRect','fillText','strokeText','drawImage',
            'createLinearGradient','createRadialGradient','clip','putImageData'];

/* Bir jadvalning nechta elementi borligini qavslarni sanab topamiz: regexp ichma-ich
   qavsni sanay olmaydi, shuning uchun qo'lda yurib chiqiladi. */
function tableSize(s,name){
 /* Ichma-ich qavsni ham sanash kerak: SHOTS ichidagi har bir kadrning o'z snd:{...}
    obyekti bor, va faqat '{' larni sanagan birinchi variant sakkizta kadrni o'n
    oltita deb hisoblagan edi. Element -- bu [ ichida, { dan tashqarida turgan {. */
 const m=new RegExp('\\b'+name+'\\s*[:=]\\s*\\[').exec(s);
 if(m){
  let br=0,cu=0,i=m.index+m[0].length-1,objs=0,commas=0;
  for(;i<s.length;i++){
   const c=s[i];
   if(c==='[') br++;
   else if(c===']'){ br--; if(br===0) break; }
   else if(c==='{'){ if(br===1&&cu===0) objs++; cu++; }
   else if(c==='}') cu--;
   else if(c===',' && br===1 && cu===0) commas++;
  }
  if(objs||commas) return objs || commas+1;
 }
 /* SC=[] bo'lib, keyin SC.push(...) bilan to'ldiriladigan jadvallar ham bor */
 const pushes=(s.match(new RegExp('\\b'+name+'\\.push\\s*\\(','g'))||[]).length;
 return pushes || null;
}

export function count(paths){
 const src=paths.map(p=>readFileSync(p,'utf8'));
 const s=src.join('\n');
 const o={
  fayllar:paths.length,
  baytlar:paths.reduce((a,p)=>a+statSync(p).size,0),
  satrlar:src.reduce((a,t)=>a+t.split('\n').length,0),
  renderer: (/webgl2/.test(s)||/#version\s+300\s+es/.test(s)) ? 'webgl2'
          : (/getContext\(\s*['"]2d/.test(s)? 'canvas2d' : 'nomalum'),
  funksiyalar:(s.match(/\bfunction\s+[A-Za-z_$][\w$]*\s*\(/g)||[]).length,
  ovoz:/AudioContext/.test(s),
  hodisalar:[...new Set(s.match(/addEventListener\(\s*['"]([a-z]+)['"]/g)||[]
             .map(x=>x))].map(x=>/['"]([a-z]+)['"]/.exec(x)[1]).sort(),
  shriftlar:[...new Set((s.match(/family=([A-Za-z+0-9]+)/g)||[]).map(x=>x.slice(7).replace(/\+/g,' ')))],
 };
 const d={};
 for(const k of DRAW){
  const n=(s.match(new RegExp('[A-Za-z_$][\\w$]*\\.'+k+'\\s*\\(','g'))||[]).length;
  if(n) d[k]=n;
 }
 o.chizish=d;
 o.chizishJami=Object.values(d).reduce((a,b)=>a+b,0);
 const t={};
 for(const k of ['PW','POSES','WALK','SHOTS','CUTS','SC','SCENES','HOLDS','STARTS','RAMP'])
  { const n=tableSize(s,k); if(n) t[k]=n; }
 o.jadvallar=t;
 const dur=[...s.matchAll(/\b(?:dur|d)\s*:\s*([0-9]*\.?[0-9]+)/g)].map(m=>+m[1]);
 if(dur.length) o.davomiyliklar=dur;
 return o;
}
if(process.argv[1]?.endsWith('sanoq.mjs'))
 console.log(JSON.stringify(count(process.argv.slice(2)),null,1));
