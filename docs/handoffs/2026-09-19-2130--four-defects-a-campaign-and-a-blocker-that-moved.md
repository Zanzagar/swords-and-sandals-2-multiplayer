---
handoff:      2026-09-19-2130--four-defects-a-campaign-and-a-blocker-that-moved
written:      2026-09-19 21:30 -0400
sessionId:    164a0c3b-cf56-4192-b312-5791620299e0
branch:       arena/champion-capture. **Measure the push count yourself, AFTER
              your own handoff commit:**
              `git fetch github && git log --oneline github/arena/champion-capture..HEAD | wc -l`
commits:      `4a444fe..HEAD`. **Re-measure with `git log --oneline`.**
suite:        **Re-measure BY EXIT CODE after your own commit.** `fail == 0` and
              the exit code are the gate. **2098 / fail 0 / skipped 1, exit 0.**
              Against 2035 at the start of the day.
agentRuns:    **NONE.** No fan-out wave, no subagents. TWO Codex adversarial
              reviews (`gpt-6-astra`, model pinned): the first approved the
              taunt diff; **the second came back `needs-attention` with four
              findings, three high, all four real.**
supersedes:   2026-09-19-1500--four-ranked-items-and-three-broken-premises.md
next:         **RANKED BELOW. One item is a schema decision with a measured
              blast radius and should be the next session's whole job.**
---

# Handoff — four defects, a campaign that persists, and a blocker that moved

## The one-sentence version

The campaign layer got the host it never had and `shove` got built, but the
thing to carry forward is that **a Codex review of thirteen commits I had
already pushed came back with four real defects, three of them high** — and one
was a defect class the owner found by watching three weeks ago, reintroduced.

## WHAT IS DONE

► **A CAMPAIGN SURVIVES THE PROCESS.** `src/campaign/file-backend.js` +
  `tools/arena-campaign.mjs`. The layer had been built for persistence since it
  was written — `CampaignStore` always took an injected backend — and shipped
  two implementations, a `Map` and fields on a live save object, **neither of
  which survives a reboot.** The state is the records: a campaign IS its
  sequence of battle records, rebuilt by `rosterFromCampaignRecord`.
► **`shove` IS BUILT**, and takes no RNG sample — phase derived from the oracle
  because the map carried two rows and not the phase.
► **THE AI TAUNTS AT RANGE AND JOINS ITS ALLY'S FIGHT.** `aiTaunts` (on) and
  `rankJoinSurplus: 0` (owner's call on a sweep).
► **THE ARCHIVE MANIFEST ATTESTS ALL 8,325 FILES**, after attesting 1,588 for
  eighteen days.
► **THREE SHELL DECISIONS LEFT THE DOM SET** — `canvasBackingFor`,
  `settlementReadiness`, `groupPaintReadout`.

## THE FOUR DEFECTS A REVIEW FOUND IN PUSHED CODE — read this first

I ran Codex once, on the taunt diff, then shipped **13 more commits / 1,666
lines** without running it again. Every finding was re-derived before anything
was touched. All four confirmed:

1. **THE CLI FOUGHT GLADIATORS THAT WERE NOT THE DEMO ROSTER'S.**
   `demoSide().members` went straight to `createTeamBattle` — the browser host's
   shape, no canonical stats. **`red-1` entered as strength 5/5/5 with 140 max
   health** against the roster's 9/7/8 and 46. Every campaign bout run before
   the fix persisted a record describing the wrong fighters. **This repository
   already names that exact shape as a past mistake twice over. Third time.**
2. **`shove` WAS OFFERED PER FRAME, NOT PER FOE.** `onCloseFrame` means
   "somebody is in reach", so one nearby enemy unlocked a shove against every
   enemy on the field, any lane, any distance. **That is the cross-lane defect
   the owner found by watching on 2026-09-18**, in a new verb three weeks later.
3. **THE CAMPAIGN COULD SILENTLY ROLL BACK.** An unreadable record got
   `recordedAt` of `""`, which sorts BEFORE every real timestamp, so it landed
   at the front and `history.at(-1)` picked a valid but OLDER bout — while the
   guard read only the last entry.
4. **TWO WRITERS SHARED ONE `.writing` FILE**, justified "because this backend
   is single-process by contract". **A contract nothing checks is a comment.**

And **my fix for (2) broke the close-range archer**, caught by the suite one run
later. Four regression tests, one per finding, each asserting the reproduction.

## Things I got wrong, recorded because the next reader will not

► **I PUBLISHED "the shell is 4,110 lines and not one is executed by a test"**
  in the 04:00 handoff, by repeating it without grepping the test file. **13 of
  its 70 functions ARE executed**, and `src/render/arena-shell.js` has held
  shell decisions since 2026-09-12.
► **I SAID A ROSTER AT LEVEL 7 WOULD LIGHT `psyche_up`.** It does not: 4,753
  offers at level 7, **0 charges**. The binding gate is `survivesTheWindUp`
  (`46 > 51` is false), not `herolevel`. Two gates in series; the published
  cause named the one that is not binding.
► **I RANKED ARITHMETIC DENSITY AS DEFECT RISK.** The densest DOM-bound shell
  function is `drawArenaBowl` (57 expressions) and **a wrong bowl is the most
  visible thing on the screen.** Pick by whether the failure is INVISIBLE.
► **I DEFAULTED THE RANK DIAL TO 0 AND WROTE THAT NOTHING MOVED** (2,234
  decisions → 2,307), **and shipped an id that said `-join-always` while taking
  the OFF path.**
► **AND TWO TEST STAGINGS PASSED WHILE EXERCISING THE WRONG THING** — one
  measured a strength-9 opponent while claiming to measure a weak gladiator; one
  asserted an arena clamp without ever reaching the wall.

## Highest-value work, ranked

1. **DECLARE `inventory1`–`inventory6`, WITH THE GOLDENS IN FRONT OF YOU. This
   should be the whole session.** `use_item` is now derived — **1 is the empty
   marker**, confirmed three ways, and **the marker differs by column** (0 for
   equipment, 1 for inventory). So consumption is "set the slot to 1" and both
   `cast_gale` and `magic_damage_character` are unblocked ON THE BYTES.
   **They are blocked on the ENGINE**: those six fields are absent from
   `SS2_RESOURCE_NAMES` and never reach the resolver. Adding a name WITH a
   default **moves all 23 golden replay hashes** — measured, done once at
   `86ccb68`. Six names without defaults is the `psyche_up` shape and is safer,
   but touches `CANONICAL_RESOURCE_SOURCES`, the adapter write-back and the
   campaign record. **Re-check every golden afterwards rather than assuming.**
   Fix the demo roster's `inventory1: 0` in the same session — 0 is not empty.
2. **RE-DERIVE THE PIXEL NUMBERS.** Everything published before 2026-09-18 went
   through a 300×150 backing store. `canvasBackingFor` is tested now, so the
   instrument is sound; the re-measurement is not done. **Needs a browser — the
   owner's, or a supervised main-session run. No agent launches one.**
3. **THE NONCE RECOVERY APPLY IS THE OWNER'S.** The report runs and reproduces
   byte-identically: waiver 58 → 18, 20 of 23 goldens re-promoted on strictly
   better evidence. The tool has no `--apply` by design. **It rewrites 40
   observation digests — a decision, not a fix.**
4. **RE-TAKE THE `D:` MIRROR.** It holds 1,588 files against an archive of
   8,325 — **19%.** The owner has offered to connect the drive. Check `D:` from
   Windows, never from `/mnt/d`.
5. **`magic_damage_character` (`+0x148e`)** follows item 1 immediately.

## Hard rules

- **RUN THE CODEX REVIEW PER DIFF THAT MATTERS, NOT PER SESSION.** Four defects,
  three high, in code committed, pushed and reported as done. The review costs
  one command. This is the single most valuable line in this file.
- **AN A/B WITH ONE ARM IS AN A.** Run both arms and the control.
- **MEASURE AT THE LAYER THE QUESTION IS ABOUT**, and **state the sample size**:
  the 2-on-1 rate reads 3.1% at 24 bouts and 5.3% at 300.
- **A DEFAULT THAT HAS TO BE ARGUED TO BE A NO-OP IS NOT ONE.**
- **A CONTRACT NOTHING CHECKS IS A COMMENT.**
- **A LOG LINE IS NOT A BEHAVIOUR** — the campaign resume printed "resuming"
  and fought from the opening roster.
- **A TEST THAT STAGES PAST THE ARM IT MEANS TO EXERCISE REPORTS THE WRONG
  FUNCTION GREEN.**
- **AN ID THAT SAYS THE OPPOSITE OF THE BEHAVIOUR IS WORSE THAN NO ID.**
- **PICK EXTRACTIONS BY WHETHER THE FAILURE IS INVISIBLE, not by operator
  count.**
- **DO NOT START A SCHEMA CHANGE YOU CANNOT FINISH AND REVIEW.** Item 1 was left
  unstarted at 75% context on purpose.
- **VERIFY A TOOL IS READ-ONLY BEFORE RUNNING IT** — grep `writeFile`, `mkdir`,
  `rm`.
- **DO NOT USE A TOTAL TEST COUNT AS A GATE** — `fail == 0` and the exit code.
- **NO AGENT LAUNCHES RUFFLE OR A BROWSER, OR TOUCHES THE INSTALLATION.** The
  oracle is `…/Swords and Sandals Classic Collection/swf/swords_sandals2_download.swf`,
  sha256 `77CB545C…`. **The Steam "Redux" build beside it is a DIFFERENT file**
  (`8645A6F5…`) and is not the oracle.
- **Ship no SS2 asset.**
- **Push a feature branch without asking**; `main`/`master` and force flags stay
  DENIED.
- **A handoff commit is not finished until the suite is green BY EXIT CODE, and
  its suite and push lines must be measured AFTER that commit.**
