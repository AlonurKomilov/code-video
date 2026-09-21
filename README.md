# Qalam

A 14.6-second film. No image, no mesh, no video, no texture — every frame is
computed from a distance field, and the whole thing is one HTML file.

```
src/
  geo.frag          pass one: march, measure, write a G-buffer. Decides nothing.
  comp.frag         pass two: decide. Cel bands, drawn line, paper, snow.
  characters/*.json a character, as a document
  sheet.mjs         the exposure sheet — holds, cycle, travel
  shots.mjs         the shot list — every camera, and the authored subject scale
tools/
  build.mjs         characters -> GLSL
  mkfilm.py         everything -> one page
test/
  lib.mjs           the harness
  checks-sheet.mjs  checks that need no browser
  checks-render.mjs checks that need the renderer
  run.mjs           npm run audit
```

## Build

```sh
npm install && npx playwright install chromium
npm run build      # -> build/oq-kocha.html
npm run audit      # 16 checks
```

## Why two passes

A drawn line and a painted light-to-shadow edge both need to see the **neighbouring
pixel**. A fragment shader cannot. So pass one only measures the surface — light,
occlusion, rim, distance, normal, material — and pass two, which can read
neighbours, makes every decision about how it looks.

## Why a character is a document

Nothing about the hooded man is in the shader and nothing about GLSL is in his
file. The second character cost no code at all. The proof that the move was
faithful is in `equiv.mjs`: the generated shader and the hand-written one it
replaced differ by **0 of 392,000 pixels**.

## Every check ships with the case that proves it works

This is the part worth copying.

A threshold that has never been shown to **fail** on a known-bad input is not a
measurement, it is a number. The harness therefore takes two functions, not one:
`measure` and `calibrate`. If the deliberately broken input also passes, the check
is reported `UNPROVEN` and the build fails — the check itself is the defect.

It is not theoretical. Building this, four separate metrics passed happily while
the thing they watched was broken:

| the metric | what it said | what was true |
|---|---|---|
| aggregate foot drift | "SLIDING" | the code was right, the metric averaged across stances |
| whole-frame pixel diff | "on twos is working" | it was measuring 1,150 snow flakes, not the character |
| bounding-box height | "the close-up got smaller" | it saturates on crop; it measures framing, not the subject |
| dark-pixel fraction | "the shot is full" | the shot was empty; a wall is darker than two men |

And once the harness existed it immediately caught a fifth: `model-sheet` passed
with a limit so loose that an 8% rubber limb passed too.

```
  CHECK               RESULT        MEASURED        KNOWN-BAD
  foot-plant          PASS             2.22e-16           0.106 body-heights
  model-sheet         PASS                4.386           7.926 % of limb length
  cut-sizes           PASS                0.000           1.000 JUMP cuts
  determinism         PASS                0.000           0.010 fraction of pixels
  street-fold         PASS                0.000           0.077 fraction of pixels
  street-cost         PASS                0.902           2.532 x time for 7.6x buildings
  line-art            PASS               10.079           0.000 ink valley, levels
  occupancy/*         PASS                             8 shots
```

## Notes on the technique

**The world steps when the drawing steps.** Distance is a step function of the
exposure sheet, not a velocity. A constant speed under a 3·2·1·2 timing chart slides
the planted foot by a tenth of a body height every stride.

**A street is one building.** Space folds under it with `mod`, the cell index is
hashed for height, width and setback. 7.6× more buildings costs 0.99× the time. The
fold breaks the distance bound at a cell wall, so the neighbouring cells must be
evaluated — omitting them tears 7.2% of the frame.

**The line belongs to the form in front.** Drawn on both sides of a boundary it is
a two-pixel band that covers the value step it was meant to describe.

**The depth edge must be judged against the surface's slope.** A plane seen nearly
edge-on changes depth fast from pixel to pixel; that is geometry, not an edge.

**An eye is not geometry.** The face is a decal evaluated once at the hit, in a
frame taken from the surface normal, so it wraps instead of being projected flat.

**Do not decode one value in two places.** `mat` moved to a new divisor; the
neighbour's `m2` did not. Every pixel then compared 3 against 1.5 and the line was
drawn over 99.3% of the face. Invisible by eye — the face just looked dark.
