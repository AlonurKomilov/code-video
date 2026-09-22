/* ===== TEKSHIRUV =====
   Bu sahifa bitta narsani da'vo qiladi: ikkita zarra qatlami, o'lchangan
   tezliklarda. Shuning uchun tekshiruv ham bitta narsani qiladi -- tezlikni
   ekrandan QAYTA o'lchaydi va manba raqamiga solishtiradi. Har tekshiruv
   o'zining ataylab buzilgan holatini olib yuradi. */
import {check,report} from './lib.mjs';
import {kadrlar,tezlik,close} from './olchov.mjs';

/* MISOL GIF DAN O'LCHANGAN -- qo'lda yozilmagan, sanab olingan */
const MANBA={ yaqin:[5,-2], uzoq:[1,-1] };

const F=await kadrlar(6);
const bir=(past)=>tezlik(F.r,F.W,F.H,{past});

await check({name:'zarra/yaqin-qatlam', unit:'px/kadr (dx,dy)',
 measure:()=>{ const t=bir(true);  return `${t.dx},${t.dy}`; },
 pass:v=>v===MANBA.yaqin.join(','),
 /* BUZILGAN HOLAT: yaqin qatlam uzoqning tezligiga qo'yiladi. Agar tekshiruv
    shunda ham o'tsa, u ekrandan emas, o'z umididan o'qiyapti. */
 calibrate:async()=>{ const G=await kadrlar(6,{v1:MANBA.uzoq,v2:MANBA.uzoq,v3:MANBA.uzoq});
                      const t=tezlik(G.r,G.W,G.H,{past:true}); return `${t.dx},${t.dy}`; },
 note:`misol GIF da ${MANBA.yaqin.join(',')} -- katta, yumshoq zarra, moslik 0.79`});

await check({name:'zarra/uzoq-qatlam', unit:'px/kadr (dx,dy)',
 measure:()=>{ const t=bir(false); return `${t.dx},${t.dy}`; },
 pass:v=>v===MANBA.uzoq.join(','),
 calibrate:async()=>{ const G=await kadrlar(6,{v0:MANBA.yaqin});
                      const t=tezlik(G.r,G.W,G.H,{past:false}); return `${t.dx},${t.dy}`; },
 note:`misol GIF da ${MANBA.uzoq.join(',')} -- mayda, aniq zarra`});

/* PARALLAKS O'ZI. Ikki qatlam BOSHQA tezlikda yurmasa, bu shunchaki bitta
   qatlam: chuqurlik hissi ana shu farqdan chiqadi, o'rtacha tezlikdan emas. */
await check({name:'zarra/parallaks', unit:'yaqin/uzoq tezlik nisbati',
 measure:()=>{ const a=bir(true), b=bir(false);
               return +(Math.hypot(a.dx,a.dy)/Math.max(Math.hypot(b.dx,b.dy),1e-9)).toFixed(2); },
 pass:v=>v>2.0,
 calibrate:async()=>{ const G=await kadrlar(6,{v0:MANBA.yaqin});   // hamma bir xil tez
                      const a=tezlik(G.r,G.W,G.H,{past:true}), b=tezlik(G.r,G.W,G.H,{past:false});
                      return +(Math.hypot(a.dx,a.dy)/Math.max(Math.hypot(b.dx,b.dy),1e-9)).toFixed(2); },
 note:'misolda 5.39 / 1.41 = 3.8'});

/* DETERMINIZM: bir xil kadr ikki marta bir xil chiqmasa, yuqoridagi hech bir
   raqam o'lchov emas. */
await check({name:'zarra/determinizm', unit:'farq qilgan piksel',
 measure:async()=>{ const a=await kadrlar(1), b=await kadrlar(1);
                    let n=0; for(let i=0;i<a.r[0].length;i++) if(a.r[0][i]!==b.r[0][i]) n++;
                    return n; },
 pass:v=>v===0,
 calibrate:async()=>{ const a=await kadrlar(2);
                      let n=0; for(let i=0;i<a.r[0].length;i++) if(a.r[0][i]!==a.r[1][i]) n++;
                      return n; },
 note:'keyingi kadr boshqa bo\'lishi shart, aks holda solishtiruv hech nima ko\'rmaydi'});

const ok=report();
await close();
process.exit(ok?0:1);
