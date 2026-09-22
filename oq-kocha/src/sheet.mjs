/* THE EXPOSURE SHEET — one copy, imported by the page generator and by the tests.
   When the timing chart lives in two places it stops being a timing chart. */
export const HOLDS = [3,2,1,2,3,2,1,2];        // slots per drawing, at 12 drawings a second
export const SLOTS = HOLDS.reduce((a,b)=>a+b,0);
export const CYCLE = SLOTS/12;                 // seconds for one full cycle
export const TRAVEL = 0.68;                    // body-heights travelled per cycle
export const FPS = 24, TWOS = 2;

export const CUM = (()=>{const o=[];let a=0;
 for(const h of HOLDS){o.push(a); a+=h*(TRAVEL/SLOTS);} return o;})();

export function idxAt(ph){
 ph=((ph%1)+1)%1; let d=ph*SLOTS, i=0;
 while(d>=HOLDS[i]){d-=HOLDS[i]; i++; if(i>=HOLDS.length){i=0;break;}}
 return i;
}
/* Distance is a STEP function of the sheet: the world moves when the drawing moves
   and not between, which is the only arrangement that plants the foot. */
export function travel(p){const k=Math.floor(p); return k*TRAVEL+CUM[idxAt(p-k)];}

export function swapPose(P){return {hip:P.hip,lean:P.lean,arch:P.arch,sh:P.sh,hd:P.hd,hold:P.hold,
 nk:P.fk,na:P.fa,nf:P.ff,fk:P.nk,fa:P.na,ff:P.nf,neb:P.feb,nh:P.fh,feb:P.neb,fh:P.nh,cl:P.cl};}
export function walkFrom(PW){return PW.concat(PW.map(swapPose));}
