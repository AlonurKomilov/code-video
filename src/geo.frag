
#version 300 es
precision highp float;
uniform vec2  iRes;
 /* two figures, two sets of joints, and where each of them stands */
uniform vec3  JA[16];
uniform vec3  JB[16];
uniform vec3  uPosA;
uniform vec3  uPosB;
uniform float uTwo;       // 1 when the second figure is in the frame
uniform vec3  uRo;        // the camera is the shot's business, not the shader's
uniform vec3  uTa;
uniform float uFoc;
uniform float uFar;
/* A conservative bound is still a valid distance, so a ray that is nowhere near the
   figure can be told "at least this far" for the cost of one length(). */
const vec3 FIG_C=vec3(0.0,0.52,0.0); const float FIG_R=0.68;
uniform float iTime;
uniform float iDist;   // how far he has walked, so the ground moves under him
uniform float uScene;  // 0 the empty field, 1 the street
uniform float uCell;   // how tightly the street is packed -- for the cost experiment
uniform float uNbr;
uniform float uProbe;   // 1: map() calls   2: primitive evaluations
uniform float uRimGate; // 1 a floor has no silhouette, 0 the old ungated rim
uniform float uBound;   // 1: use the cheap bounds  0: the known-bad, to measure them
int MAPC=0, PRIMC=0;
/* HOW WIDE IS ONE PIXEL, WHERE THIS RAY IS. A drift ridge every six centimetres is
   the texture of wind on snow when a pixel is a centimetre across, and moire when a
   pixel is half a metre across -- which is what a pixel IS at the bottom of a frame,
   where the ground is a metre away but seen edge-on. Set once per march step, read
   by the ground noise, which fades out whatever it can no longer resolve. */
float GFP=0.002;    // 1 evaluate the neighbouring cells, 0 do not -- the known-bad case
/* Joint indices: 0 hip 1 shoulder 2 head 3 neck
   near 4 knee 5 ankle 6 toe 7 elbow 8 hand
   far  9 knee 10 ankle 11 toe 12 elbow 13 hand
   14 cloak mid  15 cloak hem                                */

#define PI 3.14159265

/* ---------- distance primitives (iq) ---------- */
float sdRoundCone(vec3 p, vec3 a, vec3 b, float r1, float r2){
 vec3 ba=b-a; float l2=dot(ba,ba), rr=r1-r2, a2=l2-rr*rr, il2=1.0/l2;
 vec3 pa=p-a; float y=dot(pa,ba), z=y-l2;
 vec3 xv=pa*l2-ba*y; float x2=dot(xv,xv), y2=y*y*l2, z2=z*z*l2;
 float k=sign(rr)*rr*rr*x2;
 if(sign(z)*a2*z2>k) return sqrt(x2+z2)*il2-r2;
 if(sign(y)*a2*y2<k) return sqrt(x2+y2)*il2-r1;
 return (sqrt(x2*a2*il2)+y*rr)*il2-r1;
}
float sdEllipsoid(vec3 p, vec3 r){
 float k0=length(p/r), k1=length(p/(r*r));
 return k0*(k0-1.0)/k1;
}
float sdBoxR(vec3 p, vec3 b, float r){
 vec3 q=abs(p)-b; return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0)-r;
}
float sdSheet(vec3 p, vec3 a, vec3 b, float r1, float r2, float thin, float wide){
 vec3 s=vec3(thin,1.0,wide);
 return sdRoundCone(p/s, a/s, b/s, r1, r2)*min(thin,min(1.0,wide));
}
float smin(float a,float b,float k){
 float h=clamp(0.5+0.5*(b-a)/k,0.0,1.0); return mix(b,a,h)-k*h*(1.0-h);
}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vnoise(vec2 p){
 vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
 return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
            mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
}

/* ---------- the body ---------- */
/* MAT 1 coat  2 boot  3 skin/hood-lining  4 blade  10 snow */

//#CHARACTER_MAP

float h11(float n){return fract(sin(n*127.1)*43758.5453);}

/* ===== R5. A STREET FROM ONE BUILDING =====
   Nothing here is modelled twice. One box is written; the world folds space under it
   with mod, and the cell index is hashed for height, width and setback, so every
   building along the row is a different building. A hundred of them cost the same
   as one, and the file does not grow.

   The care needed: folding space breaks the distance bound at a cell wall, because
   the nearest surface may be in the NEXT cell. Evaluating the neighbours restores
   it -- skip that and rays tunnel straight through the walls. */
vec2 mapEnv(vec3 p){
 vec3 q=p-vec3(iDist,0.0,0.0);
 float d,m;
 /* ground: the road is flatter and darker than the snow either side of it.
    The drift noise is only worth computing NEAR the surface -- higher up, the plane
    height minus the noise's own amplitude is already a valid bound. This runs at
    every step of every ray, so texturing ground forty units below the ray was a
    large part of the cost of every wide shot. */
 /* A ROAD ONLY EXISTS WHERE THERE IS A STREET. This was ungated, so the empty snow
    field had a two-and-a-half metre strip of asphalt running across it, sixty-four
    levels darker than the snow, with a dead-straight edge -- and because the walk
    shot is side-on, that edge ran level across the frame and read as the horizon.
    It had been invisible for exactly as long as the rim term was erasing the ground
    to white: two bugs, each hiding the other, and fixing one exposed the other. */
 float road=uScene>0.5 ? smoothstep(1.55,1.15,abs(q.z-0.35)) : 0.0;
 float g;
 if(uBound>0.5 && p.y>0.34){ g=p.y-0.026; PRIMC+=1; }
 else{
  PRIMC+=5;
  vec2 w=vec2(q.x*0.40+q.z*0.92, q.z*0.40-q.x*0.92);
  /* a term whose period is smaller than the pixel cannot be drawn, only aliased */
  float f15=exp(-GFP*5.0*11.0), f44=exp(-GFP*16.0*11.0), f70=exp(-GFP*70.0*11.0);
  /* AMPLITUDE IS NOT THE SLOPE. 1.6cm of relief with a 6.7cm period is a 45-degree
     face every six centimetres -- a washboard, not a drift -- and under a quantiser
     that turns into hard contour arcs converging on the vanishing point, which is
     the corduroy this ground used to be made of. Wind-packed snow is long and low:
     the same relief, spread over three times the distance. */
  float rel = mix(vnoise(w*vec2(1.6,5.0))*0.017*f15+vnoise(w*vec2(5.0,16.0))*0.0045*f44,
                  vnoise(q.xz*vec2(2.4,6.0))*0.0035*f15, road)
            + vnoise(q.xz*70.0)*0.0016*f70;
  /* AND IT HAS TO MEET THE BOUND. The cheap bound above is a LOWER bound, which is
     all the primary marcher needs -- but at p.y=0.34 the field stepped down by up to
     47mm in no distance at all, and a soft shadow reads a step in the field as a
     surface passing close by. Every shadow ray on the field crosses that height at
     the same moment, so the whole near ground was stippled with a picture of the
     drift, taken at the gate. Fading the relief into the bound over the last 18cm
     costs nothing where the saving was -- a ray forty units up still skips it. */
  float fade = uBound>0.5 ? smoothstep(0.34,0.16,p.y) : 1.0;
  g = p.y - 0.026 + fade*(rel + 0.026);
 }
 d=g; m=mix(10.0,14.0,step(0.5,road));

 if(uScene>0.5){
  float CELL=uCell>0.01?uCell:3.05;
  for(int row=0;row<3;row++){
   /* a terrace either side of the street, and a third block behind the far one */
   float zc = row==0 ? -4.85 : (row==1 ? 2.60 : 9.90);
   float sc = row==2 ? 1.9 : 1.0;
   /* the row lives in a slab; the distance to the slab is a valid bound for every
      building in it, so a ray far from the row never opens the cell loop */
   float slab=max(abs(q.z-zc)-1.9*sc, q.y-7.1*sc);
   if(uBound>0.5 && slab>0.75){ if(slab<d){d=slab;m=-1.0;} PRIMC+=1; continue; }
   float id0=floor((q.x+float(row)*1.7)/CELL);
   int kk=uNbr>0.5?1:0;
   for(int k=-kk;k<=kk;k++){                      // the neighbours, or rays tunnel through
    float id=id0+float(k);
    float r1=h11(id*1.7+float(row)*31.0), r2=h11(id*4.3+float(row)*57.0), r3=h11(id*9.1+float(row)*11.0);
    PRIMC+=3;
   float ws=min(CELL/3.05,1.0);
   float h=(2.6+r1*4.4)*sc, wd=(1.05+r2*0.42)*sc*ws, dp=(1.25+r3*0.55)*sc;
    vec3 c=vec3(CELL*(id+0.5)-float(row)*1.7, 0.0, zc+(r3-0.5)*0.34*sc);
    float b=sdBoxR(q-c-vec3(0.0,h*0.5,0.0), vec3(wd,h*0.5,dp), 0.02);
    if(b<d){d=b;m=11.0;}
    /* a parapet, so the roofline is not a plain lid */
    float pa=sdBoxR(q-c-vec3(0.0,h+0.055*sc,0.0), vec3(wd*1.04,0.055*sc,dp*1.04), 0.015);
    if(pa<d){d=pa;m=13.0;}
   }
  }
  /* lamp posts, on their own smaller cell */
  const float LC=4.85;
  float lid0=floor((q.x-1.2)/LC);
  int lk=uNbr>0.5?1:0;
  for(int k=-lk;k<=lk;k++){
   float lid=lid0+float(k);
   vec3 c=vec3(1.2+LC*(lid+0.5), 0.0, 1.02);
   float post=sdRoundCone(q-c, vec3(0.0,0.0,0.0), vec3(0.0,2.30,0.0), 0.055, 0.032);
   float arm =sdRoundCone(q-c, vec3(0.0,2.26,0.0), vec3(0.0,2.34,-0.42), 0.030, 0.026);
   float lamp=sdEllipsoid(q-c-vec3(0.0,2.26,-0.46), vec3(0.11,0.13,0.11));
   PRIMC+=3;
  float l=min(post,min(arm,lamp));
   if(l<d){d=l;m= lamp<min(post,arm) ? 15.0 : 13.0;}
  }
 }
 return vec2(d,m);
}

vec2 map(vec3 p){
 MAPC++;
 vec2 f=mapFig(p);
 vec2 e=mapEnv(p);
 if(e.x<f.x) f=e;
 return f;
}
vec3 calcN(vec3 p){
 vec2 e=vec2(1.0,-1.0)*0.0012;
 return normalize(e.xyy*map(p+e.xyy).x + e.yyx*map(p+e.yyx).x +
                  e.yxy*map(p+e.yxy).x + e.xxx*map(p+e.xxx).x);
}
/* A SOFT SHADOW THAT DOES NOT RING. Taking k*h/t at each sample asks "how close did
   the ray pass, at this sample", and the samples are laid down by the marcher itself,
   so wherever the step pattern shifts the penumbra jumps with it -- concentric rings
   around every occluder, and on a snow field with nothing else in it they were the
   most visible thing in the shot. Inigo Quilez's correction estimates the closest
   approach of the SEGMENT between two samples instead of at them, which removes the
   dependence on where the samples happened to land. Same cost, same loop. */
float shadow(vec3 ro, vec3 rd, float k){
 float res=1.0,t=0.05,ph=1e20;
 for(int i=0;i<34;i++){
  vec2 mh=map(ro+rd*t); float h=mh.x;
  bool real = mh.y>-0.5;                 // false: this sample is a bound, not a surface
  if(real && h<0.0015) return 0.0;
  /* AND THE CORRECTION NEEDS A GUARD. y = h*h/(2*ph) estimates how far back along
     the ray the closest approach was, which is only meaningful while h is SHRINKING.
     The moment a ray leaves an object's neighbourhood h grows, y overshoots h, the
     sqrt clamps to zero, and the point is declared fully shadowed. On a snow field
     that printed hard concentric rings around the man -- one per sample, out to the
     march limit -- and they were in the lit buffer, not in any texture.
     Bounding y below h keeps d strictly positive and t-y strictly ahead of the
     closest approach. Branching on h>ph instead was the obvious guard and it is
     wrong for the same reason the bug was: a discontinuous correction draws the
     discontinuity, so the rings came back as a stipple. */
  float y = min(h*h/(2.0*ph), h*0.98);
  float d = sqrt(max(h*h-y*y,0.0));
  if(real) res=min(res, k*d/max(t-y,0.0001));
  ph = real? h : 1e20;                   // and it must not seed the next estimate
  if(res<0.004||t>2.6)break;
  t+=clamp(h,0.012,0.14);
 }
 return clamp(res,0.0,1.0);
}
float ao(vec3 p, vec3 n){
 float o=0.0,s=1.0;
 for(int i=0;i<4;i++){ float h=0.014+0.068*float(i); o+=(h-map(p+n*h).x)*s; s*=0.68; }
 return clamp(1.0-1.7*o,0.0,1.0);
}

/* PASS ONE writes what was MEASURED about the surface and decides nothing about how
   it looks. Banding, line art and paper all need to see a pixel's neighbours, and a
   fragment shader cannot. So the look is settled in pass two, which can. */
layout(location=0) out vec4 gA;   // lit, occlusion, rim, distance
layout(location=1) out vec4 gB;   // normal, material

void main(){
 vec2 uv=(gl_FragCoord.xy-0.5*iRes)/iRes.y;
 vec3 f=normalize(uTa-uRo), rgt=normalize(cross(vec3(0,1,0),f)), up=cross(f,rgt);
 vec3 rd=normalize(uv.x*rgt+uv.y*up+uFoc*f);
 float PXA=1.0/(iRes.y*uFoc);       // the angle one pixel subtends
 vec3 ro=uRo; float far=uFar;

 float t=0.05, near=1e9, nearT=0.0, mat=-1.0;
 for(int i=0;i<128;i++){
  vec3 p=ro+rd*t;
  GFP=t*PXA/max(abs(rd.y),0.035);
  vec2 h=map(p);
  if(h.x/t<near){ near=h.x/t; nearT=t; }
  if(h.x<0.0008*max(t,1.0)){ mat=h.y; break; }   // one pixel is bigger further away
  t+=h.x*0.92; if(t>far)break;
 }
 if(mat<0.0){         // a miss still carries the near-miss, and how far away it was
  if(uProbe>0.5){ gA=vec4(uProbe<1.5?float(MAPC):float(PRIMC),0.0,0.0,0.0); gB=vec4(0.5,0.5,0.5,0.0); return; }
  gA=vec4(nearT,0.0,0.0,near); gB=vec4(0.5,0.5,0.5,0.0); return;
 }
 vec3 p=ro+rd*t, n=calcN(p);
 vec3 L =normalize(vec3(-0.34,0.60, 0.72));
 vec3 B =normalize(vec3( 0.30,-0.80,-0.52));
 float dif=max(dot(n,L),0.0);
 /* SHADOW ACNE, ON SNOW. A fixed 12mm lift off the surface is enough when a pixel
    is a few millimetres across and the surface is smooth, and not enough on a drift
    whose micro-relief turns over inside one pixel: half the samples start below
    their own ground and report a hit. On a white field lit from one side that came
    out as a fine dotted stipple across the whole near ground. The lift has to be a
    pixel's worth of surface, so it scales with the footprint. */
 float sh =shadow(p+n*(0.012+GFP*5.0),L,11.0);
 float occ=ao(p,n);
 float bnc=max(dot(n,B),0.0);
 float sky=0.5+0.5*n.y;
 float lit=dif*mix(0.10,1.0,sh)*0.92 + bnc*0.52 + sky*0.085;
 /* RIM IS A SILHOUETTE EFFECT, AND A FLOOR HAS NO SILHOUETTE. Without the last
    factor this term read (1 - n.dot(-rd)) as "the surface is turning away from me",
    which is true of a shoulder and false of a road: a ground plane is grazing
    EVERYWHERE, so every ground pixel took the full rim -- about +1.47 on a colour
    that tops out at 1.0. The road material was authored at 0.61 and measured at 255.
    Fifteen per cent of every street frame was a road that had been erased, and the
    other white half of the picture was snow that had been erased with it. */
 float rim=pow(clamp(1.0-dot(n,-rd),0.0,1.0),1.9)*pow(max(dot(n,L),0.0),0.7)
          *(1.0-uRimGate*n.y*n.y*clamp(n.y,0.0,1.0));   // uRimGate 0 restores the known-bad
 /* ===== R4. THE FACE =====
    An eye is not geometry. Modelled as a ball in a socket it costs every ray every
    step and still reads wrong, because what makes a drawn face is the LINE -- the
    weight of the upper lid, the brow, the corner of the mouth. So the face is a
    decal, evaluated once at the hit, in a frame taken from the surface normal so it
    wraps around the skull instead of being projected flat onto it. */
 bool skinA=(mat>2.5&&mat<3.5), skinB=(mat>22.5&&mat<23.5);
 if(skinA||skinB){
  vec3 lp = skinA ? (p-uPosA) : vec3(-(p.x-uPosB.x), p.y-uPosB.y, p.z-uPosB.z);
  vec3 hc = skinA ? JA[2] : JB[2];
  vec3 hn=normalize((lp-hc)/vec3(0.053,0.059,0.050));
  if(hn.x>0.16){
   vec2 f=vec2(hn.z,hn.y)/hn.x;            // gnomonic: the face plane, seen from inside
   f.y-=0.015;
   vec2 e=vec2(abs(f.x)-0.275, f.y-0.060);
   float eye =length(e/vec2(0.235,0.170))-1.0;
   float iris=length((e-vec2(0.018,-0.012))/vec2(0.118,0.140))-1.0;
   float pup =length((e-vec2(0.018,-0.012))/vec2(0.052,0.062))-1.0;
   float lid =length((e-vec2(0.0,0.128))/vec2(0.262,0.152))-1.0;   // the heavy upper line
   /* mirrored about the centre line, a brow wide enough to sit over the eye also
      reaches across the nose and meets its own reflection -- one black bar instead
      of two brows. It has to be held off the centre. */
   float brow=length((e-vec2(-0.022,0.400))/vec2(0.200,0.044))-1.0;
   if(abs(f.x)<0.105) brow=1.0;
   float mth =length((f-vec2(0.010,-0.285))/vec2(0.105,0.026))-1.0;
   float nse =length((f-vec2(0.060,-0.135))/vec2(0.034,0.090))-1.0;
   /* the catchlight. One bright dot is the difference between an eye and a bead --
      it is the only thing in the drawing that says the eye is wet. */
   float cat =length((e-vec2(-0.072,0.062))/vec2(0.044,0.050))-1.0;
   if(eye<0.0)  mat=16.0;
   if(iris<0.0) mat=17.0;
   if(pup<0.0)  mat=18.0;
   if(lid<0.0&&eye>-0.20) mat=18.0;        // the lash sits ON the eye's upper edge
   if(brow<0.0) mat=18.0;
   if(mth<0.0)  mat=18.0;
   if(nse<0.0&&f.y<-0.075) mat=19.0;       // one soft line for the nose, no more
   if(cat<0.0&&eye<0.0) mat=20.0;
  }
 }

 /* windows are a decision made ONCE, at the hit, from the point itself -- carving
    them into the field would cost every step of every ray for the same picture */
 if(mat>10.5&&mat<11.5){
  vec3 q=p-vec3(iDist,0.0,0.0);   // the wall grid travels with the world, not the camera
  /* which pair of axes the grid runs in depends on WHICH FACE we hit: use the same
     pair on every face and the windows smear into bands down the sides. */
  vec3 an=abs(n);
  vec2 gq=(an.z>an.x? vec2(q.x,q.y) : vec2(q.z,q.y))*2.35;
  vec2 fr=fract(gq);
  if(fr.x>0.22&&fr.x<0.78&&fr.y>0.26&&fr.y<0.74&&q.y>0.55)
   mat = h11(floor(gq.x)*13.0+floor(gq.y)*7.0)>0.52 ? 15.0 : 12.0;
 }
 if(uProbe>0.5){ gA=vec4(uProbe<1.5?float(MAPC):float(PRIMC),0.0,0.0,t); gB=vec4(0.5,0.5,0.5,0.0); return; }
 gA=vec4(lit,occ,rim,t);
 gB=vec4(n*0.5+0.5, mat/32.0);
}
