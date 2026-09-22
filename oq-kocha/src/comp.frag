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
uniform float uFog;        // 1 normal, 0 off -- so distance haze can be measured alone
uniform float uSnow;       // 1 falling, 0 frozen on the glass -- the known-bad for the weather
uniform float uWorkMax;    // full scale for the work probe -- a saturated probe is not a measurement
uniform float uRimOld;     // 0 restores the rim exactly as it was: ungated, added after the bands
uniform float uLineFar;    // 1 ink thins with distance, 0 the old full-strength -- the known-bad
uniform vec3 uRo;          // the same camera pass one used, for the slope test
uniform vec3 uTa;
uniform float uFoc;
__STYLEDECL__
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vnoise(vec2 p){
 vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
 return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
            mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
}
/* SKY and INK used to be consts here. They are style now, like everything else in
   this pass: see src/styles/. */

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
 float dTol=sInkDepthTol/face;                          // what this surface may legitimately do

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
 float line=uLines*max(smoothstep(sInkDepthEdge.x,sInkDepthEdge.y,dEdge),
            max(smoothstep(sInkNormalEdge.x,sInkNormalEdge.y,nEdge), mEdge));
 line=line*line*(3.0-2.0*line);

 vec3 col;
 if(mat<0.5){
  float h=clamp(uv.y*1.4+0.5,0.0,1.0);
  col=mix(sSky*sSkyGrad.x,sSky*sSkyGrad.y,h);
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
  vec2 bq=vec2(dot(sp,tg), dot(sp,d2)*sBrushStretch);
  float brush=(vnoise(bq*sBrushOct.x)-0.5)*sBrushOct.y
             +(vnoise(bq*sBrushOct.z)-0.5)*sBrushOct.w;
  float amp=mix(sBrushAmp.x,sBrushAmp.y,clamp(curv*sBrushCurv,0.0,1.0));
  /* THE RIM HAS TO BE BANDED TOO. Added after the quantiser it was a smooth
     gradient laid over flat cel tones, which is what made a wool hood read as wet
     vinyl: the one continuous shading term in a picture made of hard steps reads as
     a specular highlight, and the eye believes the gradient over the bands. Folded
     into q it becomes a drawn light edge with an edge of its own. */
  float q=lit+brush*amp+rim*sRim.x*uRimOld;

  int mi=int(mat+0.5);
  /* drawn marks are drawn: they do not take a light band, or the lash disappears
     wherever the light happens to fall on it */
  bool drawnMark = (mi>=16&&mi<=20);
  float band = drawnMark ? (lit>sDrawnLit?2.0:1.0)
             : smoothstep(sBand.x,sBand.y,q)+smoothstep(sBand.z,sBand.w,q);
  vec3 c0,c1,c2;
  int pi=(mi-10)*3;
  if(mi>=10&&mi<=20){ c0=sPal[pi]; c1=sPal[pi+1]; c2=sPal[pi+2]; }
  else { int b=(mi<=6? mi-1 : mi-21+6)*3; c0=RAMP[b]; c1=RAMP[b+1]; c2=RAMP[b+2]; }
  vec3 base = band<0.5 ? c0 : (band<1.5 ? c1 : c2);

  if(mi==15){ base=c2; }          // a lamp is not lit by the sun; it IS the light
  /* A FACE INSIDE A HOOD IS STILL A FACE. Occlusion is real -- the hood does shade
     it -- but crushed to a fortieth of its tone it stops being skin and becomes a
     hole. Snow throws a great deal of light back up into exactly this cavity. */
  bool faceish = (mi==3)||(mi==23)||drawnMark;
  base *= mi==15 ? 1.0 : (faceish ? mix(sOccFace.x,1.0,occ) : mix(sOcc.x,1.0,occ));
  if(mi==3||mi==23) base += sHoodBounce*(0.35+0.65*occ);   // snow bounce, into the hood
  base += (0.5+0.5*n.y)*sSkyFill*sSkyFillCol;
  base += mix(rim*2.10, rim*rim*sRim.y, uRimOld)*vec3(1.0,0.980,0.94);   // the last sliver of the edge
  if(mi!=15) base *= faceish ? mix(sOccFace.y,1.0,smoothstep(sOccFace.z,sOccFace.w,occ))
                             : mix(sOcc.y,1.0,smoothstep(sOcc.z,sOcc.w,occ));
  col=base;
  /* aerial perspective: in a whiteout the far end of a street is the sky */
  float far=1.0-exp(-mix(sFog.x,sFog.y,uScene)*t*t);
  col=mix(col,sSky,uFog*far);

  /* the line is drawn last and takes the ground's own darkness with it, so it reads
     as ink on that surface rather than a black wire laid over the picture.

     AND IT HAS TO GO AWAY WITH DISTANCE. The contour below already faded -- a black
     wire hanging in fog that had swallowed its building was obvious. The INTERIOR
     line did not, and the depth test is a RELATIVE one, so at forty units every
     window ledge and parapet spans about a pixel and nearly every pixel of a far
     building reports an edge. The far end of the street was not fading into weather,
     it was dissolving into black speckle. An artist draws fewer lines on far things;
     this is that, as one multiply. */
  col=mix(col, min(col*sInkFloor,sInk), line*sInkStrength*(1.0-sInkFade*far*uLineFar));
 }

 /* the contour: a ray that came close and missed was grazing the silhouette */
 if(mat<0.5){
  /* a contour drawn at full strength on something forty units away is a black line
     hanging in fog that already swallowed the building it belongs to */
  float lineS=1.0-smoothstep(0.0004,0.0022,A.a);
  float nfog=1.0-exp(-mix(sFog.x,sFog.y,uScene)*A.r*A.r);
  col=mix(col,sInk,lineS*sContour*(1.0-nfog*uLineFar));
 }

 /* ===== THE AIR =====
    This had its weight in the wrong layer. The near flakes were the big ones and
    carried 0.22 opacity -- five levels above the sky, which is nothing -- while the
    far flakes carried 0.80 and were a sixth of a pixel across, so the bright ones
    never landed on a sample at all. Measured over the sky of the street shot, the
    whole snowfall moved 0.23% of the sky by more than six levels, at any resolution.
    Aerial perspective runs the other way: what is close to you is dense and sharp,
    what is far is thin and lost in the weather.

    A flake is also a streak along its OWN fall, not along the y axis. And a flake
    thinner than a pixel is a coin toss, not a flake, so each layer is grown to a
    minimum screen footprint and its opacity divided by the area it gained -- which
    is what an anti-aliased sample would have returned anyway. */
 float snowT = uSnow>0.5 ? iTime : 0.0;
 vec2 fall=normalize(sFlakeDir);
 vec2 across=vec2(-fall.y,fall.x);
 for(int L2=0;L2<3;L2++){
  float fl=float(L2)/2.0;
  float sc=mix(sFlakeScale.x,sFlakeScale.y,fl);
  vec2 q2=sp*sc - fall*snowT*mix(sFlakeSpeed.x,sFlakeSpeed.y,fl);
  vec2 ci=floor(q2), cf=fract(q2);
  if(hash(ci+fl*74.0)>mix(sFlakeDens.x,sFlakeDens.y,fl)){
   vec2 c2=vec2(hash(ci+7.0),hash(ci+19.0));
   vec2 d0=cf-c2;
   vec2 dv=vec2(dot(d0,across)*mix(sFlakeStretch.x,sFlakeStretch.y,fl), dot(d0,fall));  // the streak lies along the fall
   float rad=mix(sFlakeRad.x,sFlakeRad.y,fl);
   /* never finer than most of a pixel: grow it, and pay for the area in opacity */
   float k=max(1.0, (sFlakeMin/iRes.y)/(rad/sc));
   rad*=k;
   float fa=smoothstep(rad,0.0,length(dv))*mix(sFlakeAlpha.x,sFlakeAlpha.y,fl)/(k*k);
   col=mix(col,sFlakeCol,fa);
  }
 }
 if(uDebug>0.5){
  if(uDebug<1.5) O=vec4(vec3(mat/32.0),1.0);
  else if(uDebug<2.5) O=vec4(vec3(line),1.0);
  else if(uDebug<3.5) O=vec4(clamp(dEdge/2.2,0.0,1.0), clamp(nEdge/0.62,0.0,1.0), mEdge, 1.0);
  /* 4 and 5 are the SAME channel: pass one decides which counter it wrote, and this
     pass only has to display it. Splitting depth off as 6 without giving the work
     probe an upper bound handed channel 5 to depth, and the cost check spent a whole
     session comparing a bounded render's depth against an unbounded render's depth,
     which are of course identical. It reported 1.000 and failed, which is the only
     reason this was found. */
  else if(uDebug<5.5) O=vec4(vec3(A.r/uWorkMax),1.0);   // WORK
  else if(uDebug<6.5) O=vec4(vec3(clamp(t/60.0,0.0,1.0)),1.0);   // DEPTH: 60 units full scale
  else if(uDebug<7.5) O=vec4(vec3(A.r),1.0);          // LIT, before any banding
  else O=vec4(vec3(A.g),1.0);                          // OCCLUSION
  return; }

 vec2 g=gl_FragCoord.xy;
 col+=(vnoise(g*sPaper.x)-0.5)*sPaper.y + (vnoise(g*sPaper.z)-0.5)*sPaper.w;
 col*=1.0-sVignette*pow(length(uv*vec2(0.86,1.0)),2.3);
 col=pow(clamp(col,0.0,1.0),vec3(sGamma));
 O=vec4(col,1.0);
}
