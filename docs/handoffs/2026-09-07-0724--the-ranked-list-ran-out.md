---
handoff:      2026-09-07-0724--the-ranked-list-ran-out
written:      2026-09-07 07:24 -0400
sessionId:    0251f418-7a7c-4ea4-8911-e2015c2067c3 (https://claude.ai/code/session_01RDWgtRAB5CcLKHnXF9fATV)
branch:       arena/champion-capture. Push state is the LAST thing this session
              did; check `git log --oneline github/arena/champion-capture..HEAD`
              rather than believing this line.
suite:        771 / 770 / 0 / 1 (fresh-clone profile: `captures/` holds only
              ARCHIVE-MANIFEST.sha256 and README.md), measured 07:24. From 721
              at session start. Re-measure; never copy this line.
supersedes:   2026-09-07-0330--the-armoured-golden-reaches-the-resolver, which
              I wrote MID-SESSION and which is stale in three places it names
              itself. Read it only for the email record; its "what blocks
              option (a)" section is corrected in place and its ranked list is
              spent.
---
# Handoff — the ranked list ran out, and the roadmap was the better map

## The one-sentence version

Every ranked item from the 16:59 brief is closed, the game gained three things
it could not do this morning — status phases, team fights, and a campaign
record that can be read back — and the most useful thing this session did was
stop reading the brief and start reading `docs/roadmap.md`'s "not started"
column.

## THE HEADLINE, because it changes how the next session should choose work

**When the ranked list emptied, the highest-value work was already written
down in `docs/roadmap.md` — in the column nobody was reading.** Both of the
last two features came from there:

- *"campaign roster read-back and rewards — not started; a record is written
  and never read back into a battle"*, which is the same failure this project
  already found once, when 22 runtime-verified goldens fed nothing and the
  verification machinery had become the project. **A persistence layer that
  only persists is a filing cabinet.**
- Team fights: the resolver has run 1v1/2v2/3v3 since long before anything was
  playable, and **no person had ever taken a turn in one**, because the
  hot-seat runner hard-coded one fighter per team.

A brief tells you what the last session thought was next. The roadmap tells you
what the project cannot do. When they disagree, the roadmap was right this time.

## What the game can do now that it could not this morning

- **`node tools/hotseat.mjs --enchant burning:3`** — conditions exist. A hit
  procs one, and it TAKES ITS BEARER'S NEXT TURN, as the build has it.
- **`--teams 2v2`** (1-3 a side; four is refused by name, because three is what
  the six-slot measurement covered). Every seat is a human at the keyboard, and
  an attack has to name which foe it hits.
- **`rosterFromCampaignRecord(record, { blueprints })`** — a settled bout's
  survivors carry into the next one at the health and conditions the record
  measured.

## Ranked items 1-4: all closed, and two were not what the brief thought

1. **Role-based damage pair — DONE** (`89bc6c0`, `df14b24`). `REPLAY_UNDRIVABLE`
   is empty and all 23 goldens drive a real battle.
2. **Enchantment fork — DECIDED BY THE OWNER AND BUILT** (`86ccb68` ->
   `dda33d4`). Option (a): the status phase as a forced legal action.
3. **Map status-arm correction — REAL, and I said it wasn't.** The map carried
   BOTH rules in two sections byte-read on different days. Hero = FIRST match
   wins; villain = last, within the status chain only, and
   `villain_cast_spells()` can replace even that. Corrected after a verifier
   confirmed it, per the standing rule.
4. **Sync the capped workflow — ALREADY DONE, and the warning is stale.** Both
   copies carry `verifierBudget` and `maxItems: 6`; `diff` is four lines, one
   `whenToUse` string, and the HARNESS copy is the better of the two. The sync
   ran the other way.

## THE OWNER'S DECISIONS THIS SESSION, all three implemented as chosen

- **Enchantments: option (a)**, the status phase as a forced legal action.
- **The tick's damage comes from two DECLARED resources**
  (`weapon_enchantment_damage`, `secondary_weapon_enchantment_damage`),
  matching the build, which derives them once in `battlevalues` and reads the
  stored field at the phase.
- **A condition REMEMBERS WHO INFLICTED IT** (`"burning:from=villain"`),
  because vanilla reads the tick damage off "the other gladiator" and that
  names nobody above 1v1. At 1v1 the two coincide exactly.
- **NOT a versioned rule-set id — pin the projection's SHAPE instead**
  (`7464ca0`), deferred rather than rejected: it earns its place at the first
  release or the first second implementation, when it can be tested at the
  value that matters.

## What to be careful of, in the order it will bite

1. **THE WIRE FORMAT MOVED AND ONLY A TEST GUARDS IT.** Declaring the two
   enchantment-damage resources re-hashed every battle — all 23 golden replay
   hashes moved (`70e605e1` -> `4032d673` on the armoured golden). No ASSERTED
   pin moved, which is why the suite stayed green and why `86ccb68`'s own
   message wrongly said no hash moved. Four pins now exist (vocabulary,
   DEFAULTS, declared-vs-projected key sets, one canonical battle hash), and
   **the first version of that tripwire was itself half a tripwire** — it built
   its battle from a helper that STATES `character_level`, so a changed default
   passed. Build canonical fixtures from MINIMAL inputs or the defaults never
   feed the hash.
2. **The status phase has ZERO runtime backing.** It is map-derived, the map is
   byte-verified and complete for it, and no capture has ever armed on a status
   phase. The wrapper cannot: `beginAction` is reachable only from the
   `attack_chances`/`checkattackroll` wraps. **That hook is the single highest-
   integrity piece of work left, and it is the owner's supervised lane** —
   Windows, Ruffle, `validate-vehicle.ps1`, none of which runs from WSL.
3. **`rosterFromCampaignRecord` REPORTS two things it cannot prevent**, and both
   were claims this session got wrong first: `seatChanges`, because a survivor
   behind a casualty MOVES UP (seats come from the array index, and `"empty"`
   means AI-FILL, not a vacant chair — an SS2 team containing one is refused
   outright); and `playable`/`unplayableTeamIds`, because a roster including
   the fallen can never fight, since a settled bout always has a wholly
   eliminated team.
4. **Rewards are deliberately not built.** Paying one is a progression decision
   and EP-D04 is pending. A seam that healed or paid the survivors would be a
   balance choice wearing the costume of a data structure.

## Codex earned its place in the precedence three times over

Three adversarial reviews, and **every one found something the tests I had just
written did not.** Nine confirmed defects between them, several of them mine:

- a refused attack consumed RNG and moved the battle hash, with no rollback —
  a regression this session introduced by moving a guard;
- a first-blood status tick was silently dropped;
- `life_stolen` reached the ingress under its decision label instead of
  `lifesteal`;
- two tokens for one condition consumed only one, twice — once on the victim,
  once on the inflictor, and the second broke a universal I had written into a
  test;
- a lethal tick left the victim's taunts standing;
- an ambiguous inflictor id billed the wrong gladiator;
- carried fighters shared nested objects with the caller's blueprints;
- a maxHealth check that only fired when a blueprint stated one, so a 25/60
  survivor arrived at 10.

**ADR 0001's ordering is holding up on measurement**: skills first, Codex on any
diff that matters, waves last. Zero waves ran this session and nothing needed
one — every claim was a code claim a test could pin.

## The reusable lesson, and it cost real time twice

**Three claims I wrote as facts were false, and a reviewer broke each within the
hour.** "Everyone stands where they stood." "A battle of corpses settles
instantly." "A condition cannot cross a 1v1 boundary." Each was a universal
asserted from a handful of observations.

The two tests that nearly shipped vacuous are the same shape: a survivor who
ends untouched makes "carries his measured health" identical to "starts fresh",
and a test that returns early when its setup did not occur is a test that passes
by not running. **Sweep, then assert you found the case.**

## Highest-value work, ranked

1. **A capture hook that can arm on a status phase** — the only way today's
   biggest feature gets runtime backing. Owner's supervised lane; needs Windows.
2. **Read the accepted EP decisions and report what is implementable.** Three
   are accepted and unimplemented since 2026-09-04 (EP-D01, EP-D02 Rule
   Capacity, EP-D07 + dropout supplement), 3,597 lines of design and nothing in
   `src/`. EP-D04 is pending and it is coupled, so expect to land only part.
   **The quarantine rule is NARROWER than it sounds**: design must never flow
   into CANDIDATE AUTHORING. Implementing it in game code is not that.
3. **The schema question** (villain stamina 105 vs 110) — still the only
   capture lever, still the owner's.
4. `.claude/settings.local.json`'s `Bash(rm -rf *)` allow, still the owner's.

## Hard rules (unchanged)

Every rule in the 16:59 brief still applies. Two this session leaned on:

- **Derive candidates from the map, never from a capture.** The armoured
  golden's villain omits the damage pair and that omission is CORRECT — and
  writing it in would now ALSO move the battle hash.
- **Ask before every push.** This session pushed three times, each with the
  owner's explicit approval, and `main` stays denied outright.
