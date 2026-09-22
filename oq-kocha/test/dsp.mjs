/* Just enough signal processing to audit a soundtrack, with no dependency. */
export function fft(re,im){
 const n=re.length;
 for(let i=1,j=0;i<n;i++){
  let b=n>>1; for(;j&b;b>>=1) j^=b; j^=b;
  if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]];}
 }
 for(let len=2;len<=n;len<<=1){
  const ang=-2*Math.PI/len, wr=Math.cos(ang), wi=Math.sin(ang);
  for(let i=0;i<n;i+=len){
   let cr=1,ci=0;
   for(let k=0;k<len/2;k++){
    const ur=re[i+k], ui=im[i+k];
    const vr=re[i+k+len/2]*cr-im[i+k+len/2]*ci;
    const vi=re[i+k+len/2]*ci+im[i+k+len/2]*cr;
    re[i+k]=ur+vr; im[i+k]=ui+vi;
    re[i+k+len/2]=ur-vr; im[i+k+len/2]=ui-vi;
    const ncr=cr*wr-ci*wi; ci=cr*wi+ci*wr; cr=ncr;
   }
  }
 }
}
export const rms=v=>{let s=0;for(const x of v)s+=x*x;return Math.sqrt(s/v.length);};
export const peak=v=>{let m=0;for(const x of v){const a=Math.abs(x);if(a>m)m=a;}return m;};
export const dB=v=>20*Math.log10(Math.max(v,1e-12));

/* SPECTRAL FLATNESS: geometric mean over arithmetic mean of the power spectrum.
   1.0 is white noise. A "sound" that measures near 1 is a block of hiss, which is
   what an event built from a constant gain over a noise buffer always turns out to be. */
export function flatness(x,sr,N=1024){
 const w=new Float64Array(N); for(let i=0;i<N;i++) w[i]=0.5-0.5*Math.cos(2*Math.PI*i/N);
 const out=[];
 for(let o=0;o+N<x.length;o+=N/2){
  const re=new Float64Array(N), im=new Float64Array(N);
  for(let i=0;i<N;i++) re[i]=x[o+i]*w[i];
  fft(re,im);
  let lg=0,ar=0; const H=N/2;
  for(let k=1;k<H;k++){const p=re[k]*re[k]+im[k]*im[k]+1e-12; lg+=Math.log(p); ar+=p;}
  out.push(Math.exp(lg/(H-1))/(ar/(H-1)));
 }
 out.sort((a,b)=>a-b);
 return out[out.length>>1];
}
/* a brick-wall band, by zeroing bins -- exact enough for an audit */
export function bandpass(x,sr,lo,hi){
 let n=1; while(n<x.length) n<<=1;
 const re=new Float64Array(n), im=new Float64Array(n);
 re.set(x); fft(re,im);
 for(let k=0;k<n;k++){
  const f=(k<=n/2? k : k-n)*sr/n;
  const a=Math.abs(f);
  if(a<lo||a>hi){re[k]=0;im[k]=0;}
 }
 for(let k=0;k<n;k++) im[k]=-im[k];
 fft(re,im);
 const out=new Float64Array(x.length);
 for(let i=0;i<x.length;i++) out[i]=re[i]/n;
 return out;
}
/* ROUGHNESS: two tones inside one critical band do not make a chord, they beat.
   The beat shows up as modulation of the band's ENVELOPE around 70 Hz. */
export function roughness(x,sr,lo=120,hi=300){
 const b=bandpass(x,sr,lo,hi);
 const env=new Float64Array(b.length);
 for(let i=0;i<b.length;i++) env[i]=Math.abs(b[i]);
 let mean=0; for(const v of env) mean+=v; mean/=env.length;
 let n=1; while(n<env.length) n<<=1;
 const re=new Float64Array(n), im=new Float64Array(n);
 for(let i=0;i<env.length;i++) re[i]=env[i]-mean;
 fft(re,im);
 let mx=0, sum=0;
 for(const v of env) sum+=Math.abs(v);
 for(let k=0;k<n/2;k++){
  const f=k*sr/n;
  if(f>25&&f<110) mx=Math.max(mx, Math.hypot(re[k],im[k]));
 }
 return mx/(sum+1e-9);
}
