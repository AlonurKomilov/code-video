import {chromium} from 'playwright';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
 args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
const pg=await b.newPage({viewport:{width:820,height:1000}});
const errs=[];pg.on('pageerror',e=>errs.push(e.message));
pg.on('console',m=>{if(m.type()==='error'&&!/net::/.test(m.text()))errs.push(m.text());});
await pg.goto('file:///home/claude/work/qalam-repo/build/oq-kocha.html');
await pg.waitForTimeout(900);
if(errs.length){console.log('ERRORS:',errs);await b.close();process.exit(1);}
const tl=await pg.evaluate(()=>window.__timeline());
const by={};for(const e of tl)by[e.type]=(by[e.type]||0)+1;
console.log('timeline events:',JSON.stringify(by),' total',tl.length);
const steps=tl.filter(e=>e.type==='step').map(e=>+e.t.toFixed(4));
console.log('first 8 footfalls at (s):',steps.slice(0,8).join('  '));
const t0=Date.now();
const a=await pg.evaluate(()=>window.__renderAudio(14.6,44100));
console.log(`offline render: ${a.pcm.length} samples @ ${a.sr} Hz in ${Date.now()-t0} ms`);
const x=Float32Array.from(a.pcm);
let pk=0,rms=0; for(const v of x){const q=Math.abs(v); if(q>pk)pk=q; rms+=v*v;}
rms=Math.sqrt(rms/x.length);
console.log(`peak ${pk.toFixed(3)}  rms ${rms.toFixed(4)}  (${(20*Math.log10(rms)).toFixed(1)} dBFS)`);
console.log(pk>0.999?'  CLIPPING':'  no clipping');
const {writeFileSync}=await import('fs');
writeFileSync('/home/claude/work/forge/film.pcm', Buffer.from(x.buffer));
writeFileSync('/home/claude/work/forge/film.sr', String(a.sr));
console.log('errors:',errs.length?errs:'none');
await b.close();
