/* ===== THE HARNESS =====
   Every check carries the case that proves it works. A threshold that has never
   been shown to fail on a known-bad input is not a measurement, it is a number --
   this session produced four of those before it stopped producing them, and each
   one passed happily while the thing it watched was broken. So `calibrate` is part
   of the check, not an extra: if the deliberately broken input also passes, the
   check itself is reported as broken. */
import {appendFileSync} from 'fs';
import {basename} from 'path';
/* Loyihaning nomi papkadan olinadi, chaqiruvchidan emas: ikkita run.mjs bir xil
   harness'ni ishlatadi, va nomni qo'lda uzatish -- yana bir eskiradigan joy. */
const NOM=basename(new URL('../',import.meta.url).pathname.replace(/\/$/,''));
const R = [];
export const results = R;

export async function check({name, unit='', measure, pass, calibrate, note}){
 let value, cal, err=null, calErr=null;
 try{ value = await measure(); }catch(e){ err = e; }
 if(err){ R.push({name,status:'ERROR',err:String(err.message||err),note}); return; }
 const ok = pass(value);
 let sep = null;
 if(calibrate){
  /* Yutilgan xato -- bu loyiha aynan qarshi turadigan narsa: kalibratsiya yiqilsa,
     tekshiruv UNPROVEN bo'ladi va NEGA ekani hech kimga aytilmaydi. Endi aytadi. */
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
   logda qolib ketadi, va tashqaridan qarab turgan odam -- yoki keyingi safar
   men -- taxmin qilishga majbur bo'ladi. Job summary esa run sahifasining
   o'zida, hech kimga kirmasdan ko'rinadi. Shuning uchun natija shu yerga ham
   yoziladi: yiqilgan tekshiruvlar oldinda, jadval bo'lib. */
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
 return bad.length===0;
}
