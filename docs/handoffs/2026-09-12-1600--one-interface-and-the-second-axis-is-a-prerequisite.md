---
handoff:      2026-09-12-1600--one-interface-and-the-second-axis-is-a-prerequisite
written:      2026-09-12 16:00 -0400
sessionId:    9e416f58-ab1f-4d6a-a7cd-ab12d4624e75 (https://claude.ai/code/session_01W2dkgJu2uHRFXSmTVv4f2j)
branch:       arena/champion-capture. **Measure the push count yourself, AFTER
              your own handoff commit:**
              `git fetch github && git log --oneline github/arena/champion-capture..HEAD | wc -l`
suite:        925 / 924 / 0 / 1 (fresh-clone profile), measured after `58366d8`
              and BEFORE this handoff. **Re-measure; never copy.**
supersedes:   2026-09-12-1130--codex-found-what-twelve-agents-missed. Its ranked
              item 1 (LOOK AT THE ARENA) is DONE — the owner looked, twice, and
              what he saw is the whole of this brief.
---
# Handoff — there is exactly one interface, so the second axis is a prerequisite

## The one-sentence version

The owner watched a 3v3 and said it was "super limited" — everyone jumbles into
one melee, with no breakoff fight, no choice between duelling and brawling and
nowhere to stand off and shoot — and the measurement says he is not describing a
tuning problem: **in one dimension the two teams meet at exactly ONE interface,
so a second engagement is geometrically impossible and no AI change can create
one.**

## The reusable lesson

**I guessed twice and measured third, and both guesses were plausible enough to
have been built.**

1. *"The left-to-right order is frozen, so matchups are fixed at the start."*
   FALSE — a walk may not cross a FOE but nothing stops it crossing an ALLY. The
   order reshuffles in 24 of 24 bouts and all nine pairings trade blows.
2. *"Better targeting will spread them out."* A NO-OP — the AI's target picks
   only a DIRECTION; where a walk STOPS is the clamp against the nearest binding
   foe. Three allies park on one line whatever they aim at. I recommended this to
   the owner before measuring it, which was the mistake.
3. What is actually true, and it is stronger than either: **0 turns in 1,682
   where any red stood right of any blue; never more than 1 simultaneous fight.**

The order that would have cost nothing is measure, then guess. The reason this
one was caught is that the third check was run BEFORE a session was spent
building on the second.

## What landed, five commits

- **`e3a91bc`** — the back rank painted OVER the front one (`withDrawOrder`
  sorted by clip depth, which runs backwards for painting), and nothing read the
  `xscale`/`yscale` the presentation stream has always carried, so every
  gladiator drew one size whatever its `physical_size`. `figureScaleFor` answers
  both, in `src/render/` rather than the shell.
- **`16a891d`** — **a live AI defect**: `chooseAiAction` picked the globally
  weakest foe, then rested if that one was out of reach while attacks on a
  reachable foe sat unread in `options`. 78 of 1,688 3v3 actions (4.6%); 0 at
  1v1 and 2v2, which is why it survived. Now 0 everywhere, pinned as an
  invariant, verified to fail on the old code.
- **`157e61b`** — the roster side panel had gone back-to-front with the teams
  interleaved, because it borrowed `scene.drawOrder`. Caught by screenshotting.
- **`09414a8`** — flattened the depth stagger so the drawing stops lying.
- **`58366d8`** — `tools/engagement-census.mjs`, and the interface finding.

## THE INSTRUMENT — run this first, before anything else

    node tools/engagement-census.mjs

                           1v1     2v2     3v3
      tightest spread      86      124     99      units, of an arena 4,200 wide
      can hit EVERY foe    86.4%   68.7%   41.0%   of turns
      blows through a body 0.0%    18.8%   44.7%
      idle rests           0       0       0

**A 3v3 uses 2.4% of the arena and nearly half its blows pass through a living
gladiator.** Every number in the design discussion that preceded this brief lived
in a throwaway scratch script; they are committed now because **a number nobody
can reproduce is not evidence.** This is the before-picture. Move these numbers.

## THE OWNER'S BRIEF, in his words

He wants, and none of it exists today:

- **breakoff fights** — two fighters peel off and duel while others fight
  elsewhere;
- **a true 3v3 brawl as a CHOICE**, not as the only outcome;
- **one fighter strategically fighting at range.**

And on the rules, all three of which are confirmed vanilla rather than invented:

- **Anyone may carry both a melee and a ranged weapon and switch mid-fight.**
  `swap_weapons` is a real phase (battle map `:267-301`), with `equipped_weapon`
  1/2 and `using_bow`. Potions and spells are slots on the same footing.
- **A fighter may disengage freely.** This is already the build's rule:
  `closerange_warrior` wires NO toward-movement in either facing — once in range
  the build lets you back out and never further in.
- **Agility decides whether escape works in practice.** Already dramatic: one
  walk covers 44 units at speed 1 and 940 at speed 40, a 21x spread.

## Highest-value work, ranked

1. **BUILD THE SECOND AXIS. It is a prerequisite, not an improvement.** The
   9-agent design panel of 2026-09-12 recommended discrete NODES over a
   continuous plane, and the reasoning holds: SS2's own movement is already
   discrete phases (`walkleft`, `run`, `charge`, `jump`); blocking becomes one
   occupancy test instead of pathfinding; and the continuous prototype came back
   with four unfixed correctness bugs and a viewport that could not fit three
   ranks at any setting.
   **Cost, from the panel:** ~230 lines across `ss2-rules.js`, `resolver.js`,
   `roster.js`, `rule-set.js`, `slot-layout.js`, plus four presentation/render
   files nobody has written. **Every peer hash moves** — `combatantProjection`
   gains a second coordinate. **No golden moves** (`fixtureReplay` returns null
   from `startingPosition`, so a fixture models no geometry — verified twice).
   ~22 test failures, of which about half are position tests being REPLACED
   rather than re-pinned. Realistically 3-4 sessions.
   ► **The design question that outranks the geometry, and only the owner can
     answer it: how much should standing in the right place matter?** Today every
     fighter can reach every enemy on 41% of 3v3 turns and the pile is the only
     outcome. Strict formation measured badly in the panel — focus fire collapsed
     from 82% to 21% of states and a 2v2 player could not choose which enemy to
     hit. The answer is somewhere between, and it is game feel, not arithmetic.
     **Build it playable behind a flag and let him play it.**
2. **THEN the AI that picks an opponent and commits.** Worthless before item 1 —
   there is nowhere to go — and necessary after it, because geometry only makes
   separation POSSIBLE. Without this the fighters will pile up in two dimensions
   exactly as they do in one.
3. **THEN ranged as a real action**, with weapon switching. It needs item 1 to
   mean anything. Note the resolver has NO ranged vocabulary today: the verbs are
   quick/normal/power/rest plus two walks. **This is why archers are currently
   refused at construction** — with no positional model a bow's arena-wide reach
   just granted melee at any range.
4. **OWNER: the projection version bump.** `x` and `weapon_range` changed the
   format twice while `BATTLE_STATE_VERSION` stayed 1. Item 1 will change it a
   third time, so this is the moment to decide — it reverses the 2026-09-07
   decision to pin the shape rather than carry a version id.
5. **OWNER: the crowd fork.** Now load-bearing for a new reason: with free
   disengage and a fast archer, the crowd's patience toll is the ONLY thing
   stopping a kiting stalemate. It stops being a backstop and becomes the clock.
6. **The 21 untouched weapon rows**, the jump's total, capture breadth — all
   unchanged from the 11:30 brief.

## What is NOT verified

- **Nobody has seen a converged 3v3 drawn honestly.** The flatten landed after
  the owner's last look; he saw the exaggerated version. Stills can be captured
  (headless Windows Chrome, `--screenshot`, works); ANIMATION still cannot
  (`--virtual-time-budget` deadlocks on the endless rAF loop, and CDP does not
  cross the WSL/Windows boundary here).
- **The depth constants are a floor, not an answer.** `ALLY_Y_STRIDE -10` and
  `DEPTH_SCALE_PER_RANK 0.03` bring the worst drawn-over-model ratio from 1.658
  to 1.069. The `* 1.7` in `tools/arena/main.js`'s `toY` is the real multiplier
  and has no recorded justification; nobody established which of the two is wrong.
- **Agility becoming a real build stat will move the balance.** Earlier sessions
  measured strength dominating and stamina as the only resource that mattered. If
  pursuit works, speed becomes a genuine choice — good for the game, unmeasured.
- Everything the 11:30 brief lists as unverified still is.

## Hard rules

- **Measure, then guess. Not the other way round** — see the lesson above.
- **Settling is not a diagnostic**, and neither is a green suite. Three broken
  things this session settled 24/24 and looked fine.
- **Two implementations of one decision agree with each other.** Found twice in
  `test/render-arena-host.test.js`.
- **A number nobody can reproduce is not evidence.** Put the harness in `tools/`.
- **An agent FINDS; the main session RE-DERIVES.**
- **Codex findings are CLAIMS TO VERIFY.** Run it with the model pinned:
  `/adversarial-review`, or the command in the 11:30 brief. It is RUNNABLE by a
  session; the claim that it is not was false and cost four sessions.
- **Push a feature branch without asking**; `main`/`master` and every force flag
  stay DENIED.
- **A handoff commit is not finished until `node --test --test-concurrency=1` is
  green, and its suite and push lines must be measured AFTER that commit.**
