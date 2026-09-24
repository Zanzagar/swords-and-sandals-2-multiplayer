---
handoff:      2026-09-23-2119--the-arena-draws-what-the-engine-does
written:      2026-09-23 21:19 -0400
sessionStart: 2026-09-22 ~21:30 -0400
sessionId:    c62c201f-890b-424f-92c4-ff469cab8d88
branch:       arena/champion-capture — PUSHED through this file's commit.
              Re-measure: `git fetch github && git log --oneline github/arena/champion-capture..HEAD`
commits:      5817297..HEAD (the mid-session checkpoint's commit onward;
              `git log --oneline 5817297..HEAD`)
suite:        main-tree profile: 0 fail, 1 skipped (the raw-trace archive
              check). A fresh clone / worktree with no assets skips 10 (AGENTS.md,
              corrected this session). RE-MEASURE BY EXIT CODE after your own commit.
agentRuns:    wf_714ed099-08f (arena-bug diagnosis: 4 investigators + 16
              refuters, 0 dead); ~12 worktree implementers after the
              checkpoint (3 of them — taunt, figure size, demo kits — finished
              while the main context was full; see "Things I got wrong");
              pinned Codex reviews (gpt-6-astra) on every merged behaviour
              diff — the figure-size work took SEVEN passes (five on cab600f,
              two on 319dee6), six of them finding something real.
status:       END OF SESSION. Supersedes the same session's mid-session
              checkpoint 2026-09-23-0119.
supersedes:   2026-09-23-0119--every-quirk-decided-and-the-crowd-is-built.md —
              its "In flight" items 1-3 are ALL MERGED (2efddc9, a62e67a,
              bf53d81); its "Open, not started" list carries forward below.
---

# The arena draws what the engine does

## The one-sentence version

The owner watched the arena and reported melee landing out of reach, spells
killing in one hit with no animation, and fighters floating up the wall; a
diagnosis wave proved the ENGINE never landed an out-of-reach swing — every
report was the DRAWING or the demo ROSTER — and every cause it named is
fixed, reviewed and pushed, with the figures now drawn at the build's own
size.

## Read first

- HANDOFF.md living head, the top block: the owner's decisions, now fourteen
  (the own-rank taunt rule added this session).
- `git log 5817297..HEAD` — every commit message names its evidence, its
  pins and whose errors were whose.

## What is done (commit, one line each)

The checkpoint's three in-flight items, merged:
- 2efddc9 — no psyche-up with a bow drawn, at any level (the archer menus
  never show it; the capture wrapper is still wrong, Windows-only).
- a62e67a — the tournament bosses can be built (a weapon never bought is not
  shop-gated).
- bf53d81 — the AI plays to the crowd when safe and ahead (the owner's
  "value the purse").

The arena, so the new spells can be seen and the owner's reports answered:
- 5322ce4 — `?items=` kits; 44839d0 — every kit's holders enter the battle
  host; 731ef20 — no swap offered with no second weapon.
- wf_714ed099-08f diagnosed the owner's "hitting not in melee range / dying
  after one hit with no spell animation / too high". **The engine never
  landed an out-of-reach swing; every report was the drawing or the demo
  roster.** Fixed:
  - 71eb5aa — facing prefers the own rank, re-faces after a kill, turns a
    swinger; whirlwind stays in its rank.
  - 8c1e30a — rear ranks squashed onto the floor; the team camera kept low.
  - 41ced7b — knockback, ghost strike's blink, rank slides and a victim's
    last reaction are drawn where the engine has them.
  - 2690559 — death from above drops the build's own rocks; the bolt and
    explosion land on their victims.
  - b51ad05 — `blasts` is the two level-4 bolts (30-60 action bouts, both
    spells cast and survived in 25/25), `doom` (49) alone, damage-kit
    fighters on the build's own pools, magicka 12, a seed-parity opener;
    the champion secondary-0 workaround removed (it hid boss 12's poison, 61).
  - cab600f — **gladiators at the build's own size** (they were 64.7% of
    it) and every projectile leaving the shooter's drawn head and landing on
    the target's drawn body at any rank; the bombard a continuous
    chord + k·bulge lob over intervening bodies; arrows stop at the drawn
    front. FIVE Codex passes, each real.
  - 319dee6 — the lob clears giants (bosses to `_yscale` 120, generated
    opponents to 242, colossus 150) and is MONOTONE against cab600f by
    construction: 40,500-flight differential sweep, 0 points lower (re-run
    by me); Codex pass 7 approve.
- 3f386d7 — the tournament bosses in the arena, extracted from the player's
  own SWF (`?red=&blue=`).

The owner's own-rank taunt rule:
- b81f3dc — offered and valued only in the taunter's rank; it exposed an AI
  chase to the wall (16 of 25 tricks bouts stalled), fixed in the same commit.
- 69e4217 — the AI prices a taunt at the foe it may taunt. It does NOT bring
  the demo duellist back (roster shape, below).

Docs: 7c56d47 (my missing index row), 221a3ca (a fresh clone skips 10),
213ade7 (stale pack counts, the boulder's depth, ghost strike's blink —
several claims wrong from the day they were written).

## Open, ranked

1. The OWNER looks at the arena (http://127.0.0.1:8123/ via
   `node tools/arena-server.mjs --port 8123`): `?teams=3&items=blasts&spectate=1`,
   `?items=doom`, `?items=tricks`, `?red=2,4,16&blue=1,3,10&spectate=1`.
2. The demo duellist barely taunts in 3v3 — a ROSTER shape (both sides'
   charisma-16 slot 3 open in the same rank; an equal-charisma taunt is worth
   3.84 hp against 11.88 for walking in). The owner's call whether to change
   the demo roster; the engine is right (69e4217).
3. Arena residuals, named in cab600f / 319dee6 / b81f3dc / 69e4217, none
   blocking:
   - a colossus'd target's arrow stop reads its live size while the arena
     draws it at its starting size;
   - a fireball flies flat through anyone in its way (no spell line gate
     found in the build or the resolver — not verified);
   - lob clearance counts only bodies in the rank the arrow is passing
     through, so a cross-rank shot can overlap a body in another rank;
   - a strength-50 archer's UNRAISED arc already peaks above a zoom-80 stage
     (pre-existing, recorded in the stage test);
   - two render-sweep wall cases: a knockback that moves nobody at ±2100 is
     counted as a missing push, and a ghost strike cast facing away from a
     victim at the wall draws the caster inside him — both rare since
     b81f3dc; a refined sweep sits in THIS SESSION'S SCRATCHPAD
     (agents/watchable-kits/render-drawn-refined.test.js), which /tmp may
     not keep;
   - the in-range taunt arm: an archer shooting across ranks gets no taunt
     row even when one is on offer in its own rank (a policy call; the
     implementer's trial moved plain taunts 8 -> 6, tricks 123 -> 150).
4. Carried from the checkpoint: sticky menu-slot visibility; crowd_bar's
   RandomNumber(1000); colossus drift (deferred); the capture wrapper's archer
   psyche gate (~334-343) and `psyche_up: true` rows — Windows +
   validate-vehicle.ps1.
5. Stale counts outside 213ade7's files: tools/extract-props.mjs,
   test/extract-props.test.js, tools/arena/main.js (listed in 213ade7).
6. ~57 agent worktrees under .claude/worktrees/, every one holding an
   UNCOMMITTED diff by design (merges here go by patch), so none can be
   proven merged from outside; `ss2-progression-design` is off-main with 183
   untracked files and is a separate line of work. Remove the agent ones when
   convenient, after a glance.

## Things I got wrong

- **I let the main context overflow while three implementers were
  reporting**, which forced a compaction and printed "Context limit
  reached" under each agent; the owner reasonably read them as failed and
  asked for a rerun. All three had finished (`stop_reason: end_turn`,
  complete reports, artifacts matching). Nothing was rerun. The memory note
  on exactly this existed and was right; the lesson is its "keep the main
  context lean while many agents are out". b81f3dc's message words this as
  though the notices were misread by me; the error that was mine is the
  overflow.
- **319dee6's commit message mis-attributes one number**: "726 cells with
  the floor off" sits inside the sentence about MY re-run of the
  differential sweep. That count is the implementer's; my re-run reproduced
  only the 0 (0 points lower, 0 cells). Pushed, and force-push is denied,
  so it is corrected here.
- I made scratch review worktrees under the repo's own `tmp/`, which showed
  as untracked in the main tree; moved into the scratchpad before any suite
  ran there.
- To export a new file from the figure agent's worktree I briefly marked it
  intent-to-add in that worktree's index while a Codex review was reading
  the tree (reset within the same command; no working file touched). The
  memory rule says not to edit a tree under a review; an index-only change
  still counts.
- A commit-message placeholder did not match my sed, so the first kits
  commit attempt committed nothing (the `&&` chain stopped); caught at once.

## Hard rules (new tonight)

- A Codex pass on NEW code finds new defects: the figure work's passes 1-6
  each found a real one, in code the previous fix had just written. Keep
  reviewing until a pass approves.
- When a fix keeps regressing an edge case, make it MONOTONE against the
  merged version by construction (take the stricter of the two
  requirements) and prove it with a differential sweep against a frozen
  copy of the merged code. That ended the figure loop in one round.
- An implementer's premise is a hypothesis too: "strength 50 is the
  largest body" (figure) and "the AI prices the wrong foe, so the duellist
  stopped taunting" (taunt pricing: half right) were both wrong, and both
  implementers said so prominently.
- A test that reads an internal height the drawing never uses cannot fail
  on the drawing (Codex, pass 3). Assert through the drawing API.
