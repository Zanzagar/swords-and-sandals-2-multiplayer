---
handoff:      2026-09-13-1145--the-gladiator-is-dressed-and-the-shell-has-a-seam
written:      2026-09-13 11:45 -0400
sessionId:    cc273a6b-2487-427e-99ee-afcb84b34564 (https://claude.ai/code/session_015UxWyxsPP49dNY3V3Jhe7b)
branch:       arena/champion-capture. **Measure the push count yourself, AFTER
              your own handoff commit:**
              `git fetch github && git log --oneline github/arena/champion-capture..HEAD | wc -l`
commits:      615a852..675b63a (20 before this handoff), all pushed.
suite:        1092 / 1091 / 0 / 1 (fresh-clone profile), measured after
              `675b63a`. **Re-measure; never copy.**
agentRuns:    wf_5d6fa8dd-892 — question-fanout wave, 6+6, 12/12 returned, 0 dead.
              wf_e1c5ac94-f5c — mutation audit, 20 agents in worktrees, 20/20
              returned, 17 applied, 15 caught, **2 SURVIVED**.
supersedes:   2026-09-13-0235--the-wardrobe-was-in-the-linkage-table-all-along.
              **Its ranked items 1, 2 and 3 are all DONE.**
next:         **RANGED — and it is the owner's.** Read
              `docs/handoffs/RANGED-BRIEF.md`, which was written for exactly
              that and is not superseded by this file.
---
# Handoff — the gladiator is dressed, and the shell has a seam

## The one-sentence version

The arena draws the build's own gladiator wearing his own armour, a 2v1 now
pincers where it never once did, all 44 morph shapes render, and a mutation
audit found that the entire dressing path was code no test had ever executed.

## THE NEXT THING IS RANGED AND IT HAS ITS OWN BRIEF

**`docs/handoffs/RANGED-BRIEF.md`.** The owner kept it deliberately for a
session he is awake for. It carries the derivation so the next agent does not
repeat it, the four questions that are his rather than an agent's, and the one
thing not to do — **the module refuses a bow at construction and that refusal is
CORRECT**; clamping the range to silence it grants melee at 4,400 units.

**Everything presentational for ranged is already built**: `bombard` is a
23-frame animation and `snipe` a 19-frame one, both extracted, both bound to
sound, both already mapped by `clip-labels.js`; nine bow art ids are in the
wardrobe. **The work is the resolver's alone.**

## What landed, twenty commits

**Art.** The renderer prefers the extracted rig with `figure.js` as the
fallback, per FAMILY not per session. **387 wardrobe pieces across 12 slots**
attach by the build's own table. All 44 morphs parse and **290 baked frames**
render — they are the blood in the death animations.

**Combat.** A flanking arm: an outnumbering side goes round a foe an ally is
already fighting. **Pincered 0% -> 17.8%, crossings 0% -> 16.9%, 24/24 still
settle, and simultaneous fights rose from 273 turns to 413.**

**Infrastructure.** `src/render/arena-shell.js` is a test seam for the browser
shell. `--host 0.0.0.0` on the arena server. `clip-labels.js` is the single
family-to-clip-label join, shared by sound and art.

## THE LESSON, and it is the reason the mutation audit was worth twenty agents

**A GREEN SUITE SAID NOTHING ABOUT THE CODE I HAD JUST WRITTEN.**

Twenty agents broke one line each and ran the suite. 15 of 17 applied mutations
went red. **Both survivors were in the dressing path — and the cause was not
under-assertion, it was that the code had never been executed at all.** One
agent instrumented it and measured rather than inferring:
`paintExtractedFigure` is called NINE times across the whole suite and every one
passes no wardrobe, no loadout and no limbs.

► **AND THE TEST THAT LOOKED LIKE COVERAGE WAS NOT.** "the attachment table is
  the BUILD'S" asserts `helmet.depth === hair.depth` on the DATA TABLE — the
  fact the suppression rule is derived from, never the rule — so it passed
  unchanged with the rule deleted. **I wrote it believing it covered the
  behaviour.**

**Five tests added, including a POSITIVE CONTROL that asserts attached ops exist
at all**, so if the loop ever goes dark again the tests beside it fail loudly
instead of passing vacuously.

## What the OWNER found by playing it, which is five things no test reached

1. **Sounds cut off** — one `Audio` element per file. And the build SHARES
   files across labels: **`706.mp3` is bound to FIVE.**
2. **Sounds not starting** — autoplay is blocked until the page is touched and
   spectate never touches it; the rejection was caught and discarded.
3. **A blank preview** — it `fetch`ed its data, which a `file://` page may not.
4. **A 2v1 that would not flank** — 208 outnumbered turns, 100% same-side.
5. **The arena would not load** — see the server note below.

## HOW TO RUN IT — the server note matters

```
node tools/arena-server.mjs --host 0.0.0.0    # then the address the banner prints
node tools/extract-figure.mjs                 # the rig + morphs
node tools/extract-wardrobe.mjs               # 387 pieces
node tools/engagement-census.mjs              # defaults to the SHIPPED stride
```

► **DO NOT USE `127.0.0.1` FROM A WINDOWS BROWSER.** WSL2's localhost
  forwarding on this machine is **INTERMITTENT** — headless Chrome reached it at
  01:05 and timed out at 03:30 with nothing changed between. **Three sessions
  called this server healthy on the strength of `curl` from inside WSL**, the
  one place it was always going to work. `preview.html` is unaffected: it is
  self-contained, and that is why.

## Highest-value work, ranked

1. **RANGED. See `RANGED-BRIEF.md`. It is the owner's.**
2. **Nobody has watched the rig MOVE or heard the sound since the fixes.**
   Stills capture here; animation does not. A tween wrong only between keyframes
   would survive every check made so far.
3. **`tools/arena/main.js` still has no test reach beyond the four decisions
   moved out.** The draw dispatch, the autoplay handling and the rAF loop remain
   unreachable, and this file has now given up SIX live defects in two days.
4. **The wardrobe is not animated.** 21 pieces have more than one frame and
   frame 1 is taken; the weapon's 13 frames are enchantments, so the others may
   be too.
5. **`features` has 19 symbols for ids 1..24** — five ids have no art and
   nothing explains the gap.
6. **OWNER: the projection version bump.** Still the only decision open, still
   free, now the fourth format change under a constant version.

## What is NOT verified

- **31 of the wave's 37 claims were never verified** (budget 6), and two of six
  verifiers came back PARTIALLY-BROKEN.
- **The per-piece attach offsets are derived from ONE routine.** Only the shield
  and the weapon carry one; fifteen pieces attach at the limb origin. If a piece
  ever looks misplaced, that is the first assumption to re-check.
- **`death:slain`, `death:yield`, `death:arrow`, `death:grievous` map to no
  clip** and fall back to `death1`. Only `death:taunt` is derived.
- **Every asset number came from ONE install.**
- Everything the 02:35 brief lists as unverified that is not named above.

## Hard rules

- **A GREEN SUITE IS NOT COVERAGE.** Two mutants survived in code no test
  executed. Run the audit again after any substantial render change.
- **A test that asserts a rule's INPUT is not a test of the rule.**
- **An empty slot may mean you are looking at the wrong slot.**
- **`grep` IS NOT A GATE.** I piped the suite through `grep` and committed on
  `fail 2`, because grep succeeds when it matches. **Use the exit code:**
  `node --test --test-concurrency=1 > log 2>&1; [ $? -eq 0 ] || stop`.
- **Do not reach for `git add -A` while agents are running.** It staged
  seventeen worktree gitlinks and I pushed them. `.claude/worktrees/` is
  ignored now, but the ignore rule only covers the directory we know about.
- **Every backtick inside `previewHtml` is live.** It is a template literal
  holding JavaScript holding comments, and it has broken the file twice.
- **LOOK AT IT.** Every defect the owner found, and the wedges, and the blank
  arena after the seam, were found by looking.
- **Ship no SS2 asset.** `assets/` is gitignored AND
  `test/asset-attestation.test.js` fails if anything under it is tracked.
- **Push a feature branch without asking**; `main`/`master` and every force flag
  stay DENIED.
- **A handoff commit is not finished until the suite is green BY EXIT CODE, and
  its suite and push lines must be measured AFTER that commit.**
