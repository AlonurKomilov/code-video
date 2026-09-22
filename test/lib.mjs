/* ===== THE HARNESS =====
   Every check carries the case that proves it works. A threshold that has never
   been shown to fail on a known-bad input is not a measurement, it is a number --
   this session produced four of those before it stopped producing them, and each
   one passed happily while the thing it watched was broken. So `calibrate` is part
   of the check, not an extra: if the deliberately broken input also passes, the
   check itself is reported as broken. */
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
export function report(){
 const w = Math.max(...R.map(r=>r.name.length), 18);
 console.log('\n  ' + 'CHECK'.padEnd(w) + '  RESULT        MEASURED        KNOWN-BAD');
 console.log('  ' + '-'.repeat(w+46));
 for(const r of R){
  const bad = r.cal==null ? '—' : f(r.cal);
  const line = '  ' + r.name.padEnd(w) + '  ' + r.status.padEnd(12)
    + ' ' + (r.value===undefined?'':f(r.value)).padStart(12)
    + ' ' + bad.padStart(15) + (r.unit?' '+r.unit:'');
  console.log(line);
  if(r.status==='ERROR') console.log('      '+String(r.err).split('\n')[0].slice(0,120));
  if(r.status==='UNPROVEN') console.log(r.calErr
   ? '      the calibration itself threw, so nothing was proved: '+r.calErr
   : '      the broken case passed too — this check cannot see the failure it watches');
  if(r.note) console.log('      '+r.note);
 }
 const bad = R.filter(r=>r.status==='FAIL'||r.status==='ERROR'||r.status==='UNPROVEN');
 console.log('\n  ' + R.length + ' checks, ' + bad.length + ' problem(s)\n');
 return bad.length===0;
}
