/* ===== O'LCHOV — misol GIF ga qo'llangan usulning aynan o'zi =====
   Zarra qatlamlari fazoviy chastota bo'yicha ajratiladi (katta zarra = past
   chastota), keyin oldingi tasvir nomzod tezlikka suriladi va keyingisiga
   qanchalik mos tushgani o'lchanadi. Eng mos siljish -- o'sha qatlamning
   tezligi. Belgi chalkashmasin deb FFT emas, to'g'ridan-to'g'ri surish:
   GIF da aynan shu chalkashlik yo'nalishni teskari ko'rsatgan edi. */
import {chromium} from 'playwright';
import {existsSync,readdirSync} from 'fs';
function findChrome(){
 const root='/opt/pw-browsers'; if(!existsSync(root)) return null;
 for(const d of readdirSync(root).filter(x=>x.startsWith('chromium')&&!x.includes('headless')).sort().reverse()){
  const p=`${root}/${d}/chrome-linux/chrome`; if(existsSync(p)) return p;
 } return null;
}
export const PAGE='file://'+new URL('../zarra.html',import.meta.url).pathname;
let br=null,pg=null;
export async function open(){
 if(pg) return pg;
 const args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'];
 const exe=findChrome();
 br=await chromium.launch(exe?{args,executablePath:exe}:{args});
 pg=await br.newPage({viewport:{width:700,height:420}});
 const errs=[]; pg.on('pageerror',e=>errs.push(String(e.message)));
 await pg.goto(PAGE); await pg.waitForTimeout(300);
 if(errs.length) throw new Error('sahifa xatosi: '+errs.join(' | '));
 return pg;
}
export async function close(){ if(br) await br.close(); br=pg=null; }
process.on('exit',()=>{ try{ br&&br.close(); }catch(e){} });

/* HAR KADR ALOHIDA UZATILADI. Avvalgi variant hammasini bitta evaluate da
   qaytarardi -- besh kadr 820 ming son bo'lib, CDP serializatsiyasi o'sha yerda
   osilib qolardi va o'lchov besh daqiqaga ham yetmasdi. Bitta kadr 1 soniya. */
export async function kadrlar(n,opt=null){
 const p=await open();
 const r=[];
 const W=await p.evaluate(()=>document.querySelector('canvas').width);
 const H=await p.evaluate(()=>document.querySelector('canvas').height);
 for(let i=0;i<n;i++){
  r.push(await p.evaluate(([i,opt])=>{
   window.__resetOpt(); if(opt) window.__opt(opt);
   const c=document.querySelector('canvas'), g=c.getContext('2d');
   window.__frameTo(i);
   const d=g.getImageData(0,0,c.width,c.height).data;
   const a=new Array(c.width*c.height);
   for(let k=0;k<a.length;k++) a[k]=(d[k*4]+d[k*4+1]+d[k*4+2])/3;
   window.__resetOpt();
   return a;
  },[i,opt]));
 }
 return {W,H,r};
}

/* qutili xiralashtirish: ajratiladigan yagona narsa -- zarra o'lchami */
function blur(a,W,H,k){
 const t=new Float32Array(W*H), o=new Float32Array(W*H);
 for(let y=0;y<H;y++){ let s=0;
  for(let x=-k;x<=k;x++) s+=a[y*W+((x%W)+W)%W];
  for(let x=0;x<W;x++){ t[y*W+x]=s/(2*k+1);
   s+=a[y*W+((x+k+1)%W)]-a[y*W+((x-k)%W+W)%W]; } }
 for(let x=0;x<W;x++){ let s=0;
  for(let y=-k;y<=k;y++) s+=t[(((y%H)+H)%H)*W+x];
  for(let y=0;y<H;y++){ o[y*W+x]=s/(2*k+1);
   s+=t[((y+k+1)%H)*W+x]-t[(((y-k)%H+H)%H)*W+x]; } }
 return o;
}
const fon=(a)=>{ let m=0; for(const v of a) m+=v; m/=a.length;
                 const o=new Float32Array(a.length);
                 for(let i=0;i<a.length;i++) o[i]=Math.max(0,a[i]-m); return o; };

const KESH=new Map();
export function tezlik(F,W,H,{past}){
 /* KALIT BUTUN TASVIRDAN. Avval birinchi piksel olingandi, va u ikkala holatda
    ham bir xil fon edi: kalibratsiya boshqa tezlik bilan chaqirilsa ham kesh
    eski javobni qaytarardi, va uch tekshiruv UNPROVEN bo'lib chiqdi. Kalibratsiya
    aynan shuni ushlash uchun bor. */
 let h=past?1:0; for(const a of F){ for(let i=0;i<a.length;i+=97) h=(h*31+a[i])|0; }
 const kalit=past+':'+F.length+':'+h;
 if(KESH.has(kalit)) return KESH.get(kalit);
 // past=true -> katta zarra (xiralashtirilgan), false -> mayda (xira ayirilgan)
 const L=F.map(a=>{ const b=fon(a), s=blur(b,W,H,2);
                    if(past) return s;
                    /* DENORMAL SONLAR. b va s bir-biriga juda yaqin, ayirma 1e-40
                       kabi denormal chiqadi, va denormal arifmetika o'nlab barobar
                       sekin: yaqin qatlam korrelyatsiyasi 0,5 s da tugadi, uzoq
                       qatlamniki esa daqiqalarga cho'zildi. Butun farq shu edi. */
                    const o=new Float32Array(b.length);
                    for(let i=0;i<b.length;i++){ const d=b[i]-s[i]; o[i]=Math.abs(d)<1e-6?0:d; }
                    return o; });
 /* AYLANMA SURISHDA NORMA O'ZGARMAYDI, shuning uchun u siljish halqasidan
    tashqarida hisoblanadi: avvalgi variant uni har siljishda qayta sanab,
    ishni uch barobar qilgan va o'n daqiqaga ham sig'magan edi. */
 const N=L.map(a=>{ let s=0; for(let i=0;i<a.length;i++) s+=a[i]*a[i]; return Math.sqrt(s)+1e-9; });
 const bufer=new Float32Array(W*H);
 const sur=(a,dx,dy)=>{                       // aylanma surish, modulsiz ichki halqa
  for(let y=0;y<H;y++){ const ys=((y-dy)%H+H)%H, o=y*W, so=ys*W;
   const k=((-dx)%W+W)%W;
   for(let x=0;x<W-k;x++) bufer[o+x]=a[so+x+k];
   for(let x=W-k;x<W;x++) bufer[o+x]=a[so+x+k-W];
  } return bufer; };
 const mos=(dx,dy)=>{ let s=0;
  for(let i=1;i<L.length;i++){
   const a=sur(L[i-1],dx,dy), b=L[i]; let ab=0;
   for(let k=0;k<W*H;k++) ab+=a[k]*b[k];
   s+=ab/(N[i-1]*N[i]); }
  return s/(L.length-1); };
 let best=[-1,0,0];
 for(let dy=-4;dy<=4;dy++) for(let dx=-8;dx<=8;dx++){ const v=mos(dx,dy);
  if(v>best[0]) best=[v,dx,dy]; }
 const r={mos:best[0], dx:best[1], dy:best[2]};
 KESH.set(kalit,r); return r;
}
