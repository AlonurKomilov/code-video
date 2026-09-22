/* ===== TEKSHIRUV =====
   Har tekshiruv o'zining ataylab buzilgan holatini olib yuradi. Agar buzilgan holat
   ham o'tib ketsa, tekshiruv UNPROVEN bo'ladi va qurish yiqiladi: o'tayotgan, lekin
   hech narsani ushlab turmaydigan tekshiruv -- eng yomon tekshiruv, chunki u
   ishonch beradi va hech narsa qaytarmaydi. */
import {check,report} from './lib.mjs';
import {load,verify,tasdiq,tayyorla,yoq,MAYDONLAR} from '../tools/karta.mjs';
import {grab,metrics} from '../tools/olchov.mjs';
import {rmSync} from 'fs';
const K=load();
const yol=(k,p)=>new URL(p,'file://'+k._f).pathname;
const t0=Date.now();

/* HAR KARTA HAR SAVOLGA JAVOB BERADI. Bitta maydoni yo'q karta -- bu karta emas,
   yamoq; va yamoqni boshqa loyiha bilan solishtirib bo'lmaydi. */
await check({name:'karta/hamma-maydon', unit:'eng kambag\'al kartada yetishmaydigan maydon',
 measure:()=>Math.max(...K.map(k=>MAYDONLAR.filter(m=>k[m]==null).length
                               + (k.sanoq?0:1) + (k.olchov?0:1))),
 pass:v=>v===0,
 calibrate:()=>{ const n={...K[0]}; delete n.stil;
                 return MAYDONLAR.filter(m=>n[m]==null).length; },
 note:`${K.length} karta, har biri ${MAYDONLAR.length} maydon + sanoq + o'lchov`});

/* KARTA MANBASI BILAN HALI HAM ROZIMI. Bu asosiy tekshiruv: uslub satrlari qo'lda
   yoziladi, sanoq esa manbadan olinadi, va satr sanoqqa bog'lanadi. Manba o'zgarsa
   -- poza soni 4 dan 6 ga chiqsa -- satr eskiradi va shu yerda yiqiladi. */
await check({name:'karta/sanoq-bilan-mos', unit:'eskirgan uslub satri',
 measure:()=>K.reduce((a,k)=>a+verify(k).yomon.length,0),
 pass:v=>v===0,
 calibrate:()=>{                       // bitta satrdagi raqam o'zgartirilgan karta
  const u=K[0].uslub[1];
  return tasdiq(u.gap.replace(/\d+/,'999'), K[0].sanoq.jadvallar.SHOTS).ok? 0 : 1; },
 note:'har uslub satri sanoqdagi bitta qiymatga bog\'langan va u qiymat satrda turishi shart'});

/* ===== QURISH ZANJIRI =====
   Kartaning kadri manbada turmasligi mumkin: Oq Ko'chaning sahifasi quriladi va
   build/ .gitignore da. Bu tekshiruv aynan CI da bo'lgan xatoni yozadi -- o'sha
   ish filmni qurmasdan uning qurilgan sahifasini o'lchamoqchi bo'lgan, ya'ni
   hech qachon o'ta olmasdi.

   Kalibratsiya qurishsiz holat: sahifa o'chiriladi va QURILMAYDI. Agar shunda ham
   "hammasi joyida" chiqsa, tekshiruv o'zi qarayotgan xatoni ko'rmayapti degani.
   Ikkala tarmoq ham oxirida sahifani qaytarib quradi, chunki keyingi tekshiruvlar
   o'sha fayldan kadr oladi. */
const QUR=K.filter(k=>k.kadr?.qurish);
await check({name:'kadr/qurish-zanjiri', unit:'qurishdan keyin yo\'q sahifa',
 measure:()=>{ QUR.forEach(k=>rmSync(yol(k,k.kadr.fayl),{force:true}));
               tayyorla(QUR);
               return yoq(QUR).length; },
 pass:v=>v===0,
 calibrate:()=>{ QUR.forEach(k=>rmSync(yol(k,k.kadr.fayl),{force:true}));
                 const n=yoq(QUR).length;
                 tayyorla(QUR);                       // keyingi tekshiruvlar uchun qaytariladi
                 return n; },
 note:`${QUR.length} karta o'z kadrini quradi: `+QUR.map(k=>`${k.nom} (${k.kadr.qurish.buyruq})`).join(', ')});

/* ===== O'LCHOV TOOLINING O'ZI HAM KALIBRLANADI =====
   Ikkala tekshiruv ham BITTA olishdan hisoblanadi. Avvalgi variant o'lchovni besh
   marta chaqirardi va har chaqiruv brauzerni qaytadan ochardi: yugurish o'n
   daqiqadan oshdi, chaqiruvlardan biri yiqildi, va kalibratsiya "—" bo'lib qoldi --
   ya'ni tekshiruv UNPROVEN chiqdi, lekin sababi aytilmadi. Endi harness kalibratsiya
   xatosini ham bosib chiqaradi: yutilgan xato bu loyiha qarshi turadigan narsa. */
const NM=K.find(k=>k.nom==="Oq Ko'cha");
const KADRLAR=await grab({...NM.kadr, fayl:yol(NM,NM.kadr.fayl), olcham:[420,302]});
const XIRA  =await grab({...NM.kadr, fayl:yol(NM,NM.kadr.fayl), olcham:[420,302], blur:3});

/* TARTIBGA BOG'LIQ BO'LMASLIK. Eski kod chetlarni faqat BIRINCHI kadrdan o'lchardi --
   ya'ni javob kadrlar qanday tartibda berilganiga bog'liq edi, va Not A Measurement
   bitta kadrda 28,4, boshqasida 45,9 chiqdi. Shu ikki xulosani buzdi: "Oq Ko'cha va
   Not A Measurement bir xil qo'l" degani o'sha artefakt edi.

   Tekshiruvning birinchi ikki varianti o'zi ham yaroqsiz edi. "Uch kadr o'rtachasi
   bitta kadrdan barqarorroq" deb yozilgani sahnaga bog'liq bo'lib chiqdi: Oq
   Ko'chaning kadrlari bir-biriga o'xshash (27,0 / 29,1 / 29,0), shuning uchun u yerda
   eski usul ham deyarli to'g'ri javob berardi va kalibratsiya hech narsani
   ko'rsatmadi. Vaqt bo'yicha kadr oladigan loyihada esa kalibratsiyaning o'zi
   beqaror edi -- 19,6 va 5,4.

   Tartib sinovi sahnadan mustaqil: bir xil kadrlar teskari tartibda bir xil javob
   berishi shart, va eski usul buni qila olmaydi. */
const tesk=[...KADRLAR].reverse();
await check({name:'olchov/tartibdan-mustaqil', unit:'chizilganlikdagi farq, foiz nuqta',
 measure:()=>+Math.abs(metrics(KADRLAR).chizilganlik-metrics(tesk).chizilganlik).toFixed(2),
 pass:v=>v===0,
 calibrate:()=>+Math.abs(metrics([KADRLAR[0]]).chizilganlik-metrics([tesk[0]]).chizilganlik).toFixed(2),
 note:'har kadr alohida o\'lchanib o\'rtacha olinadi, shuning uchun tartib ta\'sir qilmaydi'});

/* VA U BUZILGANNI SEZISHI KERAK. Xiralashtirilgan kadrda chet ham, tekstura ham
   yo'qoladi; sezmaydigan o'lchov nimani o'lchayotganini bilmaydi. */
await check({name:'olchov/buzilganni-sezadi', unit:'xiralashtirilganda tekstura necha barobar tushadi',
 measure:()=>+(metrics(KADRLAR).tekstura/Math.max(metrics(XIRA).tekstura,1e-6)).toFixed(2),
 pass:v=>v>2.5,
 calibrate:()=>1.0,                    // xiralashtirishsiz nisbat aynan bir
 note:'tool o\'zi ham kalibrlanadi, loyihalar kabi'});

/* DA'VO VA MAQSAD IKKI XIL NARSA, va ularni aralashtirish birinchi urinishda uchta
   soxta "yiqilish" berdi. DA'VO -- loyiha hozir nima ekani haqidagi va'da: Whiteout
   OQ, Mushuk RANGLI. U buzilsa, bu regressiya. MAQSAD -- loyiha qayerga borishi:
   Whiteout qiymat oralig'i 90 ga chiqishi kerak, hozir 50. Bajarilmagan maqsad
   nosozlik emas, ish rejasi -- va u yashirilmaydi, faqat yiqitmaydi. */
const olch=(o,kal)=>kal==='qiymat.oraliq'? o.qiymat[1]-o.qiymat[0]
                  : kal==='qiymat.past'? o.qiymat[0] : o[kal];
for(const k of K) for(const [kal,[op,lim,nima]] of Object.entries(k.davolar)){
 await check({name:`davo/${k.nom}/${kal}`, unit:nima,
  measure:()=>olch(k.olchov,kal),
  pass:v=>op==='>'? v>lim : v<lim,
  calibrate:()=>lim,                   // chegaraning o'zi o'tmasligi shart
  note:`${op} ${lim}`});
}
const ok=report();
console.log('  MAQSADLAR — bajarilmagani ish rejasi, nosozlik emas');
for(const k of K) for(const [kal,[op,lim,nima]] of Object.entries(k.maqsadlar||{})){
 const v=olch(k.olchov,kal), y=op==='>'? v>lim : v<lim;
 console.log(`   ${y?'yetdi ':'qoldi '} ${(k.nom+' / '+kal).padEnd(42)} ${String(v).padStart(7)} ${op} ${lim}   ${nima}`);
}
console.log();
console.log(`  ${((Date.now()-t0)/1000).toFixed(1)}s\n`);
process.exit(ok?0:1);
