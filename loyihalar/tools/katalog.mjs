/* Katalog sahifasi KARTALARDAN yasaladi. Qo'lda yozilgan sahifa kartalardan ajralib
   ketadi -- va bir marta ajralib ketdi ham: chop etilgan sahifada "Oq Ko'cha va Not A
   Measurement bir xil qo'l bilan chizilgan" degan xulosa turardi, u esa bitta kadrdan
   o'lchashning artefakti edi. Generator bo'lsa, sahifa kartadan eskira olmaydi. */
import {writeFileSync,readFileSync} from 'fs';
import {load} from './karta.mjs';
import {chromium} from 'playwright';
import {existsSync,readdirSync} from 'fs';
const K=load();
const yol=(k,p)=>new URL(p,'file://'+k._f).pathname;
function chrome(){const r='/opt/pw-browsers';if(!existsSync(r))return undefined;
 for(const d of readdirSync(r).filter(x=>x.startsWith('chromium')&&!x.includes('headless')).sort().reverse()){
  const p=`${r}/${d}/chrome-linux/chrome`; if(existsSync(p))return p;} return undefined;}

const b=await chromium.launch({executablePath:chrome(),
 args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
const rasm={};
for(const k of K){
 const pg=await b.newPage({viewport:{width:1100,height:760}});
 await pg.goto('file://'+yol(k,k.kadr.fayl)); await pg.waitForTimeout(1400);
 const t=k.kadr.kadrlar[0];
 if(!k.kadr.hook) await pg.waitForTimeout(t*1000);
 rasm[k.nom]=await pg.evaluate(([t,hook])=>{
  if(hook) window[hook](t,720,518);
  const c=[...document.querySelectorAll('canvas')].sort((a,b)=>b.width*b.height-a.width*a.height)[0];
  const s=document.createElement('canvas'); s.width=520; s.height=Math.round(520*c.height/c.width);
  s.getContext('2d').drawImage(c,0,0,s.width,s.height);
  return s.toDataURL('image/jpeg',0.78);},[t,k.kadr.hook||null]);
 await pg.close();
}
await b.close();

const e=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const bar=(lab,val,mx,unit='%',thin=false)=>`<div class="bar"><div class="lab"><span>${lab}</span><b>${val}${unit}</b></div>
   <div class="track"><div class="fill${thin?' thin':''}" style="width:${Math.min(100,val/mx*100).toFixed(1)}%"></div></div></div>`;
const cards=K.map(k=>{
 const o=k.olchov, [lo,hi]=o.qiymat;
 const sw=o.palitra.map(p=>`<i style="width:${p.ulush}%;background:${p.hex}"></i>`).join('');
 const us=k.uslub.map(u=>`<li>${e(u.gap)} <span class="dalil">${e(u.dalil)}</span></li>`).join('');
 const mq=Object.entries(k.maqsadlar||{}).map(([kal,[op,lim,nima]])=>`${e(nima)}`).join(' · ');
 return `<article class="spec">
 <div class="plate"><img src="${rasm[k.nom]}" alt="${e(k.nom)}">
  <div><div class="eyebrow" style="margin-bottom:5px">o'lchangan palitra</div><div class="swatches">${sw}</div></div></div>
 <div class="body">
  <h2>${e(k.nom)}</h2>
  <div class="src">${e(k.sanoq.renderer)} · ${k.sanoq.satrlar} satr · ${k.sanoq.chizishJami} chizish buyrug'i</div>
  <div class="pair"><div class="eyebrow">uslub · qanday qurilgan — manbadan sanalgan</div><ul class="us">${us}</ul></div>
  <div class="pair"><div class="eyebrow">stil · muhit qanday ko'rinadi</div><p>${e(k.stil)}</p></div>
 </div>
 <div class="meas"><span class="eyebrow">o'lchangan</span>
  <div class="bar"><div class="lab"><span>qiymat oralig'i</span><b>${lo}–${hi}</b></div>
   <div class="range"><i style="left:${(lo/255*100).toFixed(1)}%;width:${((hi-lo)/255*100).toFixed(1)}%"></i></div></div>
  ${bar("to'yinganlik",o.toyinganlik,70,'%',o.toyinganlik<5)}
  ${bar("chizilganlik",o.chizilganlik,50,'%',o.chizilganlik<8)}
  ${bar("tekstura",o.tekstura,7,'',o.tekstura<2)}
  ${bar("siyoh",o.siyoh,22,'%',o.siyoh<1)}
 </div>
 <div class="needs"><b>maqsad</b><span>${mq||'—'}</span></div>
</article>`;}).join('\n');

/* tarqoqlik grafigi */
const P=K.map(k=>({nom:k.nom,x:k.olchov.chizilganlik,y:k.olchov.toyinganlik}));
const X=d=>56+d/50*484, Y=s=>340-s/72*316;
const g=[];
for(const t of [0,10,20,30,40,50]){g.push(`<line x1="${X(t).toFixed(1)}" y1="24" x2="${X(t).toFixed(1)}" y2="340" stroke="var(--rule)"/>`);
 g.push(`<text x="${X(t).toFixed(1)}" y="358" text-anchor="middle" class="ax">${t}%</text>`);}
for(const t of [0,20,40,60]){g.push(`<line x1="56" y1="${Y(t).toFixed(1)}" x2="540" y2="${Y(t).toFixed(1)}" stroke="var(--rule)"/>`);
 g.push(`<text x="48" y="${(Y(t)+4).toFixed(1)}" text-anchor="end" class="ax">${t}%</text>`);}
const anch={"Oq Ko'cha":['end',-13,-9],"Whiteout":['start',13,4],"Bir tomchi sayohati":['start',13,-6],
            "Yomg'irli derazadagi mushuk":['start',13,5],"Not A Measurement":['end',-13,-9]};
const dots=P.map(p=>{const [a,dx,dy]=anch[p.nom]||['start',12,4];
 return `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="5.5" fill="var(--accent)"/>`
 +`<text x="${(X(p.x)+dx).toFixed(1)}" y="${(Y(p.y)+dy).toFixed(1)}" text-anchor="${a}" class="pt">${e(p.nom)}</text>`;}).join('');
const wo=P.find(p=>p.nom==='Whiteout'), nm=P.find(p=>p.nom==='Not A Measurement');
const svg=`<svg viewBox="0 0 600 392" role="img" aria-label="Beshta loyiha: chizilganlik va to'yinganlik">
 <style>.ax{font-family:"JetBrains Mono",monospace;font-size:11px;fill:var(--muted)}
 .pt{font-family:"Bricolage Grotesque",sans-serif;font-size:13.5px;font-weight:700;fill:var(--ink)}
 .axt{font-family:"JetBrains Mono",monospace;font-size:10.5px;letter-spacing:.1em;fill:var(--muted)}</style>
 ${g.join('')}
 <line x1="${X(wo.x).toFixed(1)}" y1="${Y(wo.y).toFixed(1)}" x2="${X(nm.x).toFixed(1)}" y2="${Y(nm.y).toFixed(1)}"
  stroke="var(--warn)" stroke-width="1.5" stroke-dasharray="4 4"/>
 <text x="${((X(wo.x)+X(nm.x))/2).toFixed(1)}" y="${(Y(wo.y)-14).toFixed(1)}" text-anchor="middle" class="ax" fill="var(--warn)">ikkalasi ham Canvas 2D</text>
 <line x1="56" y1="340" x2="540" y2="340" stroke="var(--ink)" stroke-width="1.5"/>
 <line x1="56" y1="24" x2="56" y2="340" stroke="var(--ink)" stroke-width="1.5"/>
 ${dots}
 <text x="540" y="378" text-anchor="end" class="axt">CHIZILGANLIK →</text>
 <text x="20" y="24" class="axt" transform="rotate(-90 20 24)" text-anchor="end">TO'YINGANLIK →</text>
</svg>`;

const head=readFileSync(new URL('./katalog-head.html',import.meta.url).pathname,'utf8');
const sana=new Date().toISOString().slice(0,10);
writeFileSync(process.argv[2]||'/mnt/user-data/outputs/uslublar-katalogi.html', head+`<div class="wrap">
<span class="eyebrow">ABC Legacy · loyihalar arxitekturasi · ${sana}</span>
<h1>Uslublar katalogi</h1>
<p class="lede">Beshta loyiha, bitta ma'lumot bloki. Har blokning uch qismi bor va ularning huquqlari boshqa: <b>uslub</b> — qanday qurilgani, manbadan <em>sanalgan</em>; <b>stil</b> — muhit qanday ko'rinishi, yagona erkin maydon; <b>o'lchov</b> — kadrdan <em>o'lchangan</em>. Bu sahifa kartalardan generatsiya qilinadi, shuning uchun ulardan eskira olmaydi.</p>

<div class="axes">
 <div class="axis"><h3>Uslub <span class="k">sanalgan</span></h3><p>Har satr <span class="mono">sanoq</span> dagi bitta qiymatga bog'langan, va o'sha qiymat satr matnida turishi shart. Manba o'zgarsa — poza soni 4 dan 6 ga chiqsa — satr eskiradi va qurish yiqiladi.</p></div>
 <div class="axis"><h3>Stil <span class="k">yozilgan</span></h3><p>Muhit qanday ko'rinadi: dala, ko'cha, deraza, varaq. Yagona erkin maydon.</p></div>
 <div class="axis mut"><h3>Raqamlar <span class="k">nomsiz</span></h3><p>Belgi xarakteri o'lchanadi, nomlanmaydi. Nom o'ylab topiladi, raqam o'lchanadi.</p></div>
</div>

<div class="tuzatish">
 <b>Tuzatilgan xulosa.</b> Bu sahifaning oldingi versiyasida «Oq Ko'cha va Not A Measurement bir xil qo'l bilan chizilgan (27,9 va 28,4)» degan xulosa turardi. U <b>noto'g'ri</b> edi: o'lchov chetlarni faqat <em>birinchi</em> kadrdan olardi, va o'sha uchta kadrning o'zi bitta-bittalab o'lchanganda javob 5,6 foiz nuqtaga farq qilardi. Tuzatilgandan keyin: <b>26,8</b> va <b>45,9</b> — ular bir-biriga o'xshamaydi. Xulosa qaytarib olindi, va uni qaytargan tekshiruv <span class="mono">olchov/tartibdan-mustaqil</span> deb ataladi.
</div>

<hr class="rule">
<div class="cards">
${cards}
</div>

<hr class="rule">
<div class="chartbox">
 <h2>Uslub ko'rinishni oldindan ayta olmaydi</h2>
 <p><b>Whiteout</b> va <b>Not A Measurement</b> — ikkalasi ham Canvas 2D, ikkalasi ham rangsiz, ikkalasi ham oq qog'oz ustida. Chizilganligi <b>${wo.x}%</b> va <b>${nm.x}%</b>: beshtasining ikki chetida turibdi. Qanday qurilgani bir xil, qanday ko'ringani esa butunlay boshqa — shuning uchun uchinchi ustun kerak, va shuning uchun u nomsiz qoladi.</p>
 <div class="chartscroll">${svg}</div>
</div>

<hr class="rule">
<p class="note"><b>Da'vo va maqsad.</b> <span class="mono">davolar</span> — loyiha hozir nima ekani haqidagi va'da: Whiteout OQ (eng qorong'i piksel ham 193), Mushuk RANGLI (68,1%). Buzilsa — regressiya. <span class="mono">maqsadlar</span> — qayerga borishi: Whiteout qiymat oralig'i 90 ga chiqishi kerak, hozir 50. Bajarilmagan maqsad nosozlik emas, ish rejasi — va u yashirilmaydi, faqat qurishni yiqitmaydi.</p>

<footer>
 SANOQ — <span class="mono">tools/sanoq.mjs</span>: satrlar, chizish buyruqlari, jadval o'lchamlari, kesim davomiyliklari<br>
 O'LCHOV — <span class="mono">tools/olchov.mjs</span>: har loyihadan 3 kadr, 320px enga keltirilgan, RGB → luma (Rec.709)<br>
 PALITRA — median-cut, 6 rang; k-means emas, chunki u har safar boshqa javob berardi<br>
 CHIZILGANLIK — qattiq chet (Δluma &gt; 0,16) ulushi; har kadr alohida, keyin o'rtacha<br>
 TEKSTURA — 3×3 blurdan keyin qolgan o'rtacha energiya, 0–255 shkalada<br>
 TEKSHIRUV — <span class="mono">test/run.mjs</span>: 14 ta, har biri ataylab buzilgan holati bilan
</footer>
</div>`);
console.log('katalog yasaldi');
