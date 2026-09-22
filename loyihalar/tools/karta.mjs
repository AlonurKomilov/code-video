/* ===== KARTA — har bir loyiha bir xil ma'lumot blokini olib yuradi =====
   Uchta qism, va ularning huquqlari boshqa:
     sanoq  — manbadan sanaladi, qo'l tegmaydi
     uslub  — odam yozadi, LEKIN har satr sanoqdagi bitta qiymatga bog'lanishi shart
     stil   — odam yozadi, muhit qanday ko'rinishi (yagona erkin maydon)
     olchov — kadrdan o'lchanadi, qo'l tegmaydi

   `uslub` dagi har satr `dalil` maydoni bilan sanoqdagi qiymatga ko'rsatadi, va
   tekshiruv o'sha qiymat satr matnida turganini talab qiladi. Manba o'zgarsa --
   masalan poza soni 4 dan 6 ga chiqsa -- sanoq o'zgaradi, satr eskiradi va tekshiruv
   yiqiladi. Shuning uchun karta jimgina yolg'on bo'lib qololmaydi. */
import {readFileSync,writeFileSync,readdirSync,existsSync} from 'fs';
import {execFileSync} from 'child_process';
import {count} from './sanoq.mjs';
import {measure} from './olchov.mjs';
export const DIR=new URL('../kartalar/',import.meta.url).pathname;
export const MAYDONLAR=['nom','manba','kadr','uslub','stil','davolar','maqsadlar'];

export const load=()=>readdirSync(DIR).filter(f=>f.endsWith('.json')).sort()
 .map(f=>({...JSON.parse(readFileSync(DIR+f,'utf8')), _f:DIR+f}));

/* ===== QURILADIGAN SAHIFA =====
   Ba'zi kartaning kadri manbada turmaydi -- u QURILADI. Oq Ko'chaning sahifasi
   oq-kocha/build/ ichida, va build/ .gitignore da; ya'ni toza checkout'da o'sha
   fayl yo'q. Shuning uchun o'lchov CI da hech qachon ishlay olmasdi, va xato
   "fayl yo'q" deb emas, brauzer ichidagi tushunarsiz xato bo'lib chiqardi.

   Endi karta kadrini QANDAY qurishni ham aytadi, va o'lchashdan oldin shu buyruq
   ishlaydi. Har safar quriladi, mavjud bo'lsa ham: eskirgan qurilma -- shu
   sessiyada ikki marta tutilgan xato (src/geo.frag o'zgargan, lekin o'lchov eski
   sahifani o'lchagan), va uni tekshiruv bilan emas, har safar qurish bilan
   yo'q qilish ishonchliroq. */
export function tayyorla(K=load()){
 const qilingan=[];
 for(const k of K){
  const q=k.kadr?.qurish; if(!q) continue;
  const papka=new URL(q.papka+'/','file://'+k._f).pathname;
  const [cmd,...args]=q.buyruq.split(/\s+/);
  execFileSync(cmd,args,{cwd:papka,stdio:['ignore','ignore','inherit']});
  qilingan.push(k.nom);
 }
 return qilingan;
}
/* Qaysi kartalarning kadri hozir yo'q -- tekshiruv shu ro'yxatni o'lchaydi */
export const yoq=(K=load())=>K.filter(k=>
 !existsSync(new URL(k.kadr.fayl,'file://'+k._f).pathname));

const dig=(o,p)=>p.split('.').reduce((a,k)=>a==null?a:a[k],o);
const nums=t=>[...String(t).matchAll(/\d+(?:[.,]\d+)?/g)].map(m=>+m[0].replace(',','.'));

/* Bitta dalil satri tasdiqlanadimi. Raqam bo'lsa matnda turishi shart; matn bo'lsa
   matn ichida bo'lishi; ro'yxat bo'lsa a'zolaridan biri. */
export function tasdiq(gap,val){
 if(val==null) return {ok:false, sabab:'dalil topilmadi'};
 if(typeof val==='number')
  return {ok:nums(gap).includes(val), sabab:`sanoqda ${val}, satrda ${JSON.stringify(nums(gap))}`};
 if(typeof val==='string')
  return {ok:gap.toLowerCase().includes(val.toLowerCase()), sabab:`sanoqda "${val}"`};
 if(Array.isArray(val)){
  const hit=val.some(v=>typeof v==='number'? nums(gap).includes(v)
                       : gap.toLowerCase().includes(String(v).toLowerCase()));
  return {ok:hit || nums(gap).includes(val.length), sabab:`ro'yxat: ${JSON.stringify(val)}`};
 }
 return {ok:false, sabab:'dalil turi qo\'llanmaydi'};
}
/* Karta manbasi bilan hali ham rozimi */
export function verify(k){
 const s=count(k.manba.map(p=>new URL(p,'file://'+k._f).pathname));
 const yomon=[];
 for(const u of k.uslub){
  const t=tasdiq(u.gap, dig(s,u.dalil));
  if(!t.ok) yomon.push(`${k.nom}: "${u.gap.slice(0,44)}…" ↮ ${u.dalil} (${t.sabab})`);
 }
 return {sanoq:s, yomon};
}
export async function refresh(k,{olchov=true}={}){
 const {sanoq}=verify(k);
 const y={...k}; delete y._f;
 y.sanoq=sanoq;
 if(olchov) y.olchov=await measure({...k.kadr, fayl:new URL(k.kadr.fayl,'file://'+k._f).pathname});
 else if(k.olchov) y.olchov=k.olchov;
 writeFileSync(k._f, JSON.stringify(y,null,1)+'\n');
 return y;
}
if(process.argv[1]?.endsWith('karta.mjs')){
 const only=process.argv[3], noM=process.argv.includes('--tez');
 /* Qurilib turadigan sahifalar avval qurilsin, keyin sanoq bosilsin */
 tayyorla().forEach(n=>console.log('qurildi:',n));
 for(const k of load()){
  if(only&&!noM&&k.nom!==only&&only!=='--tez') continue;
  const {yomon}=verify(k);
  if(process.argv[2]==='refresh'){ await refresh(k,{olchov:!noM}); console.log('yangilandi:',k.nom); }
  else console.log(`${k.nom.padEnd(28)} ${yomon.length? '✗ '+yomon.length+' eskirgan satr':'✓'}`);
  yomon.forEach(y=>console.log('   ',y));
 }
}
