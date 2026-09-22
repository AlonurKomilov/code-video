/* ===== THE HARNESS =====
   Every check carries the case that proves it works. A threshold that has never
   been shown to fail on a known-bad input is not a measurement, it is a number --
   this session produced four of those before it stopped producing them, and each
   one passed happily while the thing it watched was broken. So `calibrate` is part
   of the check, not an extra: if the deliberately broken input also passes, the
   check itself is reported as broken. */
import {appendFileSync} from 'fs';
import {basename} from 'path';
/* Loyihaning nomi uni chaqirgan papkadan olinadi: har loyihaning test/lib.mjs i
   shu faylni qayta eksport qiladi, va nom o'sha nusxaning joyidan chiqadi. */
export const nomla=url=>basename(new URL('../',url).pathname.replace(/\/$/,''));
let NOM='audit';
export const nom=n=>{ NOM=n; };
const R = [];
export const results = R;

export async function check({name, unit='', measure, pass, calibrate, note}){
 let value, cal, err=null, calErr=null;
 try{ value = await measure(); }catch(e){ err = e; }
 if(err){ R.push({name,status:'ERROR',err:String(err.message||err),note}); return; }
 const ok = pass(value);
 let sep = null;
 if(calibrate){
  /* A swallowed error is the thing this project stands against: if the
     calibration throws, the check is UNPROVEN and nobody is told why. Now it is. */
  try{ cal = await calibrate(); sep = !pass(cal); }
  catch(e){ cal = null; sep = false; calErr = String(e.message||e); }
 }
 R.push({name,unit,value,ok,cal,sep,note,calErr,
  status: !ok ? 'FAIL' : (calibrate ? (sep?'PASS':'UNPROVEN') : 'UNCALIBRATED')});
}
const f=(v)=> typeof v==='number' ? (Math.abs(v)>=1000||(v!==0&&Math.abs(v)<0.001)? v.toExponential(2): v.toFixed(3)) : String(v);
/* ===== YIQILISH KO'RINADIGAN BO'LSIN =====
   GitHub log MATNINI faqat tizimga kirgan odam ko'radi: ochiq repo'da ham run
   sahifasi "Sign in to view logs" deydi. Ya'ni CI da qaysi tekshiruv yiqilgani
   logda qolib ketadi, va tashqaridan qarab turgan odam taxmin qilishga majbur.

   Natija shu sababli IKKI joyga yoziladi, va ular bir xil emas:

     xulosa() -> job summary. Chiroyli jadval, lekin TIZIMGA KIRISH KERAK.
        Avval bu yerga "ochiq sahifada ko'rinadi" deb yozgan edim -- ishlatib
        ko'rilganda ko'rinmadi: #7 va #8 yugurishlarida summary yozilgan, lekin
        ochiq run sahifasida yo'q edi. Da'vo tekshirilmagan edi, shuning uchun
        noto'g'ri chiqdi.
     belgi() -> annotatsiya. Chiroyli emas, lekin OCHIQ ko'rinadi: o'sha
        sahifaning o'zi "2 warnings, 2 notices" deb Node 20 ogohlantirishini
        kirmasdan ko'rsatib turibdi. Yiqilgan tekshiruv nomi va sababi endi
        o'sha yo'ldan chiqadi. */
const qoch=s=>String(s).replace(/%/g,'%25').replace(/\r/g,'%0D').replace(/\n/g,'%0A').replace(/:/g,'%3A').replace(/,/g,'%2C');
function belgi(nom,bad){
 if(!process.env.GITHUB_ACTIONS) return;
 for(const r of bad.slice(0,10)){
  const sabab = r.err ? String(r.err).split('\n')[0]
              : r.calErr ? "kalibratsiya o'zi yiqildi: "+String(r.calErr).split('\n')[0]
              : r.status==='UNPROVEN' ? "buzilgan holat ham o'tdi -- bu tekshiruv o'zi qaraydigan nosozlikni ko'rmaydi"
              : `o'lchangan ${f(r.value)}, buzilgan holat ${r.cal==null?'—':f(r.cal)}${r.note?' ('+r.note+')':''}`;
  console.log(`::error title=${qoch(nom+' / '+r.name)}::${qoch(sabab)}`);
 }
 if(bad.length>10) console.log(`::error title=${qoch(nom)}::${qoch(`yana ${bad.length-10} ta muammo`)}`);
 if(!bad.length) console.log(`::notice title=${qoch(nom)}::${qoch(`${R.length} tekshiruv, 0 muammo -- har biri o'zining buzilgan holatidan ajratdi`)}`);
}
function xulosa(nom,satrlar,bad){
 const fayl=process.env.GITHUB_STEP_SUMMARY; if(!fayl) return;
 const L=[`## ${nom} — ${R.length} checks, ${bad.length} problem(s)`,''];
 if(bad.length){
  L.push('| check | status | measured | known-bad | nega |','|---|---|---|---|---|');
  for(const r of bad){
   const sabab = r.err ? String(r.err).split('\n')[0]
               : r.calErr ? 'kalibratsiya o\'zi yiqildi: '+String(r.calErr).split('\n')[0]
               : r.status==='UNPROVEN' ? 'buzilgan holat ham o\'tdi — bu tekshiruv o\'zi qaraydigan nosozlikni ko\'rmaydi'
               : (r.note||'');
   L.push(`| \`${r.name}\` | **${r.status}** | ${r.value===undefined?'':f(r.value)} | ${r.cal==null?'—':f(r.cal)} | ${String(sabab).replace(/\|/g,'\\|').slice(0,200)} |`);
  }
  L.push('');
 } else L.push('Hammasi o\'tdi, va har biri o\'zining buzilgan holatidan ajratdi.','');
 L.push('<details><summary>to\'liq jadval</summary>','','```',...satrlar,'```','</details>','');
 try{ appendFileSync(fayl, L.join('\n')+'\n'); }catch(e){ console.log('  (job summary yozilmadi: '+e.message+')'); }
}
export function report(){
 const S=[];                            // ekranga ham, job summary ga ham bir xil satrlar
 const say=t=>{ console.log(t); S.push(t.replace(/^\n/,'')); };
 const w = Math.max(...R.map(r=>r.name.length), 18);
 say('\n  ' + 'CHECK'.padEnd(w) + '  RESULT        MEASURED        KNOWN-BAD');
 say('  ' + '-'.repeat(w+46));
 for(const r of R){
  const kbad = r.cal==null ? '—' : f(r.cal);
  say('  ' + r.name.padEnd(w) + '  ' + r.status.padEnd(12)
    + ' ' + (r.value===undefined?'':f(r.value)).padStart(12)
    + ' ' + kbad.padStart(15) + (r.unit?' '+r.unit:''));
  if(r.status==='ERROR') say('      '+String(r.err).split('\n')[0].slice(0,120));
  if(r.status==='UNPROVEN') say(r.calErr
   ? '      the calibration itself threw, so nothing was proved: '+r.calErr
   : '      the broken case passed too — this check cannot see the failure it watches');
  if(r.note) say('      '+r.note);
 }
 const bad = R.filter(r=>r.status==='FAIL'||r.status==='ERROR'||r.status==='UNPROVEN');
 say('\n  ' + R.length + ' checks, ' + bad.length + ' problem(s)\n');
 xulosa(NOM, S, bad);
 belgi(NOM, bad);
 return bad.length===0;
}
