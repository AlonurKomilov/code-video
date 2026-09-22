---
name: "code-audit-structure-scale"
description: "Decide whether a generated artifact that has grown large needs restructuring, and how, by MEASURING rather than naming a pattern: blast radius, a synthetic scale test, and the separation of machine cost from authoring cost. Returns a tiered answer, then restructures and proves the behaviour did not change against measured run-to-run variance."
---

# Code Audit — structure at scale

> **`abc` skill family · `code-audit-structure-scale` v1.0.0** — domain `code` · kind `audit` · method `structure` · scope `scale`
> Source of truth: <https://github.com/AlonurKomilov/skills> (ABC LEGACY LLC).
> Naming follows `{domain}-{kind}-{method}-{scope}`; `validate.sh` in that repo is the gate.

Sibling of `media-audit-reality`. That skill checks whether the OUTPUT is
true; this one checks whether the SOURCE can still be worked on.

The failure this skill prevents is judging architecture from what is in
front of you today. A structure that is fine at 8 units and impossible at
400 looks identical at 8 — the defect is already fully present, it just
does not hurt yet. Conversely, a structure that *feels* bloated may scale
perfectly, and restructuring it costs real properties (a single file runs
with no build step, no server and no network) for nothing.

**The rule that governs this skill:** do not diagnose architecture from a
pattern name or from how the file feels to read. Every claim here is a
number you can print. If you have not measured blast radius and run a
synthetic scale test, you do not have an opinion — you have a preference.

Default mode is **report first**: measure, give the tiered answer, and
restructure only when the user asks.

## Pass 0 — Name the smell correctly, because the fix differs

Pattern names are load-bearing. Check the definition against the code
before accepting or rejecting one.

| Name | Definition | Fix it implies |
|---|---|---|
| God Object | one object holds most of the STATE *and* most of the BEHAVIOUR; others are dumb data it operates on | extract responsibilities into collaborators |
| Long unit | size alone, no coupling claim | split the unit |
| Coupling by index | several parallel collections that must stay in the same order, nothing enforcing it | fold them into one record per unit |
| Ambient state | per-unit mutable state at module scope instead of inside its unit | move state into the unit it belongs to |

A measured case: a user called an 1,175-line artifact a God Object.
Measured, it was 8 peer objects behind one identical interface,
dispatched by a loop that knew nothing about them — that is a strategy
table, not a God Object, and the invariants held in all 8. The user's
instinct was right and the name was wrong, and the actual defect (six
collections coupled by index) had a completely different fix from the one
"God Object" implies.

**Say both things: concede the instinct, correct the name.** Agreeing with
a wrong name leads to a refactor that does not remove the defect.

## Pass 1 — Blast radius, the metric that decides

For **one representative logical change** — change unit 4, change the rule
for tier 2 — list every site you must touch and print the line numbers.

```
N=8                          N=470
body()          427          body()          897
state            113         state            113
collection A     869         collection A   39846
collection B     871         collection B   39848
collection C    1030         collection C   40008
collection D    1074         collection D   40053
-> 6 sites, span 961 (82% of file)   |   6 sites, span 39,940 (99.5%)
```

Report **count of sites** and **span between the farthest two**, as a
fraction of the file. The number that matters is not the file's line
count — it is this.

**The finding to look for:** the blast radius was already the whole file at
N=8. Scale did not create the defect; it removed the ability to get away
with it. When you can hold the whole file at once, a whole-file blast
radius is invisible — which is exactly why neither the author nor an agent
notices it at small N: at small N you read the whole file every time
anyway.

After restructuring, print the same measurement. The case above went from
6 sites spanning 961 lines to **1 site spanning 110**.

## Pass 2 — Synthetic scale test: multiply the unit and measure

Do not predict what breaks at scale. Build it and look.

1. Identify the **unit of growth** — the thing that gets added when the
   work gets bigger.
2. Mechanically replicate it to roughly 10×, 25× and 50× the current
   count, uniquifying identifiers so it still parses.
3. Load each build and measure: parse + init, memory, per-tick time,
   errors.

Measured, 8 → 470 units (~59× the output length):

| units | size | lines | parse+init | heap | per tick |
|---|---|---|---|---|---|
| 8 | 70 KB | 1,175 | 229 ms | 10 MB | 33.3 ms |
| 50 | 285 KB | 4,731 | 135 ms | 10 MB | 32.9 ms |
| 200 | 1.0 MB | 17,362 | 148 ms | 10 MB | 33.4 ms |
| 470 | 2.4 MB | 40,154 | 238 ms | 10 MB | 33.9 ms |

**Flat.** Because only the active unit is touched per tick, runtime does
not care how many exist. Had this been asserted instead of measured, the
recommendation would have been wrong and confidently so — and the real
reason to restructure was somewhere else entirely.

**The generator is code and will have bugs — verify the synthetic build
RUNS before trusting its numbers.** Two real ones, each of which produced
a file that parsed and looked fine:

- A temporal-dead-zone error: a hoisted-looking `const` built from another
  `const` declared later in the file. Only the page's runtime error
  handler caught it; static parsing passed.
- Splitting a bracket-matched collection on top-level commas without
  skipping comments: an apostrophe inside a `//` comment opened a fake
  string literal and swallowed the next two entries. The extractor
  reported 7 of 8 and nothing complained.

Always **assert the expected unit count** after extraction, and check the
synthetic build for *runtime* errors, not only that it parses.

## Pass 3 — Machine cost and authoring cost are different problems

State which one you are solving. They usually diverge, and most
architecture arguments are two people solving different ones.

- **Machine cost** — parse, memory, per-tick, bundle size, and any hard
  ceiling the delivery target imposes. Check the ceiling: 2.4 MB at 470
  units was still far inside a 16 MB limit, so size was never the wall.
- **Authoring cost** — how much of the source must be held at once, by one
  person or one context window, to make one safe change.

In the measured case the machine was flat at 59× and the authoring cost
was the wall. "It will get slow" would have been false; "no one can edit
this" was true. **Never justify a restructure with the cost you did not
measure.**

## Pass 4 — The answer is tiered by N, and at large N it is not file-splitting

Give the tier, not a single recommendation:

- **Small N (≲30 units)** — collapse the coupling **in place**. Each unit
  carries its own configuration and its own state. One file, no build
  step, no lost properties. This is almost always the first move, and it
  is the one that removes the defect.
- **Medium N (~30–100)** — units become separate files. Worth it only once
  several people, or several sessions, edit in parallel. **Price the split
  before recommending it:** a module system may not load from the delivery
  target the artifact actually ships to, in which case a single-file
  deliverable now needs a build step or a host that serves companion
  files. Losing "it just runs" is a real cost.
- **Large N (hundreds)** — nobody hand-writes hundreds of units, so file
  layout is the wrong question. The **representation** changes: a few
  parameterised unit *types* driven by a data table. No file arrangement
  makes hand-authoring at that count work.

**Say plainly when the request implies a tier the current structure should
not even start in.** If asked for an output 50× the current size, the
honest answer is that the representation must change first — not that you
will begin and split later.

## Pass 5 — A restructure is behaviour-neutral or it is not a restructure

Capture the baseline **before** touching anything (`cp source source.pre`)
and compare after against **measured run-to-run variance**, never against a
single run.

One metric measured 0.055, 0.057, 0.076 and 0.122 across separate runs of
*identical* code, because the work contained probabilistic elements. A
one-run before/after comparison would have reported a 2× regression that
did not exist. **Take the median of 3+ runs on each side and declare the
noise floor before reading any delta.**

Verify all of: no new errors; identical unit count and duration; output
metrics within variance; and a rendered or printed sample of every unit,
not a spot check.

## Pass 6 — Moving things is when dead things become visible

A restructure is the cheapest moment to find code that runs for nothing.
Look specifically for:

- **Configuration collections that are entirely default.** An all-zero or
  all-identical config array is a signal that the thing it configures may
  be dead. In the measured case a feature had been removed but its whole
  construction survived: two long-lived source objects started for the
  life of the process, plus three parameter writes **every tick** to hold
  a disabled state in place. Nothing failed, nothing logged, and it cost
  every frame.
- **Debug hooks that shipped.** A toggle written to A/B one unit during an
  earlier audit was still present in the published artifact. Grep for your
  own diagnostic identifiers before shipping; they belong in the test
  harness.
- **Event keys with zero writers or zero readers.** One key was declared,
  never incremented, never read. **Count both sides per key and print the
  table** — an event bus that is a naming convention will not tell you.

## Pass 7 — Mechanical edits are verified at every stage, not at the end

A scripted refactor fails silently and at a distance. After **each** stage:
parse the source, then load or execute it and check for runtime errors,
then run the full test. Two stages of one refactor broke parsing, and the
error message pointed at a line 300 away from the cause — a trailing line
comment that swallowed an injected separator:

```js
...;}}  // a trailing comment,    // <- the separator is inside the comment
```

When injecting into code that ends in line comments, place the separator
**before** the comment, not after it.

## Pass 8 — What this cannot tell you

Blast radius, scale behaviour, dead code and neutrality are all
measurable, and this skill measures them. These are not: whether the
chosen decomposition matches how the team thinks about the domain;
whether the naming is good; whether the abstraction will still fit the
next three features. A clean table here means the structure is
**workable**, not that it is **right**. Say so rather than implying
otherwise.

## Output

Lead with the measurement, not the verdict:

1. The corrected name of the smell, with the definition it fails or meets.
2. Blast radius before — sites, span, fraction of file.
3. The synthetic scale table.
4. Which cost is the binding one, machine or authoring.
5. The tier, and what it implies for what was asked.
6. After restructuring: blast radius after, plus the neutrality evidence
   with its noise floor stated.

If the user's diagnosis was wrong but their instinct was right, say both,
in that order. A user who can feel a structural problem without being able
to name it has given you real data; dismissing it because the name was
wrong is the same error as accepting it because the name sounded right.