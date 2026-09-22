---
name: "media-audit-reality"
description: "Audit a code-generated animation, illustration or synthesized soundscape against physical reality before showing it: a deterministic scan that measures every frame, motion via frame strips, hand-drawn timing, cut continuity and rhythm, sound via source-causality, calibrated psychoacoustics and a hunt for whatever never stops, detail at full resolution, every joint across its motion, then a fresh-eyes reviewer."
---

# Media Audit — reality

> **`abc` skill family · `media-audit-reality` v1.2.0** — domain `media` · kind `audit` · method `reality`
> Source of truth: <https://github.com/AlonurKomilov/skills> (ABC LEGACY LLC).
> Naming follows `{domain}-{kind}-{method}-{scope}`; `validate.sh` in that repo is the gate.

The core problem this skill solves: in this environment you **cannot play video and cannot hear audio**. You see still frames and you read numbers. Every check you run answers "does this do what I told it to?" — none answers "would this be true in the real world?" That gap is where the errors live. They are individually correct and collectively false: a self-propelled swimming subject that faces the right way but slides like it is being towed; an empty landscape with a pure sine whistle that no visible object could produce; an emitting source that looks fine at 360px and bare at 1080px; a figure whose head and body are each drawn perfectly and meet at a notch no real join has.

Use this after building any generated animation, canvas/WebGL scene, procedural video, code-drawn illustration (SVG, canvas, a character or scene built from primitives) or synthesized audio, and BEFORE presenting it. Also use it when the user says something "feels wrong" but can't say why.

Run all the passes. Each one replaces a sense you do not have with a check you can perform. Default mode is **report first**: list the findings and state whether the piece is all right; fix only what the user asks for, or everything if they asked for a finished piece.

**The rule that governs every number in this skill:** a metric you have not tested against a known-good and a known-bad case is not a measurement, it is a number. See *Calibration* in Pass 2 — it applies to the visual checks too.

## Pass 0 — Determinism, or none of this works

Do this before anything else. A piece driven by wall-clock time and `Math.random()` renders a different picture every run, so no frame can be re-examined, no before/after comparison means anything, and every finding below is unrepeatable. Three changes make the whole piece addressable:

1. **Seeded RNG.** Replace every `Math.random()` in the simulation with one seeded generator, reset at the start of each run.
2. **Fixed timestep.** Author at a real frame rate (24 or 30) and advance by exactly `1/FPS`, accumulating real elapsed time and stepping whole frames. Never integrate with the raw frame delta.
3. **A frame hook.** `window.__frameTo(n)` — reset, step `n` frames, draw. Same `n`, same picture, every time.

```js
let RS=12345;
function rnd(){RS=(RS*1664525+1013904223)>>>0;return RS/4294967296;}
const FPS=24, DT=1/FPS;
```

**Prove it before trusting it** — render the same frame twice and compare PIXELS, not data URLs:

```js
window.__frameTo(140); const A=ctx.getImageData(0,0,w,h).data;
window.__frameTo(140); const B=ctx.getImageData(0,0,w,h).data;
// count differing pixels. Anything but 0 and the audit below is fiction.
```

One piece reported "differs" on a data-URL comparison and **0 of 2,073,600 pixels** on the real one, and the false negative nearly sent a working system back for a rewrite.

## Pass 1 — Motion: frame strips, never single frames

A single frame cannot show direction, speed, rhythm, or whether a body moves like a body. Sample densely within ONE scene and lay the frames in a row.

- For every scene with a moving subject: 5–8 frames at equal intervals across the scene, at the **delivered resolution**, side by side in one strip.
- Read the strip left to right and write one line per moving thing: *what is it in reality, how does it actually move, does mine match.* Example lines:
  - Self-propelled swimmer: propels with vertical strokes of a tapering terminal limb whose blade lies in the horizontal plane, so from the side it is a thin edge; the body undulates along its length. Mine: rigid translation + sine bob, blade drawn in the vertical plane → FAIL.
  - Subject that moves by pulsing its body: squeezes its body NARROWER and taller to jet forward, then relaxes wide and flat while coasting; trailing appendages lag at different lengths. Mine: body widens on the thrust (inverted), identical appendages ending on one line → FAIL.
  - Hovering flier whose wings beat in a near-horizontal plane: darts to its target and holds station with its feeding structure in contact; the side-view blur is therefore fore-aft, not up-down. Mine: sinusoidal wandering, vertical blur → FAIL.
  - Rotating object at a known period: 33⅓ rpm is one turn per 1.8 s; the light sheen belongs to the room and stays fixed while the surface turns under it.
- Anything that only translates rigidly is suspect. Living things deform; rigid things cast consistent shadows and keep consistent scale.

**A walking figure is built from FOOT TARGETS, not joint angles.** Angles from the hip put the foot wherever the maths lands it, so it slides along the ground and the walk never reads — the figure pedals the air. Plant the foot in world space for the stance fraction, swing it forward for the rest, and solve the knee with two-link inverse kinematics. Derive the body speed, never guess it: `speed = stride / (stanceFraction × period)`. Then assert it, within one stance:

```
planted foot world-x, per stance:  x = 18.000   drift over 35 frames = 3.6e-14
```

Two more numbers fall out and both are checkable against a real gait: double support is `2×stance − 1` (a real walk is 0.20–0.25) and the foot's excursion sets the leg's angle from vertical.

**If the camera tracks the subject, the ground must scroll at the same rate.** Otherwise the planted foot slides against the visible ground texture and you have reintroduced by hand the defect the IK removed. Footprints and thrown debris belong to the WORLD: store the distance travelled when they were made and draw them receding, or they travel with the body.

**Direction of travel — the check that must be numeric.** "It faces left and moves right" is not a pass, it is the definition of travelling backwards. Identify which end of the shape is the front **in the shape's own local coordinates**, then print a table of every landmark's screen position across the scene:

```
 p    front    eye     mid   rearTip    verdict
0.0    -182   -277    -698     -939
0.5     500    353    -297     -590
1.0    1345   1138     219     -242     front leads, all monotonic  ✓
```

Two rules the table enforces, each of which has shipped a broken shot:
- **The leading landmark must be the front of the subject.** If the front-most feature sits at local `x = −380` and the subject travels `+x`, the trailing end is leading, however right the drawing looks. Mirror the shape or reverse the path.
- **Every landmark must advance monotonically, not just the object as a whole.** Scaling a shape about its centre while it approaches makes the leading edge *retreat* even while the object "moves forward". Anchor the transform to the leading edge (`x = front − length·scale`), then assert no landmark ever decreases.

**Check the sign of every direction helper once, on paper.** A limb helper written `y − cos(a)·l` walks UP the screen at `a = 0`. Every leg was drawn from the hip into the torso, the figure had nothing below its waist, and what read as a body was the cloak alone — in twelve consecutive frames, with no error and a clean console. One sign.

**Does the subject fit the frame?** Compute the visible world window from the camera (`centre ± halfWidth/zoom`) and compare it with the object's full extent. A subject longer than the window is never seen whole — you get one end, and the terminal limb you carefully built is off-screen for the entire scene, which also means none of your joint checks on it can be true. Print a `whole: YES/no` column and make sure it says YES for a readable stretch (~2–3 s), or restage the shot.

**Do not let the sampling interval alias with the subject's own period.** An appendage beating every 2.51 s sampled every 1.2 s advances 172° per frame — near-stroboscopic — and the strip shows an appendage that never moves. A fresh reviewer reported exactly that, and it was false. List each subject's period (stroke, wingbeat, rotation, pulse) and choose an interval that is not near a half- or whole-multiple of it; for a joint strip, sample *within* one period.

- **Behaviour, not only kinematics:** does the subject do the thing it exists to do in this shot? Aimless motion reads as fake even when the anatomy is right.
- **Lighting must move with the event:** a rising light source brightens the sky and ground; an emissive event lights its own source and the underside of what it ejects.
- **Camera vs subject:** if the camera move is larger than the subject's move, the subject's motion is lost.
- **Visible amplitude:** a motion that shifts fewer than ~10 px between adjacent strip frames does not exist for the viewer — a head turn of 0.03 rad, a trailing-appendage lag of 4 units, a breath that scales a 390 px body by 1.2% (= 4.7 px). Compute the pixel displacement before trusting it.

**Transitions:** sample each crossfade midpoint plus ±0.4 s. The two shapes being matched must agree in **position and size** on screen at the midpoint and keep agreeing through the overlap. To match two scenes, place a shape at the same screen centre and the same *apparent* size in both, remembering each scene has its own zoom: a shape of world radius 200 at z=1.5 matches one of world radius 286 at z=1.05. A bright scene crossfading into a dark one meets as mud whatever you put in it — bring their brightness together first, then match the shape. A looping piece must overlap its last scene into its first.

**Regression:** if a scene reuses an earlier build, list the behaviours the original had and confirm each survived. Simplified re-implementations silently drop the life.

**Enclosed background is a hole in the object.** An appendage that curls back toward the body, a limb that crosses it, any stroked path that closes against a filled shape traps a pocket of background inside the silhouette — and the viewer reads it as a hole punched through the subject. Eyeballing a magnified crop is not enough; this was missed by eye and caught by a fresh reviewer. Test it: threshold the frame into object/not-object, flood-fill the not-object region from the frame border, and report any not-object pixel the fill never reached. Run it across the motion, because the pocket only closes in some poses. The fix is topological — the appendage must sweep monotonically *away* from the body, never curl back within a rim-width of it.

Sampling with Playwright (page exposes `window.__seek(t)`; add it if missing):

```js
for(const t of times){
  await page.evaluate(x=>window.__seek(x),t); await page.waitForTimeout(200);
  await page.evaluate(x=>window.__seek(x),t); await page.waitForTimeout(50);   // see below
  await page.screenshot({path:`s_${t}.png`,clip:canvasBox});}
```
The animation keeps running during the wait, so a single seek lands ~0.2 s late — enough to pull the next scene's crossfade into a frame you believed was clean. Seek, settle, seek again, shoot. Build the strip with PIL and Read it; do not shrink frames below ~400px each. When you crop to inspect a part, derive the crop box from the scene maths — a guessed crop that misses the subject looks exactly like a subject that isn't there.

## Pass 1b — The per-frame scan: MEASURE every frame, LOOK at the ones that fail

Strips are for reading motion. They are not coverage: a dozen frames out of five hundred is one frame per shot, which is the single-frame failure again at a larger scale. With Pass 0 done every frame is addressable, so measure all of them and let the numbers choose where to look.

**Scan linearly, not by seeking.** `__frameTo(n)` restarts from zero, so scanning with it is O(n²). Reset once, then step–measure–step:

```js
window.__scanAll=(step)=>{
 reset(); const out=[]; let prev=null;
 for(let f=1;f<=TOTAL*FPS;f++){                 // f must match the engine's own counter
  stepOnce(); sim(DT); draw();
  const d=ctx.getImageData(0,0,W,H).data;
  /* sample every `step`-th pixel; accumulate the metrics below */
  out.push({f,t,shot,diff,inkDiff,ink,cx,cy,w,h,lum, /* + state probes */});
  prev=cur;
 }
 return out;
};
```

At a stride of 4 this measured **464 frames in 10 seconds** — cheap enough to run on every build.

| metric | what it is | what it catches |
|---|---|---|
| `diff` | mean abs luminance change from the previous frame | cuts (spikes), dead runs (near zero), the shape of an acceleration |
| `inkDiff` | the same, restricted to pixels that are SUBJECT in either frame | character motion, which whole-frame diff buries under weather and particles |
| `ink` | fraction of subject pixels | a subject popping in or out, a shot with nothing on screen |
| `cx,cy,w,h` | centroid and bounding box of the subject | non-monotonic travel, jumps, a subject leaving frame |
| `lum` | mean luminance | flash and impact frames, exposure drifting across a shot |

Read it for: **runs of near-zero `diff`** (a held beat is deliberate, a dead one is not — one piece had 22 consecutive frames in which nothing changed and two figures appeared to hold a clothesline); **spikes inside a shot** (something jumped that should have moved); **centroid jumps over ~60 px in one frame**; and `ink` steps at a boundary.

**Restrict the metric to the thing you are asking about.** A whole-frame diff over a scene with a thousand particles is a particle meter: the subject is a few percent of the pixels and its behaviour is invisible in the average. The subject-restricted diff answered in one line what the whole-frame diff had been reporting backwards.

**Probe the MECHANISM, not its shadow.** The strongest use of a scan is to log the actual state variable each frame beside the pixels. One piece ran a full verlet cloth simulation every frame; logging one node gave `cloth[3].x = -9.146` for fourteen consecutive frames to three decimals. The physics was running and producing a constant, because its only inputs were constant — a fixed anchor and a fixed wind. No screenshot at any density could show that, and the fix (drive the anchor from the shoulder that actually bobs; make the wind the weather PLUS the body's own speed) took the amplitude from 0 to 7.56. Whenever a simulation exists, print one of its numbers per frame and confirm it changes.

**A pixel metric measures the FRAME, not the subject.** Bounding-box height saturates the moment the subject is cropped, so pushing a close-up closer can make the measured height go DOWN and report the fix as a regression. When the authored quantity exists in the code — the camera scale, the emitter level, the spawn rate — log THAT and use pixels only as a cross-check.

**Calibrate the frame index like any other metric.** A scan that reports frame `f` while the engine has already incremented to `f+1` reports an alternating mechanism exactly backwards — "exposed on even frames" came back as odd, and the first reading of it was that the feature was broken. State the known-good answer first (*characters are exposed every second frame, so even-frame motion must exceed odd*), then check the metric reproduces it. If it does not, suspect the metric before the mechanism.

## Pass 1c — Timing: hold the drawing, do not smooth it

Continuous interpolation at 60 fps is why code-drawn motion reads as a screensaver rather than as animation. Hand-drawn animation has a vocabulary for this and all of it is implementable:

- **Shoot on twos.** Run the physics every frame, but commit what the drawing SHOWS only every second frame — 12 drawings a second. The stepping IS the look, not a limitation anyone worked around. Fast action drops to ones, slow holds go to threes.
- **An exposure sheet, not a curve.** Give the sequence an explicit per-frame table: which pose, how many frames it holds, which effect. `11 frames accelerating · 4 frames held · 3 frames impact · 2 frames inverted · 28 frames settling` is a shot; an eased tween between two poses is not.
- **Impact frames.** At the hit, one to three frames of abstract graphic — lines converging on the point of contact, the subjects fused into one mass — then one or two INVERTED frames. A line that merely fades thinner over five frames is a wipe, and reads as one.
- **Smears and multiples.** On the fastest frames draw the subject plus two or three trailing transparent copies. That is what an animator draws instead of in-betweens nobody can see.
- **Holds that still breathe.** A held drawing lands the beat, but a completely frozen frame reads as a freeze. Keep the cloth settling, the weather running, the exhale drifting.
- **Anticipation, overshoot, settle.** A run does not stop dead: let the lean bleed off over ~1 s with a damped overshoot, and make two subjects asymmetric — mirrored figures at the same height read as a pose, not as a moment.

And a staging rule the maths will not give you: **geometrically correct can still read wrong.** Two mirrored figures holding long horizontal blades that trail behind them say "still fighting" to the eye, whatever the angles prove about which way is backwards. When a frame reads wrong and measures right, change the staging, not the numbers.

## Pass 1d — Cuts: a cut is a match or a step, never the space between

Every boundary between shots is checkable, and the failure the viewer notices is not "wrong size" but **almost the same size**. Three kinds of cut, two of which are correct:

| kind | condition | what the eye says |
|---|---|---|
| **MATCH** | subject scale ratio ≈ 1.00, centroid within ~2% of frame width | "this is the same action continuing" |
| **CLEAN** | subject scale changes by **≥ 1.45×** | "new shot" — position is then free |
| **JUMP** | anything between (~1.05× to ~1.44×) | "something went wrong" |

This is the classical rule stated as a number: do not cut between adjacent shot sizes — go wide to medium to close, skipping a step — and never move the camera a little. One piece measured five of twelve cuts inside the jump band:

```
before                               after
walk   -> boot      1.31x  JUMP      3.48x  CLEAN
other  -> charge    1.17x  JUMP      2.86x  CLEAN
charge -> clash     1.12x  JUMP      1.00x  MATCH   (one continuous action)
after  -> drop      1.10x  JUMP      1.51x  CLEAN
drop   -> backs     1.11x  JUMP      1.57x  CLEAN
```

A cut inside one continuous action must be a MATCH, not a step: a run flowing into the impact that changes size mid-action breaks the movement. Everything else steps.

Also check across every cut: **screen direction holds** (a subject travelling left keeps travelling left, or you have crossed the line), and **the graphic cut is exempt** — a flash or an abstract impact frame has no subject, so scale continuity does not apply to it.

**Rhythm: there is no "change every N seconds" rule, but there are two real constraints.** Shot length should *track tension*, and a frame with no change holds attention for about 4–5 seconds at most unless something is building inside it. Print the shot lengths and read the curve:

```
3.0  2.0  1.8  1.6  0.58  0.46  0.17  0.12  0.08  1.12  2.0  2.4  4.0
 \____ decelerating ____/   \__ accelerating __/   \____ releasing ____/
```

The shortest shot is the hit; the longest are the opening and the end. Average shot length is a real quantity — action cutting runs 2–3 s, drama 6–8 s — but the shape of the distribution matters more than its mean. A run of equal-length shots is a slideshow whatever is in them.

## Pass 2 — Sound

You cannot listen. Level meters cannot tell you a sound is unmotivated. Work in this order: source line, event log, audibility, the mix, psychoacoustics, and then — the one that cost the most — **what never stops**.

### 2a. The source line

For every layer and every accent, write:

> `<sound>` is produced by `<visible object in this frame>`.

If you cannot name the object, the sound is wrong: cut it, add the object to the picture, or replace it with something the visible world does produce. Pure sine/saw tones are almost never diegetic; treat them as musical elements that need a musical reason. Check the source against the viewpoint: individual small sources are not resolvable at that distance, so a Doppler pass-by is wrong — a loud tonal source carries, if its emitter is drawn. Contact noise is motivated by a drawn contact (a drawn point of contact riding a surface), not by the object alone.

**Range and scale:** verify the actual acoustic range of whatever species or mechanism you are depicting — related species can differ by orders of magnitude.

**Give each object its own voice AND its own acoustic.** This is what a listener praises when it works: a submerged source that sounds submerged (low, narrow, a 4–5 s tail), a beating wing that is a 330 Hz carrier with 52 Hz amplitude modulation, a scatter of small impacts built from distinct samples rather than one sample repeated. Drawing an object and giving it *a* sound is not enough — give it the sound of **that object in that place**.

**Name your layers honestly, and read the names back.** A layer called "debris hiss" was white noise through a 700 Hz high-pass, twice a second, half a second long. That is not an impulsive emission, it is a hiss generator, and the name said so before any measurement did. Falling solid matter is a clatter of short pitched-down taps. If a layer's honest name contains "hiss", "noise" or "wash", ask what the real event sounds like.

### 2b. The event log — what a source line cannot reach

The source line is a claim about the *code*. It does not answer the three things a viewer actually complains about: **"I heard something but never saw what made it"**, **"the action happened and the sound came late"**, **"that same sound again"**. Those are claims about a *moment*. Instrument a **copy** of the file behind `?log=1` and run one full loop in real time, logging:

```
AUDIO : name, T, duration, scene, sceneWeight        // from every tone()/burst() site
VISUAL: name, T, source screen x/y, on-screen?, px size, age, readable?   // from the draw
```

1. **Visibility at onset.** Was the cause on screen, large enough, readable, at the instant the sound started? A blip firing on a dice roll while no discrete visual event is occurring is unmotivated in 93% of its firings even in a scene full of candidate causes. Anything below 100% is a finding.
2. **Onset lag.** `T(visual readable) − T(audio start)`, measured from the **event's own age** — the previous firing's visual may still be on screen and will fake a negative lag. Beyond ~±100 ms the viewer feels it. Fix a sound that leads by giving the event an **instant** visual, not by delaying the sound. Whatever instant visual you add must not cross the object's own silhouette: a full ring centred on the subject's back expands down *through* the subject — draw the upper half only.
3. **Density and repetition.** Fires/second, smallest gap, fires landing inside their own tail, and **fires ÷ distinct buffers** — 134 taps from 6 samples is each sample heard 22 times, which is what "the same sound over and over" actually is. Fix with all three: lower the rate, add more distinct samples, and gate:

```js
const LAST={};
function gate(k,ms){const n=performance.now();if(LAST[k]&&n-LAST[k]<ms)return false;LAST[k]=n;return true;}
```

**Bind events to the picture, not to dice.** Raise a counter in the draw at the moment the cause happens — set a once-only flag on the object the instant its visual event begins and increment a named event counter — and fire the sound from that counter. Better still, fire it from the SIMULATION at the frame the contact occurs: a footfall triggered by the foot reaching the ground can never drift from the picture, and a footfall on a schedule always will.

**A sound may only fire while its scene IS the picture.** Gate accents on scene weight ≳ 0.4, not ≳ 0. During a crossfade the outgoing scene's exit zoom throws its own source off-frame.

**A sound that never fires is a bug too.** A per-frame probability of `dt*0.16*w` is ~1.3 expected firings across a nine-second scene — and came out 0 in a whole loop. If a sound must be heard, trigger it deterministically once per pass.

**Schedule a music-locked piece against the audio clock, not per frame.** Lay the whole score out at once from one start time; `requestAnimationFrame` jitter is audible as flam on anything with a beat.

### 2c. Audible, not merely scheduled

Logging proves the code decided to play something; it does not prove anything came out. The trap that ate 262 of 360 events in one piece: `source.start(t0, Math.random()*2)` on a buffer 30 ms long. Per spec an offset past the buffer's end clamps to the end, so it renders **exact silence** — the layer of small impacts had no taps at all. Any `start(when, offset)` needs `offset < buffer.duration`; scale the jitter to the buffer. Prove it with an `OfflineAudioContext`, which renders deterministically:

```js
const oc=new OfflineAudioContext(1,44100*0.2,44100); /* … start(0,offset) … */
const ch=(await oc.startRendering()).getChannelData(0);
let peak=0;for(const v of ch)peak=Math.max(peak,Math.abs(v));   // peak===0 ⇒ silence
```

Use the same technique to check any accent's real level in isolation before blaming the mix.

**Every noise source needs an envelope.** A gain node set to a constant and stopped after half a second is a rectangular block of noise with a click at each end — a hiss, whatever the layer is called. A sampled buffer carries its own decay and is safe; a long noise buffer does not. An impulsive event opens in under 10 ms, decays exponentially, and **its filter falls while its level falls**, because air absorbs the top end first. That downward sweep is the whole difference between a blast and a hiss: one piece measured spectral flatness 0.483 before and 0.091 after, with no other change.

### 2d. Measure the mix

Capture the real output — MediaRecorder on a MediaStreamDestination tapped **after** the limiter, then `ffmpeg -ac 2 -ar 22050`. **Capture in stereo.** Collapsing to mono at the capture destroys the only data that can answer the phase question, and you will then call that question unanswerable — a blindness you inflicted on yourself.

Per scene, in its solo window clear of both crossfades:
- **RMS** in dBFS; spread ~4–9 dB. The drama may justify the top of that; 16 dB means the quietest scene vanishes.
- **Band energy** [20–120, 120–400, 400–1.2k, 1.2–4k, 4–10k] Hz. A scene with <8% across the two mid bands is a drone, not a place.
- **Stereo correlation** L vs R, and **mono collapse**: `20·log10(RMS(mono sum) / RMS(mean of channel powers))`. Below −3 dB something cancels.
- **Loudness range** over the whole piece (95th minus 10th percentile of a 0.4 s envelope). Under ~6 dB is one level for the whole run.
- **True peak as a percentile, not a max.** Opus decoding overshoots: one piece showed max 1.000 from **2 samples out of 2.7 million** while the 99.99th percentile sat at 0.839. `np.max` on a lossy-decoded capture is a false-positive generator.
- **Re-measure after fixing any silent or newly-bound sound** — trims calibrated while a layer was silent are wrong the moment it sounds.
- If everything measures the same level, your compressor is a leveler — make it a limiter (threshold −3 dB, ratio ≥ 10, fast attack).
- Use real `dt` for real-time capture; a fixed timestep doubles the speed at 60 fps.

### 2e. The psychoacoustic measures

These answer what RMS and band energy cannot. All standard (Zwicker/Fastl); perceptual codecs compute masking thresholds routinely. There is no excuse for calling them out of reach.

```python
def bark(f): return 13*np.arctan(0.00076*f)+3.5*np.arctan((f/7500.0)**2)

def audible_at(x, sr, f0, bw=7, ref=(200,6000)):
    """MASKING: energy at f0 above the local spectral floor. Run it on the accent's best
    0.5 s window, not the scene mean -- a transient averages away.
    >= +6 dB audible, +3..6 marginal, below that masked."""
    X=np.abs(np.fft.rfft(x*np.hanning(len(x)))); f=np.fft.rfftfreq(len(x),1/sr)
    m=(f>=f0-bw)&(f<=f0+bw)
    floor=np.median(X[(f>ref[0])&(f<ref[1])])+1e-12
    return 20*np.log10(X[m].max()/floor)

def sharpness(x, sr):
    """Zwicker acum. ~1 = speech, >2.5 starts to pierce."""
    X=np.abs(np.fft.rfft(x*np.hanning(len(x))))**2
    f=np.fft.rfftfreq(len(x),1/sr); z=bark(f)
    E=np.array([X[(z>=b)&(z<b+1)].sum() if ((z>=b)&(z<b+1)).any() else 1e-14 for b in range(24)])
    Np=np.power(E/(E.sum()+1e-14),0.23); zc=np.arange(24)+0.5
    g=np.where(zc<16,1.0,0.066*np.exp(0.171*zc))
    return 0.11*np.sum(Np*g*zc)/(np.sum(Np)+1e-14)

def flatness(x, sr, lo=300, hi=8000):
    """HISS. Spectral flatness over the band the ear calls 'noise'.
    white 0.56 | pink 0.39 | noise through Q=0.6 0.25 | Q=3 0.07 | pure tone 0.00
    Above ~0.12 on a CONTINUOUS layer is what a listener calls a vacuum cleaner."""
    X=np.abs(np.fft.rfft(x*np.hanning(len(x))))**2
    f=np.fft.rfftfreq(len(x),1/sr); P=X[(f>=lo)&(f<hi)]+1e-18
    return float(np.exp(np.mean(np.log(P)))/np.mean(P))

def roughness(x, sr):
    """Modulation DEPTH at a rough rate (~70 Hz) -- not modulation energy, not a
    peak/median ratio. Calibrated threshold ~0.13."""
    F=np.fft.rfft(x); ff=np.fft.rfftfreq(len(x),1/sr)
    tot=float((np.abs(F)**2).sum())+1e-14; out=0.0
    for lo,hi in [(300,600),(600,1200),(1200,2400),(2400,4800),(4800,9000)]:
        if float((np.abs(F[(ff>=lo)&(ff<hi)])**2).sum())/tot < 0.02: continue
        F2=F.copy(); F2[(ff<lo)|(ff>=hi)]=0
        env=np.abs(np.fft.irfft(F2)); mu=env.mean()
        if mu<1e-7: continue
        e=env/mu-1.0
        if e.std()<1e-4: continue
        M=np.abs(np.fft.rfft(e*np.hanning(len(e))))/(len(e)/4.0)     # -> depth
        mf=np.fft.rfftfreq(len(e),1/sr)
        k=max(1,int(round(3.0/(mf[1]-mf[0])))); M=np.convolve(M,np.ones(k)/k,mode='same')
        sel=(mf>=20)&(mf<=300)
        w=np.exp(-((np.log2((mf[sel]+1e-9)/70.0))**2)/1.2)
        out=max(out,float((M[sel]*w).max()))
    return out
```

**Tonal prominence** (the narrowest peak above the median of its own critical band) finds resonances — and every intended tone. Read it against the source line, never alone: three "TONAL peak" flags in one piece were the intended tonal emitter, the melody and the subject's own call, all deliberate.

**Two tones inside one critical band beat roughly, and no level change fixes it.** Synthesised pairs at 350 Hz measured 0.37 at a third, 0.245 at a fourth, 0.107 at a fifth and 0.000 at an octave. A real dual-tone horn IS a third and really does buzz — but if it is the only rough element among naturalistic neighbours, the ear picks it out as the thing that does not belong. Widen the interval or drop a voice.

### 2f. Calibration — what makes a number a measurement

Before any metric reports on real material, run it on **synthesised references you know the answer to** and check it separates them. Generate them; you need nothing from the network:

```
pink noise                SMOOTH      1 kHz + 70 Hz AM 100%    ROUGH
1 kHz pure sine           SMOOTH      2 kHz + 70 Hz AM 100%    ROUGH
1 kHz + 4 Hz AM           SMOOTH      pink noise + 70 Hz AM    ROUGH
```

This is not ceremony. A roughness metric written as *modulation energy* scored pink noise — perfectly smooth — identically to every scene of the real piece: it was measuring noisiness. Rewritten as a *peak/median ratio* it returned 295,534,268 for a pure sine, because unmodulated bands divide by zero. Only the third form separated smooth (0.0008–0.043) from rough (0.219–0.222). Without references, two different wrong metrics would each have produced a confident, wrong report.

Apply the same discipline anywhere: a flood-fill hole test should find a hole you inserted on purpose; a lag measurement should return a lag you injected; a frame scan should reproduce a stepping rate you already know.

### 2g. Measure the real question, not a proxy for it

"Is this scene too bass-heavy?" has no threshold worth arguing about. The question underneath is **"what survives a small speaker?"** — roll the capture off below ~450 Hz with a 4th-order slope and compare RMS before and after.

```
scene          before      after     change
Scene A      -24.3 dB    -7.5 dB   +16.8 dB      was inaudible on a phone
Scene B      -12.9 dB    -4.3 dB    +8.6 dB
```

By the percentage proxy Scene B still "failed" at 61% sub-bass after the fix; by the real question it lost 4.3 dB on a phone and was fine. Whenever a threshold feels arbitrary, find the question it stands in for and measure that. For transient content measure the **98th-percentile short-time peak**, not RMS: a scene whose only content is one impact every four seconds averages away to nothing.

### 2h. What never stops — run this before you call the mix clean

This one cost four rounds and three separate causes, and **no per-scene measurement can find it**. A layer present in all scenes equally shows up inside every per-scene number as "part of the bed", so RMS, bands, masking, roughness and sharpness all read normal while the listener hears one continuous noise.

**Measure the silence.** Force every scene weight to zero and capture. The output must be at the noise floor. One piece measured **−38.6 dBFS with everything muted** — 14 dB under the music, plainly audible — because of this:

```js
lfo.connect(gn(.12)).connect(out.gain);   // WRONG
```

Per the Web Audio spec an AudioParam's value is its intrinsic value **plus** the sum of its connected inputs. It is additive, not multiplicative, so `out.gain` swung ±0.12 even when the scene weight was 0 — eight beds of filtered noise running under all eight scenes, forever. Put the modulation in a **series** gain stage instead:

```js
const breathe=gn(1); breathe.connect(out);      // layers feed `breathe`
lfo.connect(gn(.12)).connect(breathe.gain);    // `out.gain` stays the pure scene weight
```

**Inventory everything that can sound in more than one scene, then mute each one in turn and measure the resting floor** (20th–35th percentile of a 30 ms envelope) per scene. The component whose removal drops the floor most is what never stops. Candidates that are easy to miss:
- **A musical pad or drone.** A sustained voice under every scene is a drone *at any level*, and gliding its pitch per scene is exactly "it keeps going but changes every scene". One was added deliberately as an artistic improvement and became the defect the user had been reporting for three rounds.
- **A long reverb tail at a high send.** A 4.4 s tail at 0.44 never decays before the next thing feeds it — that is its own kind of never-stopping, and it showed as one scene resting 13 dB above every other.
- **Anything started once at init and only gain-gated** — including a graph whose level table has gone all-zero: the oscillators are still running and the parameters are still being written every frame, to hold silence in place.

**Partial removal is the strongest diagnostic you have.** When you suspect an element, remove it from some scenes and leave it in others, then ask the listener which scenes still have it. One answer — "it's gone, except in these two" — named exactly the two scenes where it remained, and settled in one sentence what four rounds of measurement had not.

**"It changes in each scene but never stops" is a diagnostic phrase.** It rules out the beds (they alternate) and points at a single element spanning scenes with per-scene parameters.

### 2i. Bed versus events — is there anything to listen to?

A soundscape built from filtered noise loops is a vacuum cleaner with a different nozzle per scene. Two measurements catch it:

**Hiss:** `flatness()` on the **bed alone** (accents muted). Wide filters are the cause — Q around 0.5 is broadband noise. Narrowing to Q 2.5–5 turns hiss into air, wind and water: one piece went from 0.229–0.483 to 0.001–0.150 with no other change. Physical correctness helps here: under water high frequencies do not travel, so a 2.4 kHz layer in a submerged bed was both a hiss and wrong. But narrowing has a cost — re-run the small-speaker test afterwards, because the energy you removed may have been the only content a handset could render.

**Relief:** how far the loudest moments rise above the resting level (97th vs 35th percentile of a 30 ms envelope). Under ~5 dB means nothing happens in that scene. And note what this catches that RMS cannot: **a dense accent is not an event, it is more bed.** Eleven taps a second registered as zero relief; the same taps at 3.4/s and three times the level gave 9 dB. Sparse and strong beats dense and quiet. Sparse events never dominate RMS, so never judge "is there anything happening" by level share.

Also: when a scene's *only* content is its bed, add events with real visible causes — a gust bound to the particles you can see streaming, a pass-by bound to the moving objects that are drawn, a wingbeat when a drawn flier leaves its perch.

**Silence is a level.** The loudest moment in a piece is made by the quarter-second before it in which nothing is scheduled at all. Write the gap into the score deliberately and check that nothing overlaps it.

### 2j. What none of this can see

Masking, sharpness, roughness, hiss, phase and monotony are all measurable, and this pass measures them. These are not: whether the piece is **pleasant**; whether a timbre **irritates** this listener; whether the sound **fits the scene emotionally**. Passes 2a–2i find sound that is *wrong*. They cannot certify sound that is *good*. Say so plainly rather than implying a clean table means a good mix.

Harness pitfalls that produced false readings before: a click landing off-screen because the page is taller than the viewport; a tap variable captured before the node it references exists; a page-side variable referenced inside `page.evaluate`; a log run longer than the loop period, which records the overlapping slice twice and fakes impossibly short gaps (dedupe by timeline time); and **run-to-run variance** — with random accents a scene's resting floor can differ 8 dB between two captures, so never conclude from one. Take the median of three or more runs on each side and state the noise floor before reading any delta.

## Pass 3 — Detail: full resolution, one scene at a time

Contact sheets are for sequence, not for detail. Judge every scene once at the delivered pixel size, alone. Ask where the eye lands and whether that spot earns the look. Give the focal object more geometry than the rest; the commonest failure is the focal object being the *least* detailed thing in the frame.

**Composition:** if more than half the frame is flat background, say so — it reads as unfinished at full size even when the thumbnail looked balanced.

**Procedural artefacts:** a dot-grid glow that stops on a hard edge instead of fading; decoration strokes that poke outside the shape they belong to or stop on a straight line inside it; extrusions or shadows drawn over the surface they should sit beside; identical instances with no variation; light sources with nothing producing them; an "edge light" drawn as a flat bar of constant width instead of a falloff; a flow drawn as a rigid pattern; a reflection drawn as a hard-edged wedge; an element that terminates in mid-air instead of reaching what it comes from.

**A repeating pattern usually means harmonically related frequencies.** A procedural crack pattern modulated at 13, 27 and 52 (≈ 1×, 2×, 4× 13) beats in phase and produces one lobe repeated down every channel. Pull them apart (8.7, 23.1, 47.3) and the same code reads as irregular.

**A silhouette carries no scale cue.** At extreme close range a dark shape on a light ground is a boot, a tree trunk or a monument with equal conviction, and no amount of redrawing fixes it — two rebuilds produced a tree twice. Give the eye three references at once (two limbs, the ground line, the material they disturb) or pull the framing back until the subject is legible.

## Pass 4 — Construction: one object, one body, across its motion

Anything drawn from more than one primitive has **joints**, and a joint is where code-built things fall apart. Each part can be correct on its own and the object still reads as cut-out pieces. Nothing in Passes 1–3 looks at this, and a viewer sees it instantly.

**A joint is a function of pose, so never judge it from one frame.** For each joint make a **joint strip**: 5–6 crops of the same joint across one full period of the motion that stresses it, at the delivered resolution and magnified ×2. Sample the deforming parameter's extremes on purpose. **The worst frame in the strip is the verdict**, not the average.

Check five things at every joint, in every frame:

1. **No gap.** The child part must start *inside* the parent, overlapping by at least the rim width, in every pose.
2. **No seam.** A closed outline around each part guarantees one.
3. **No crossing.** An outline, highlight or rim of one part must never run across the face of another — including an effect ring expanding through the back it sits on.
4. **A cavity is cut, not laid on.** The rim of a depression is the parent's own edge, not a ring on a flat top.
5. **The join has the silhouette a real one has, in every pose.** A neck is a smooth S at every head angle; a limb grows out of a trunk as one bent tube of the same thickness, not a thin pipe bolted between two posts.

The general fix is architectural: **draw outlines and rims on the union silhouette, never per part.** Fill every part in the rim colour at an offset, then fill every part again in the body colour on top — overlapping fills merge with no interior boundary. Build the joint into the path where you can; where you can't, overlap generously and let the union fill hide it. Cavities: subtract from the parent rather than drawing a lid. A single-colour silhouette gets this for free: round-capped strokes and filled paths in one colour union with no seam at all, which is the reason silhouette suits drawing by code.

**Check the union shape at thumbnail size before anything else.** Parts correct in isolation can sum to a shape that is not a body: one figure's cloak, drawn to spec, was three times wider than the body and the whole thing read as a fish in every frame. If the silhouette is unreadable at 200 px it is unreadable, full stop.

**A constant-width limb is a pipe.** What makes a silhouette read as flesh is that every segment TAPERS and every joint is a sphere the segments meet inside — thigh 5.6 to 4.1, calf 4.3 to 2.4 on a 100-unit body, with the calf swelling above the ankle. Draw each segment as a tapered quad plus a circle at each end; round-capped strokes of one width cannot do it.

**Proportion, negative space, and the parts a figure needs to be a figure.** A head is about 1/7.5 of standing height; larger reads as a child, smaller as a mannequin. A torso is not a trapezoid — it has a deltoid, a ribcage, a waist and a pelvis, and the waist is what says "person". The neck must be visible or head and body fuse into one mass. Hands are a mass and boots have a heel, a sole and a toe — a line end is neither. And the **negative space** between arm and body has to open: an arm swinging inside the torso outline makes anything it holds appear to float off the chest. Draw back to front so the near limb lands in front of the torso.

**Do not rotate an appendage about a pivot buried inside a tapering parent.** The root corners swing out through the skin — that step is exactly the "it's come apart" a viewer reports. Weld the root and express the rotation by displacing the *tips* (`tipY += pitch*k`).

**A part drawn edge-on may be anatomically right and still read as nothing.** A flat terminal limb seen from the side truly is a thin sliver; drawn that way it looks like a stub. Cheat the view a few degrees. Correctness that communicates nothing is still a failure.

**A parametric rig has a ceiling, and it is below "drawn".** A skeleton plus formulas can make anatomy correct and still read as assembled, because an artist does not build a figure from joints outward — they draw the silhouette first and let the anatomy serve it. Four things a rig omits by construction, all of them addable: a **line of action** (one sweeping curve from head through spine to the supporting foot — a lean applied as a shear is not a curve); **contrapposto** (hip line and shoulder line tilting in OPPOSITE directions — both horizontal is the mannequin tell); **straight against curve** (one edge of each limb flat, the other curved — two curves is a sausage, two straights is a stick); and **asymmetry** (identical parameters on both sides, or on two characters, read as one shape stamped twice). Past that ceiling the answer is not a better rig but authored key poses — each pose an explicit outline, held on the exposure sheet rather than interpolated.

## Pass 5 — Fresh eyes

Spawn a separate agent that has NOT seen the code. Give it only the strips, the full-res frames and the joint strips, plus the sound list as text, and ask: what is physically or anatomically wrong across each strip; what is fake or empty at full resolution and where the eye lands; at each joint, whether the object reads as one body in every frame; and for each sound, which visible object produces it. Ask for coordinates, a ranked list, no praise, and which scene a viewer would say "wait" at first.

Treat its **observations** as findings and its **explanations** as hypotheses. It will correctly see moving objects running over the things they should pass behind and wrongly blame screen-aligned streaks, when the cause is an extrusion drawn over the surface. It will report "nothing is moving" when the objects move 87–184 units per sample but are camouflaged by static background dots of the same size and brightness — the observation real, the cause not. It will read an approach as inflation ("it scales 2.5× while the background scales 1.25×") when that ratio is exactly what approaching looks like. It will call an appendage frozen when your sampling aliased with its beat.

And it will find, in one look, the thing you magnified and declared clean. The author is the worst reviewer of their own work; the fresh reviewer is the worst explainer of it.

## Output

A short findings list, most severe first, each with: the pass that caught it, the one-line reality statement, and the fix. State plainly whether the piece is all right, and list the reviewer claims you checked and dismissed, with evidence. Then, if asked, apply fixes and re-run only the passes that touched changed things. Do not claim to have "watched" or "listened" — say frames were sampled and audio was measured.

**A fix can introduce a defect, and it will be one you stop looking at.** An expanding ring added to fix a sound-sync lag became a stray ellipse crossing the subject's back; when a reviewer reported it, the first attempt fixed the wrong object — a nearby detail on the same body — because that was the object already in mind. A pad added to make a piece feel composed became the continuous noise the listener had been reporting. After every fix, re-run the pass that owns the *area*, not the pass that owns the *bug* — and put any new always-on element through 2h before calling it an improvement.

**Patch scripts fail silently and at a distance. Write the file BEFORE reporting.** A script that asserts on a stale match string raises before its write call, prints every success message it reached, and saves nothing — the same failure happened three times in one session, and each time the verification that followed ran against the unchanged file and reported the fix as ineffective. Apply what matches, write, then list what missed. And after each stage: parse the source, LOAD it and check for runtime errors, then re-run the scan; an injected separator swallowed by a trailing line comment reports its error three hundred lines from the cause.

## Division of labour

The user has ears and sees motion at full speed; you do not. Their "that sound doesn't belong", "the overall eye is off" or "the neck looks cut" is data you cannot generate — ask for it after the passes, not instead of them. Translate whatever they say into a measurement: "muffled" → the 4–10 kHz band; "grating" → density, buffer variety, roughness; "that sound disappeared" → masking; "nothing on my phone" → the small-speaker test; **"a constant hiss / like a vacuum cleaner" → the silence measurement and per-component mute of 2h, then bed flatness and relief in 2i**; "it never stops but changes every scene" → one element spanning scenes, found by partial removal; **"the details aren't good" → the per-frame scan of Pass 1b, then the timing vocabulary of Pass 1c**; **"the joins between shots feel off / it was one size and became another" → the cut table of Pass 1d**.

When you cannot localise a fault by measurement, **build the A/B for them**: remove the suspect from some scenes, leave it in others, ship it, and ask which scenes still have it. That is not giving up — it is using the one instrument you do not have.

**When the user reports a fault you have already "verified" as fine, they are right and your check was wrong.** Do not re-run the check that passed; find the check you never ran. A facing test that passes says nothing about whether the front leads; a source-line test that passes says nothing about whether the source was on screen at that instant; a per-scene level table says nothing about what plays in every scene at once; and a dozen sampled frames say nothing about the four hundred you never rendered. Restate their complaint as a measurement and print the numbers.