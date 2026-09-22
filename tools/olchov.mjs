/* ===== O'LCHOV — kadrdan o'lchanadi, ko'z bilan baholanmaydi =====
   Oltita raqam, va ularning hech biri renderer nima ekanini bilmaydi. Shuning uchun
   Canvas bilan chizilgan mushukni SDF bilan yechilgan ko'cha bilan solishtirish
   mumkin: ikkalasi ham oxirida pikselga aylanadi, va o'lchov shu yerda turadi.

   Piksellar sahifaning o'zidan olinadi -- canvas boshqa canvasga drawImage bilan
   tushadi, shuning uchun WebGL ham, 2D ham bir xil yo'ldan o'tadi. PNG yo'q, tashqi
   kutubxona yo'q: siqilgan rasmdan o'lchash o'lchovga siqilish xatosini qo'shadi. */
import {chromium} from 'playwright';
import {existsSync,readdirSync} from 'fs';

function chrome(){
 const root='/opt/pw-browsers';
 if(!existsSync(root)) return null;
 for(const d of readdirSync(root).filter(x=>x.startsWith('chromium')&&!x.includes('headless')).sort().reverse()){
  const p=`${root}/${d}/chrome-linux/chrome`; if(existsSync(p)) return p;
 }
 return null;
}
const W=320;   // har kadr shu kenglikka keltiriladi, aks holda katta kadr ko'proq "tekstura" beradi

/* MEDIAN-CUT: qutini eng keng o'qi bo'yicha ikkiga bo'lib boraveramiz. Deterministik --
   k-means boshlang'ich nuqtaga qarab har safar boshqa javob berardi, va har safar
   boshqa javob beradigan o'lchov o'lchov emas. */
function medianCut(px,k){
 let boxes=[[...Array(px.length/3).keys()]];
 while(boxes.length<k){
  let bi=0,bw=-1,ax=0;
  boxes.forEach((b,i)=>{
   if(b.length<2) return;
   for(let c=0;c<3;c++){
    let lo=255,hi=0;
    for(const p of b){ const v=px[p*3+c]; if(v<lo)lo=v; if(v>hi)hi=v; }
    if(hi-lo>bw){ bw=hi-lo; bi=i; ax=c; }
   }
  });
  if(bw<=0) break;
  const b=boxes[bi].slice().sort((x,y)=>px[x*3+ax]-px[y*3+ax]);
  boxes.splice(bi,1,b.slice(0,b.length>>1),b.slice(b.length>>1));
 }
 return boxes.filter(b=>b.length).map(b=>{
  const m=[0,0,0]; for(const p of b) for(let c=0;c<3;c++) m[c]+=px[p*3+c];
  const rgb=m.map(v=>Math.round(v/b.length));
  return {hex:'#'+rgb.map(v=>v.toString(16).padStart(2,'0')).join(''),
          ulush:+(100*b.length/(px.length/3)).toFixed(1)};
 }).sort((a,b)=>b.ulush-a.ulush);
}
const LUMA=(r,g,b)=>(0.2126*r+0.7152*g+0.0722*b)/255;

export function metrics(frames){          // frames: [{w,h,data:Uint8ClampedArray}]
 const all=[];
 for(const f of frames) for(let i=0;i<f.w*f.h;i++) all.push(f.data[i*4],f.data[i*4+1],f.data[i*4+2]);
 const px=Float64Array.from(all);
 const n=px.length/3;
 const lum=new Float64Array(n), sat=new Float64Array(n);
 for(let i=0;i<n;i++){
  const r=px[i*3],g=px[i*3+1],b=px[i*3+2];
  lum[i]=LUMA(r,g,b);
  const mx=Math.max(r,g,b), mn=Math.min(r,g,b);
  sat[i]=mx>0? (mx-mn)/mx : 0;
 }
 const srt=Float64Array.from(lum).sort();
 const q=p=>srt[Math.min(n-1,Math.floor(n*p))];
 /* Chetlar va tekstura FAZOVIY o'lchovlar, shuning uchun kadrlarni ustma-ust qo'yib
    o'lchab bo'lmaydi -- kadr chegarasi soxta chet bo'lib qo'shiladi. Lekin birinchi
    variant faqat BIRINCHI kadrni o'lchagan edi, va u holda raqam qaysi kadr birinchi
    tushganiga bog'liq bo'lib qoladi: Not A Measurement bitta kadrda 28,4 va boshqa
    kadrda 46,4 chiqdi. Qaysi kadr olinganiga qarab o'n olti barobar o'zgaradigan
    narsa o'lchov emas. Har kadr alohida o'lchanadi, keyin o'rtacha olinadi. */
 let hard=0,soft=0,tot=0,tex=0,texN=0;
 for(const f of frames){
  const w=f.w,h=f.h, L=new Float64Array(w*h);
  for(let i=0;i<w*h;i++) L[i]=LUMA(f.data[i*4],f.data[i*4+1],f.data[i*4+2]);
  for(let y=0;y<h-1;y++)for(let x=0;x<w-1;x++){
   const i=y*w+x, e=Math.max(Math.abs(L[i]-L[i+1]),Math.abs(L[i]-L[i+w]));
   tot++; if(e>0.16) hard++; else if(e>0.03) soft++;
  }
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
   let s=0; for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++) s+=L[(y+dy)*w+x+dx];
   tex+=Math.abs(L[y*w+x]-s/9); texN++;
  }
 }
 let ink=0; for(let i=0;i<n;i++) if(lum[i]<0.15) ink++;
 const hp=100*hard/tot, sp=100*soft/tot;
 return {
  palitra: medianCut(px,6),
  qiymat: [Math.round(q(0.02)*255), Math.round(q(0.98)*255)],
  toyinganlik:+(100*sat.reduce((a,b)=>a+b,0)/n).toFixed(1),
  qattiqChet:+hp.toFixed(2), yumshoqChet:+sp.toFixed(2),
  chizilganlik:+(100*hp/(hp+sp)).toFixed(1),
  tekstura:+(255*tex/texN).toFixed(2),
  siyoh:+(100*ink/n).toFixed(1)
 };
}

export async function grab(spec){          // spec: {fayl, kadrlar:[...], hook?}
 const b=await chromium.launch({executablePath:chrome()||undefined,
  args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
 const pg=await b.newPage({viewport:{width:1100,height:760}});
 await pg.goto('file://'+spec.fayl);
 await pg.waitForTimeout(1400);
 const out=[]; let prev=0;
 for(const k of spec.kadrlar){
  if(!spec.hook){ await pg.waitForTimeout(Math.max(0,(k-prev)*1000)); prev=k; }
  out.push(await pg.evaluate(([k,hook,W,blur,olcham])=>{
   if(hook) window[hook](k,olcham[0],olcham[1]);
   const cs=[...document.querySelectorAll('canvas')].sort((a,b)=>b.width*b.height-a.width*a.height);
   const src=cs[0];
   const h=Math.max(1,Math.round(W*src.height/src.width));
   const c=document.createElement('canvas'); c.width=W; c.height=h;
   const g=c.getContext('2d'); g.imageSmoothingQuality='high';
   if(blur) g.filter='blur('+blur+'px)';     // ataylab buzilgan holat: tool buni sezishi shart
   g.drawImage(src,0,0,W,h);
   return {w:W,h,data:Array.from(g.getImageData(0,0,W,h).data)};
  },[k,spec.hook||null,W,spec.blur||0,spec.olcham||[720,518]]));
 }
 await b.close();
 return out.map(f=>({...f,data:Uint8ClampedArray.from(f.data)}));
}
export async function measure(spec){ return metrics(await grab(spec)); }
if(process.argv[1]?.endsWith('olchov.mjs')){
 const [fayl,...ks]=process.argv.slice(2);
 const hook=ks[0]==='--hook'? ks.splice(0,2)[1] : null;
 console.log(JSON.stringify(await measure({fayl,kadrlar:ks.map(Number),hook}),null,1));
}
