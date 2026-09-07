---
handoff:      2026-09-07-0330--the-armoured-golden-reaches-the-resolver
written:      2026-09-07 03:30 -0400
sessionId:    0251f418-7a7c-4ea4-8911-e2015c2067c3 (https://claude.ai/code/session_01RDWgtRAB5CcLKHnXF9fATV)
branch:       arena/champion-capture, PUSHED through `df14b24` with the owner's
              approval. `dec1e99`+later doc commits may be local — check.
suite:        728 / 727 / 0 / 1 (fresh-clone profile: `captures/` holds only
              ARCHIVE-MANIFEST.sha256 and README.md), measured 2026-09-07.
              Re-measure; never copy this line.
supersedes:   2026-09-02-2313--reach-for-the-stars — its ONE task is DONE.
              The 16:59 brief's ranked list survives, minus item 1.
---
# Handoff — the armoured golden reaches the resolver

## The one-sentence version

`REPLAY_UNDRIVABLE` is empty and all 23 goldens now drive a real battle; the
email to the developer was already SENT and the record now says so; and the
owner has CHOSEN the enchantment fork — **option (a), status phase as a forced
legal action** — which is the next build.

## FIRST: the record was five days stale, and that is the reusable lesson

The 23:13 brief's single task was "draft — never send — the email". The owner's
first message this session was that it had already gone out. Nothing in the
repository knew: the draft sat UNTRACKED in `docs/outreach/`, no handoff
followed it, and the branch had not moved since 2026-09-02 23:15. **A session
following that brief would have drafted it a second time.**

`docs/outreach/2026-09-02-email-to-oliver-joyce.md` now holds the SENT text, the
recipient verified that day from the studio's own press kit (HTTP 200: "Contact
— Oliver Joyce info@whiskeybarrelstudios.com", Sydney; eGames and Aram Fuchs
named by the studio itself), and a table mapping every factual claim to where
the record backs it. **No reply is recorded — append one THERE, not to a
handoff, which freezes.**

**One claim in the sent text overstates the record and is flagged in that file,
not fixed**: *"every number in it was observed in the real game and confirmed
twice"* is true of the 23 goldens and NOT of the engine, which declares
`kind: "map-derived"`, `runtimeVerified: false` (`ss2-rules.js`). If Oliver asks
how the numbers were obtained, that file has the answer the repo can defend.

The owner's postal address, phone and PSU email are REDACTED there because
**this repository is public**. Reversible on his word; nothing evidentiary
depends on them.

## RANKED ITEM 1 IS DONE — and it was not done with a wave

`89bc6c0` + `df14b24`. The damage pair is now required of whoever ATTACKS, at
resolve time (`SS2_ATTACKER_REQUIRED_RESOURCES`); `staminaleft`/`staminamax`
stay role-blind at construction, because they gate `legalActions` for a
gladiator that has not swung. `REPLAY_UNDRIVABLE` is `{}` and the armoured
golden is in `SS2_GOLDEN_FIXTURE_IDS`.

**ADR 0001 in practice: the 16:59 brief prescribed a wave here and a wave was
the wrong tool.** Both of its unverified claims were CODE claims, so they were
pinned by tests instead — permanent, and free to re-run. Zero subagents ran for
the implementation. What a wave would likely have missed:

1. **A defender's DECLARED damage pair moves the battle hash** while reaching no
   arithmetic. `combatantProjection` (`resolver.js:480-496`) carries every
   declared resource into `combatStateHash` (`:560`), which is the completion
   token's second half. **Declaring the pair as `1/1` — the exact value the
   arithmetic defaults to — still moves it, because the projection covers the
   DECLARATION and not the value.** So "complete the fixture so the guard stops
   complaining" is a PROTOCOL change that desyncs peers. Pinned by name.
2. **The armoured golden is `fightMode: "tournament"`, not `misc`** — the mode
   play uses now has exactly one runtime-verified fixture, where the rule set's
   header said it had none. It is also the only golden carrying
   `provenance.staged`. **The first draft of that commit wrote "all 23 are
   misc" from the old count; re-deriving the property is what caught it.**
3. Armour absorption and the deflection threshold now HAVE runtime backing
   (armourclass 79 → 57, `selectedDamage` 22, `deflectionRoll` 93 vs threshold
   93). **The overflow to health does NOT** — that golden never exhausts the
   armour — and piece destruction, the breastplate join and enchantment are
   untouched by it. Headers corrected in both directions.

### The Codex review earned its place in the precedence

An independent `/codex:adversarial-review` of `89bc6c0` found **two real
defects neither the tests nor I had reached.** Both were confirmed by direct
measurement here before anything was changed, per the "claims to verify" rule.

- **A refused attack was NOT free — a regression this session introduced.** With
  the check moved out of construction, the guard sat AFTER the direction draw.
  `randomBetween` advances generator state and cursor, `applyAction` has no
  rollback, and the cursor is inside `toTeamWireState`. Measured: three
  rejections took the journal from **3 draws to 6** and moved the hash every
  time, at 1v1, 2v2 and 3v3. Fixed by building both vanilla records before the
  first draw — neither call draws, so the RNG sequence is unchanged. **The
  hazard was already documented one level up** (the `fixtureReplay` gate exists
  for exactly this, on the first-blood refusal, which is still post-draw and
  still gated at construction) **and I walked past it.**
- **My own hash test skipped the only fixture it was written for.** It filtered
  to goldens that SETTLE; the armoured golden is a non-lethal hit with
  `resultEvent: null`, and it is the sole golden whose villain omits the pair.
  The test named for a hole stepped around it — this project's signature
  defect. It now compares `combatStateHash` directly over all 23 and names the
  absent-versus-declared case.

Codex's other three findings were "no issue" and were not acted on. Its
guard-deletion probe is worth keeping: deleting the attacker guard kills three
of the new negative tests and correctly kills none of the three invariance
tests, because those are not guard tests.

## `AGENTS.md` SAID 70 OBSERVATION RECORDS. IT IS 69, AND IT WAS NEVER 70

`dec1e99`. 69 files, 69 distinct `observationId`s, no second observations
directory — and it was 69 at `fc7b3cb`, the commit that wrote "70". Wrong on the
day it was written, in the file loaded into every session of every agent, and
**no test asserts this count, which is why nothing caught it.** Mine.

While there: all 23 goldens' **62** cited observations were run through
`matchSs2ObservationToFixture` itself — 0 missing, 0 hook-attribution throws, 0
differences. Every "all 22" claim in the tree was re-derived rather than bumped;
the historical ones ("22 goldens sat unused") were correctly left alone.

## THE OWNER'S DECISION, 2026-09-07: ENCHANTMENTS ARE OPTION (a)

Asked to choose among the 16:59 brief's four options, the owner chose
**(a) the status phase as a forced legal action** — when afflicted, the status
phase is the ONLY legal action that turn, and the client sees the turn happen,
as vanilla does. **This is now a build instruction, not an open fork.**

**Verified before he was asked:** `rule-set.js:74-79` — `REQUIRED_FUNCTIONS` is
exactly `[maximumHealth, legalActions, resolveAction, chooseAiAction]`. There is
no turn-start hook, so option (a) needs no change to `resolver.js` or
`rule-set.js`. It lands at **map-derived tier**: the wrapper cannot arm on a
status phase, so no capture can confirm it until a new hook exists.

### What it needs next, and the ONE thing that blocks it

The arithmetic comes from `magic_damage_character`. The 16:59 brief's
byte-level notes on it are UNVERIFIED (that wave returned 0 verifiers) and must
be re-derived, not copied:

- it reads `damage_method` exactly once, as a `gotoAndPlay` label, so **no
  method changes the arithmetic and "lifesteal" heals nobody**;
- the breastplate stamina join is `ceil(damage * ((breastplate/100*100)/100))`.

**The blocker is that byte verification is NOT possible from this WSL tree, and
nothing had written that down.** `tools/inspect-swf.mjs` does structure and
frame-label timelines only — it cannot disassemble at a `DoAction` offset. The
map's offsets came from FFDec via `tools/ffdec.ps1`, which needs `.tools/`
(portable JRE + `ffdec.jar`) — **`.tools/` does not exist in this tree and there
is no `java` on PATH.** So the next session must either run
`tools/install-ffdec.ps1` from a WINDOWS PowerShell session, or accept
map-derived tier on the map's existing prose. The Steam install itself IS
reachable from WSL at `/mnt/c/Program Files (x86)/Steam/steamapps/common/Swords
and Sandals Classic Collection`.

### And a HYPOTHESIS that contradicts the 16:59 brief — do not act on it unread

That brief says the map's status-arm section has two errors, the first being
that "for the HERO the FIRST matching status wins, not the last". **Reading
`docs/integration/ss2-battle-map.md` §"Turn gating, forced phases, and per-turn
re-entry", the map already says exactly that**: `getphase` runs only at
`turnphase == 1`, "at most one `getphase` call takes effect per pass through
frame 1", the chain is sequential rather than if/else, and "a lower-priority
condition can have its flag consumed by a call that does nothing". That reads as
first-effective-wins, already correct.

**I did not read the bytes, so this is a hypothesis, not a finding** — but it
means ranked item 3 may be a correction to a document that does not need one.
Check the map before spending a verifier on it. The brief's SECOND claim (the
status-arm pseudo-code at map line ~1742 inverts both `struck` tests, `!= null`
and `!= true`) is untouched by this and still needs bytes — and `HANDOFF.md`'s
"AVM1 has ONE comparison opcode" section is the reason branch polarity is
exactly the thing to get wrong there.

## Highest-value work, ranked

1. **Build option (a)** — the status phase as a forced legal action. Decided by
   the owner; see the blocker above before deriving any number.
2. **Settle whether ranked item 3 is real** by reading the map first (cheap) and
   only then the bytes (needs FFDec on Windows).
3. **Sync the capped workflow to `claude-harness`** — still the owner's push.
4. The schema question and `.claude/settings.local.json`'s `Bash(rm -rf *)`
   allow remain the owner's.

## Hard rules (unchanged)

Every rule in the 16:59 brief still applies. Two worth restating because this
session touched them:

- **Derive candidates from the map, never from a capture.** The armoured
  golden's villain omits the damage pair and that omission is CORRECT; the raw
  trace carries both numbers, so writing them in was always one keystroke away,
  and doing so would now also move the battle hash.
- **Ask before every push.** This session pushed once, with the owner's explicit
  approval, and `main` stays denied outright.
