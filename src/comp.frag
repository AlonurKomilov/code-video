#version 300 es
precision highp float;
out vec4 O;
uniform vec2 iRes;
uniform float iTime;
uniform sampler2D gA;      // lit, occlusion, rim, distance
uniform sampler2D gB;      // normal, material
uniform vec3 RAMP[36];     // two characters, six materials each, three tones each
uniform float uLines;      // so the line pass can be turned off and compared
uniform float uDebug;      // 1: material id  2: line strength -- so the audit has ground truth
uniform float uScene;      // 0 the empty field, 1 the street, 2 the close-up
uniform vec3 uRo;          // the same camera pass one used, for the slope test
uniform vec3 uTa;
uniform float uFoc;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vnoise(vec2 p){
 vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
 return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
            mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
}
const vec3 SKY=vec3(0.895,0.912,0.930);
const vec3 INK=vec3(0.055,0.060,0.078);

void main(){
 ivec2 ip=ivec2(gl_FragCoord.xy);
 ivec2 hi=ivec2(iRes)-1;
 vec4 A=texelFetch(gA,ip,0), B=texelFetch(gB,ip,0);
 float mat=B.a*32.0, t=A.a;
 vec3 n=B.rgb*2.0-1.0;
 vec2 uv=(gl_FragCoord.xy-0.5*iRes)/iRes.y;
 vec2 sp=gl_FragCoord.xy/iRes.y;
 float px=1.0/iRes.y;

 /* ===== R2. INTERIOR LINE ART =====
    A drawn line is not an outline. It appears wherever the eye would lose one form
    in another: a depth step (the arm passes in front of the chest), a hard crease
    (the boot meets the shin), or a change of material (coat against leg). All three
    need the neighbouring pixel, which is the whole reason for this second pass.
    Silhouette is left alone here -- the ray's near-miss already drew it. */
 /* The camera again, because a depth step has to be judged against the slope of the
    surface it sits on. A plane seen nearly edge-on changes depth fast from one pixel
    to the next -- that is geometry, not an edge -- so a fixed threshold paints a soft
    dark band down every grazing surface and quietly flattens the whole interior. */
 vec3 fw=normalize(uTa-uRo), rgt=normalize(cross(vec3(0,1,0),fw)), upv=cross(fw,rgt);
 vec3 rd=normalize(uv.x*rgt+uv.y*upv+uFoc*fw);
 float face=max(abs(dot(n,rd)),0.12);             // 1 = flat on, 0 = edge on
 float dTol=0.0075/face;                          // what this surface may legitimately do

 float dEdge=0.0, nEdge=0.0, mEdge=0.0, curv=0.0;
 const ivec2 OFF[4]=ivec2[4](ivec2(1,0),ivec2(-1,0),ivec2(0,1),ivec2(0,-1));
 for(int k=0;k<4;k++){
  ivec2 q=clamp(ip+OFF[k],ivec2(0),hi);
  vec4 a2=texelFetch(gA,q,0), b2=texelFetch(gB,q,0);
  float m2=b2.a*32.0;   // the SAME divisor as the centre pixel, or every pixel is an edge
  vec3 n2=b2.rgb*2.0-1.0;
  float nd=1.0-dot(n2,n);
  curv+=nd*0.25;
  if(mat>0.5&&m2>0.5){
   /* THE LINE BELONGS TO THE FORM IN FRONT. Drawn on both sides of a boundary it is
      a two-pixel band that covers the value step it was meant to describe -- it
      darkens the join instead of separating it. Drawn only on the nearer surface it
      is half as wide, and the far side keeps its own tone, which is the difference
      between ink on a drawing and a smudge over one. */
   bool front = t <= a2.a;
   if(front){
    dEdge=max(dEdge, (abs(a2.a-t)/max(t,0.001))/dTol);   // in units of what is allowed
    if(abs(m2-mat)>0.5 && mat<9.5 && m2<9.5) mEdge=1.0;
   }
   nEdge=max(nEdge, nd);
  }
 }
 /* and keep it crisp. A half-strength line spread over a wide band is not a line,
    it is a smudge -- it darkens without separating, which is the opposite of the job. */
 float line=uLines*max(smoothstep(1.35,2.20,dEdge),
            max(smoothstep(0.40,0.62,nEdge), mEdge));
 line=line*line*(3.0-2.0*line);

 vec3 col;
 if(mat<0.5){
  float h=clamp(uv.y*1.4+0.5,0.0,1.0);
  col=mix(SKY*0.985,SKY*1.01,h);
 }else{
  float lit=A.r, occ=A.g, rim=A.b;

  /* ===== R1. THE PAINTED TERMINATOR =====
     Where light turns to shadow is where a painting stops looking like a render.
     Two things make that edge read as a brush and not as a threshold: it breaks
     MORE where the form turns fast (a fold) and stays clean where the form is
     flat, and the break streaks ALONG the form rather than across it. Curvature
     comes free from the neighbours above; the streak comes from sampling the
     noise in a frame built out of the surface normal itself. */
  vec2 d2=normalize(n.xy+vec2(1e-4));
  vec2 tg=vec2(-d2.y,d2.x);
  /* The stretch is the whole trick. Sampled isotropically the break comes out as
     blotches -- dirt, not brushwork. Stretched hard ALONG the form and left fine
     ACROSS it, the same noise becomes strokes that follow the surface. */
  vec2 bq=vec2(dot(sp,tg), dot(sp,d2)*13.0);
  float brush=(vnoise(bq*85.0)-0.5)*0.70
             +(vnoise(bq*240.0)-0.5)*0.34;
  float amp=mix(0.008,0.054,clamp(curv*2.6,0.0,1.0));
  float q=lit+brush*amp;

  int mi=int(mat+0.5);
  /* drawn marks are drawn: they do not take a light band, or the lash disappears
     wherever the light happens to fall on it */
  bool drawnMark = (mi>=16&&mi<=20);
  float band = drawnMark ? (lit>0.30?2.0:1.0)
             : smoothstep(0.208,0.228,q)+smoothstep(0.455,0.475,q);
  vec3 c0,c1,c2;
  if(mi==10){ c0=vec3(0.495,0.560,0.690); c1=vec3(0.735,0.780,0.860); c2=vec3(0.970,0.975,0.985); }   // snow
  else if(mi==14){ c0=vec3(0.330,0.372,0.452); c1=vec3(0.470,0.510,0.580); c2=vec3(0.610,0.648,0.706); } // road
  else if(mi==11){ c0=vec3(0.212,0.220,0.248); c1=vec3(0.330,0.342,0.376); c2=vec3(0.468,0.482,0.516); } // wall
  else if(mi==12){ c0=vec3(0.086,0.094,0.116); c1=vec3(0.128,0.138,0.164); c2=vec3(0.180,0.192,0.220); } // dark window
  else if(mi==13){ c0=vec3(0.094,0.100,0.118); c1=vec3(0.168,0.178,0.202); c2=vec3(0.262,0.274,0.302); } // metal
  else if(mi==15){ c0=vec3(0.780,0.660,0.420); c1=vec3(0.880,0.780,0.540); c2=vec3(0.960,0.890,0.680); } // a light that is on
  else if(mi==16){ c0=vec3(0.560,0.556,0.570); c1=vec3(0.790,0.792,0.806); c2=vec3(0.935,0.940,0.950); } // the white of an eye
  else if(mi==17){ c0=vec3(0.075,0.098,0.122); c1=vec3(0.140,0.180,0.215); c2=vec3(0.235,0.300,0.350); } // iris
  else if(mi==18){ c0=vec3(0.050,0.048,0.058); c1=vec3(0.072,0.070,0.082); c2=vec3(0.100,0.098,0.112); } // the drawn line
  else if(mi==19){ c0=vec3(0.170,0.132,0.116); c1=vec3(0.285,0.228,0.202); c2=vec3(0.420,0.348,0.312); } // the shadow that is a nose
  else if(mi==20){ c0=vec3(0.930,0.940,0.955); c1=vec3(0.965,0.970,0.980); c2=vec3(1.000,1.000,1.000); } // the catchlight
  else { int b=(mi<=6? mi-1 : mi-21+6)*3; c0=RAMP[b]; c1=RAMP[b+1]; c2=RAMP[b+2]; }
  vec3 base = band<0.5 ? c0 : (band<1.5 ? c1 : c2);

  if(mi==15){ base=c2; }          // a lamp is not lit by the sun; it IS the light
  /* A FACE INSIDE A HOOD IS STILL A FACE. Occlusion is real -- the hood does shade
     it -- but crushed to a fortieth of its tone it stops being skin and becomes a
     hole. Snow throws a great deal of light back up into exactly this cavity. */
  bool faceish = (mi==3)||(mi==23)||drawnMark;
  base *= mi==15 ? 1.0 : (faceish ? mix(0.94,1.0,occ) : mix(0.88,1.0,occ));
  if(mi==3||mi==23) base += vec3(0.085,0.070,0.062)*(0.35+0.65*occ);   // snow bounce, into the hood
  base += (0.5+0.5*n.y)*0.045*vec3(0.74,0.82,1.0);
  base += rim*vec3(1.0,0.980,0.94)*2.10;
  if(mi!=15) base *= faceish ? mix(0.80,1.0,smoothstep(0.12,0.42,occ))
                             : mix(0.42,1.0,smoothstep(0.30,0.46,occ));
  col=base;
  /* aerial perspective: in a whiteout the far end of a street is the sky */
  float fog=1.0-exp(-mix(0.0045,0.0016,uScene)*t*t);
  col=mix(col,SKY,fog);

  /* the line is drawn last and takes the ground's own darkness with it, so it reads
     as ink on that surface rather than a black wire laid over the picture */
  col=mix(col, min(col*0.26,INK), line*0.88);
 }

 /* the contour: a ray that came close and missed was grazing the silhouette */
 if(mat<0.5){
  /* a contour drawn at full strength on something forty units away is a black line
     hanging in fog that already swallowed the building it belongs to */
  float lineS=1.0-smoothstep(0.0004,0.0022,A.a);
  float nfog=1.0-exp(-mix(0.0045,0.0016,uScene)*A.r*A.r);
  col=mix(col,INK,lineS*0.95*(1.0-nfog));
 }

 /* THE AIR: near flakes streak long and pale, far ones barely move. */
 for(int L2=0;L2<3;L2++){
  float fl=float(L2);
  float sc=mix(26.0,78.0,fl/2.0);
  vec2 dir=normalize(vec2(-0.80,-1.0));
  vec2 q2=sp*sc + dir*iTime*mix(9.0,26.0,fl/2.0)*-1.0;
  vec2 ci=floor(q2), cf=fract(q2);
  if(hash(ci+fl*37.0)>0.80){
   vec2 c2=vec2(hash(ci+7.0),hash(ci+19.0));
   vec2 dv=(cf-c2); dv.x*=mix(3.0,1.4,fl/2.0);
   float fa=smoothstep(mix(0.16,0.07,fl/2.0),0.0,length(dv))*mix(0.22,0.80,fl/2.0);
   col=mix(col,vec3(0.985,0.990,1.0),fa);
  }
 }
 if(uDebug>0.5){
  if(uDebug<1.5) O=vec4(vec3(mat/32.0),1.0);
  else if(uDebug<2.5) O=vec4(vec3(line),1.0);
  else if(uDebug<3.5) O=vec4(clamp(dEdge/2.2,0.0,1.0), clamp(nEdge/0.62,0.0,1.0), mEdge, 1.0);
  else O=vec4(vec3(A.r/4096.0),1.0);   // WORK: 4096 full scale
  return; }

 vec2 g=gl_FragCoord.xy;
 col+=(vnoise(g*1.9)-0.5)*0.030 + (vnoise(g*0.31)-0.5)*0.022;
 col*=1.0-0.20*pow(length(uv*vec2(0.86,1.0)),2.3);
 col=pow(clamp(col,0.0,1.0),vec3(0.92));
 O=vec4(col,1.0);
}
