---
handoff:      2026-09-23-0119--every-quirk-decided-and-the-crowd-is-built
written:      2026-09-23 01:19 -0400
sessionStart: 2026-09-22 ~21:30 -0400
sessionId:    c62c201f-890b-424f-92c4-ff469cab8d88
branch:       arena/champion-capture — PUSHED through 3436cc3 (github was reachable
              again; the previous session's 28 unpushed commits went up first).
              Re-measure: `git fetch github && git log --oneline github/arena/champion-capture..HEAD`
commits:      7d4338a..HEAD (20 at this checkpoint, plus this file's commit)
suite:        2781 / 2780 pass / 0 fail / 1 skipped at 951047e (the main-tree
              profile). RE-MEASURE BY EXIT CODE after your own commit.
agentRuns:    wf_1fd20cb2-c69 (16 investigators + 59 refuters, 0 dead),
              wf_d79fd121-ad6 (3 derivers + 15 refuters, 0 dead),
              wf_82412b65-669 (5 map verifiers), wf_5ebc1117-521 (2 derivers +
              10 refuters, 0 dead); ~20 worktree implementers, ~6 write-nothing
              verifiers/checkers; ~20 pinned Codex reviews (gpt-6-astra).
status:       MID-SESSION CHECKPOINT — three implementers were still running when
              this was written (see "In flight"). If a later handoff exists, it
              supersedes this one.
supersedes:   2026-09-22-1934--every-spell-but-rejuvenate-and-the-build-plays-favourites.md
              — its ranked item 1 (five owner decisions) is CLOSED, items 3 and
              4 are CLOSED, item 6 (push) is DONE; items 2 (browser) and 5
              (capture wrapper, Windows) are unchanged.
---

# Every quirk is decided, and the crowd is built

## The one-sentence version

The owner answered every open "reproduce the build's quirk?" question
(thirteen of them, recorded in HANDOFF.md's living head, top block), and
everything those answers unblocked is built, verified and pushed: rejuvenate,
the four stat spells (with the engine's first in-battle stat write), the
bearer's-turn buff tick, the crowd economy (one crowd per battle, adulation,
wincrowd, the purse), the adapter writing stats and crowd back, and a
`BATTLE_STATE_VERSION` that finally sees the top-level state.

## Read first

- **HANDOFF.md living head, the top block "THE OWNER DECIDED EVERY OPEN…".**
  Thirteen decisions. The rule they make: *reproduce the build where every
  combatant is treated alike; where the build treats hero and villain
  differently, the hero's rule is the player's rule for everyone; where the
  build's behaviour is an artefact of frame timing, don't reproduce it.*
- **docs/integration/ss2-battle-map.md** now carries three new sections — "The
  arena wall", "When the villain decides, and from which distance", "The crowd
  economy" — written from refuter-verified findings only and checked twice
  (958e5b0's message describes the verification).

## What is done (commit, one line each)

- 97f10db — extract-screens clips leaves under an enclosing sprite's mask (5
  real leaves: splash, new_or_continue, armoury); 3ba74bc's message claim was false.
- 8b9222d — ghost strike's back-attack bonus judged from the post-teleport landing.
- 611094d — owner's bearer's-turn tick rule (`timed_spell_tick_owed`).
- 8ff985d — cast_rejuvinate (owner: shoulderguard from its own backup); Codex
  found a stale-defence defect on resumed records, fixed (`ss2PieceDefence`).
- d551c57 — the four stat spells + `EffectKind.STAT` + `rules.openingResources`;
  three Codex passes, three real findings, all fixed.
- 8d6b968 — a drawn bow makes a lost shield cost 0, as the build prices it.
- 77e3f7b — wall/command/teleport/molten-death comments corrected at their sites.
- f64ffea, 0298fb2 — render families for rejuvinate, colossus, little_fat_kid
  (trimmed to the 17 frames the build plays) and the six wincrowd clips.
- cefaf83 — the crowd economy: battle-level resource bag
  (`EffectKind.BATTLE_RESOURCE`, `rules.openingBattleResources`), every verb's
  crowd delta, cast_adulation, the purse (pure functions). **All 23 golden
  replay hashes and 5 pins moved BY DESIGN; the crowd proven the only cause.**
- 958e5b0, 0c90ab7 — the verified map.
- 69873a2 — `BATTLE_STATE_VERSION` covers the top-level keys
  (573176825 → 2858363730); **all 23 golden hashes and 12 pins moved again, the
  version proven the only cause.** Take a fresh census baseline from HEAD.
- 0cb8f78 — the adapter writes stats and the crowd back (two new
  provenance-checked sources, a `_global` write target).
- 951047e — wincrowd as a verb (actor's own charisma; deterministic clip pick;
  the AI never takes it — being changed, see below).
- living-head commits: db063e2, e8ccdcf, c8f015d, 9e98156, 3436cc3.

## In flight at this checkpoint (worktrees under .claude/worktrees/)

1. **Remove psyche_up in bow mode.** Verified (wf_5ebc1117-521, `psyche-menu`,
   F2-F5 CONFIRMED): the build's archer menus (overlay frames 20/28) hide Psyche
   Up at EVERY level — the `herolevel < 3` If skips only the wincrowd hide — and
   the build's villain only charges in melee. The engine's `ss2InBowMode ? 3 : 7`
   gate, the map (~247-251, ~1770), capture-staging docs, test comments and the
   aiCharges notes all rest on the misreading. **The capture wrapper
   (tools/runtime-capture/ss2-capture-wrapper.as ~334-343) is also wrong and was
   deliberately NOT edited — it needs validate-vehicle.ps1 on Windows.**
2. **Let ss2Combatant build the tournament bosses.** Dantus and Sandalphon
   (`unleash_hell` which_boss 4/16) are refused by the hero's shop speed gate.
3. **The AI values the purse** (owner, 2026-09-23): an authored, tunable
   valuation so the AI plays to the crowd when safely out of range and ahead.

Each is to be reviewed, Codex-reviewed, censused and merged by the main session.

## Open, not started

- **Menu-slot visibility may be sticky** (wf_5ebc1117-521 overflow): the eight
  option slots are placed once on overlay frame 1 and nothing ever sets them
  visible again. If the instances survive the round's backward
  `gotoAndPlay("initialise")`, a Psyche Up hidden on an archer turn stays hidden
  on later warrior turns. Needs the PlaceObject/RemoveObject tags or a capture.
- **The crowd_bar's `RandomNumber(1000)` per tick** at crowd > 70 or < 20
  consumes the opcode RNG during fights (presentation; relevant to tape alignment).
- **Colossus's 2 px/tick drift** is deferred (named, pinned as not moving).
- **Wall-cut routes, the stale villain distance, the split-bow bosses**: decided
  NOT reproduced; recorded as named divergences.
- Items 2 (the browser: look at tonight's animations — fireball, teleport,
  drink, bolt, rejuvenate, colossus, the fat kid, wincrowd) and 5 (the capture
  wrapper: `spell_*` staging, and now the archer psyche gate) of the previous
  handoff are unchanged and remain the owner's / a Windows session's.
- ~40 stale agent worktrees sit under .claude/worktrees/ from this and earlier
  sessions; their work is merged. Remove them when convenient.

## Things I got wrong

- **I applied a diff to the main tree while the full suite was running on it**,
  so that run reported 57 failures that were conflict markers appearing
  mid-run. The run was invalid; 8ff985d was re-verified in a separate worktree
  (2633 pass; its one failure was my own symlinked `assets/`, which
  `git check-ignore` cannot see through). **Rule: never touch a tree under a
  running suite.**
- Two miscounts reported to the owner: "17 investigators" (there were 16) and
  "41 map defects" (there were 40). Arithmetic, not lost agents.
- `rm -rf assets` in a scratch worktree deleted the tracked assets/README.md
  there; restored before anything was committed.
- git's 3-way merge (myers AND histogram) stitched two independent resolver
  branches (rejuvenate, the stat spells) through their shared lines. Rebuilt
  from each branch WHOLE — the previous handoff's hard rule held.

## Hard rules (new tonight)

- **A golden's replay hash is pinned nowhere** (tools/golden-hash-census.mjs
  header): moving it edits no golden. Measure it, prove the cause by reverting
  the one change, explain it in the commit.
- **Every Codex finding tonight was real** (rejuvenate ×1, stat spells ×3).
  Keep running it per diff; two to three passes is normal.
- **Write-nothing verifiers overturned both a writer and, twice, another
  verifier** (map #13, #17). Verification of verification pays.
