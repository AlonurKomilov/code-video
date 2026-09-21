/* THE SHOT LIST. Every camera lives here and nowhere else, so the cut audit reads
   the authored subject scale instead of guessing it from pixels. `sz` is that scale:
   how large the subject is meant to be in this shot, on one consistent ruler. */
export const SHOTS=[
 {k:"ko'cha",  d:3.0, sc:1, two:0, ro:[-8.6,1.55,-1.25], ta:[4.60,1.05,-0.35], foc:2.30, far:62, sz:1.0,
  A:[0,0,0], aw:1},
 {k:'yurish', d:2.2, sc:0, two:0, ro:[0.76,0.80,-3.10], ta:[0.02,0.50,0.00], foc:2.25, far:7, sz:2.6,
  A:[0,0,0], aw:1},
 {k:'yuz',    d:1.5, sc:0, two:0, ro:[0.44,1.00,-0.33], ta:[0.02,0.925,0.00], foc:2.28, far:3, sz:12.0,
  A:[0,0,0], aw:1, head:1},
 {k:'ikkinchi',d:1.3,sc:1, two:1, ro:[-3.2,1.05,-2.05], ta:[1.90,0.72,0.15], foc:2.40, far:40, sz:1.6,
  A:[0,0,0], B:[3.05,0,0.18], aw:1, bw:1},
 {k:'ikkovi', d:1.4, sc:1, two:1, ro:[-1.45,0.90,-2.35], ta:[1.10,0.55,0.30], foc:2.00, far:26, sz:2.4,
  A:[0,0,0], B:[1.72,0,0.12], aw:0, bw:0},
 {k:'qarama', d:0.8, sc:1, two:1, ro:[0.52,0.95,-2.10], ta:[0.52,0.62,0.06], foc:1.85, far:9, sz:5.0,
  A:[0,0,0], B:[1.06,0,0.12], aw:0, bw:0},
 {k:"o'tish", d:1.6, sc:1, two:1, ro:[-0.55,0.78,-2.70], ta:[1.20,0.50,0.22], foc:2.20, far:22, sz:3.2,
  A:[0,0,0], B:[1.90,0,0.12], aw:1, bw:1, pass:1},
 {k:'yolg‘iz',d:2.8,sc:1,two:0, ro:[-6.2,1.30,-1.60], ta:[3.20,0.90,-0.20], foc:2.30, far:50, sz:1.2,
  A:[0,0,0], aw:1}
];
export const STARTS=(()=>{const o=[];let a=0;for(const s of SHOTS){o.push(a);a+=s.d;}return o;})();
export const TOTAL=STARTS[STARTS.length-1]+SHOTS[SHOTS.length-1].d;
