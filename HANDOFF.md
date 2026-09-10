# Transfer handoff — Swords & Sandals II Multiplayer Foundation

**This file is the accumulated STATE of the project. The brief for a single
session lives in [`docs/handoffs/`](docs/handoffs/README.md), stamped
`YYYY-MM-DD-HHMM--slug`.** Starting a session should cost one sentence — "read
the latest handoff in `docs/handoffs/` and proceed" — with this file as the state
it points at. A handoff must not restate what is here; if the two ever disagree,
THIS file is right and the handoff was frozen at the end of its session.

**LATEST:
[2026-09-10 13:23 — the arena is drawn](docs/handoffs/2026-09-10-1323--the-arena-is-drawn.md).**
Start there. **The RENDERED ARENA landed** — `src/render/` plus `tools/arena/`,
the presentation stream's first consumer outside its own tests, drawing original
vector art in a browser that imports `src/` directly as ES modules. Building it
found three things: a shipped clip label that CONTRADICTS the battle map while a
`MAP_SILENCE` entry declared the map silent on it (the map gives the rule with
byte offsets); two module comments telling a host the action boundary is
"never derived from the wire" when it is exactly
`toTeamWireState(battle).events.length + 1` before `applyAction` (0 mismatches
over 193 actions — the reason it is not PROJECTED is hash stability); and that
**nothing whatsoever enforced "ship no SS2 asset"** until
`test/no-shipped-assets.test.js`. It is also the first host here to set
`awaitAnimations: true`, so the per-action gate ENFORCES for the first time and
the animation-timeout policy exists for the first time. **The owner then opened it, and the one
check no agent could run found the session's biggest defect in under a minute**:
every SELF-TARGETED action was playing `Standing`, the IDLE clip, and emitting a
spurious `unmapped` alongside it — 4,326 of each over a 360-bout sweep. Fixed
from the map in `c6fe43b`. **No agent here can watch the arena animate**
(headless Chrome gives a `requestAnimationFrame` loop 2 frames whatever
`--virtual-time-budget` says), so ask the owner to look rather than concluding
the arena is fine because the suite is green. **But the fix came from a SWEEP,
not from watching**: the surface's log is derived from presentation commands and
those run under `node --test`, so what a person had to read is now a guard that
runs on every commit. Ask whether a surface's output can be computed — here it
always could.

**That brief's ranked item 4 was then done in the same session**
(`f922d31`): `src/team/controllers.js` has its first negative tests, closing the
2026-09-07 mutation audit's three confirmed survivors there. All three were
re-derived first — applied one at a time, the suite still read 849 pass / 0 fail
— and all nine throws in the module are now covered, each asserting the error
TYPE *and* matching its MESSAGE. The module itself is unchanged; no bug was
found, because a survivor is a COVERAGE fact. **It does not touch the audit's
finding 2** — every pinned literal hash is still taken before any action is
applied — which is the larger problem most of the remaining 29 survivors
exploit. **That is now ranked FIRST in the newest brief**, because it was the
biggest item outside the owner's lane and it had no home on any list: it
surfaced while closing the controllers work and was mentioned only here. An
unranked item is an item the next session does not do.

► **THE 2026-09-10 SESSION PUSHED EVERYTHING IT COMMITTED**, each push on the
  owner's explicit yes, and verified `0 unpushed` after each one.

  **This block is written as an EVENT, not as a live count, and that is the
  point.** Its first version said "three commits are unpushed", which was true
  for two minutes and then became a bold instruction to act on a state that no
  longer existed — the same half-life problem as the six line numbers below.
  A timestamped event stays true; a count does not. **Measure the live number,
  never read it:**
  `git fetch github && git log --oneline github/arena/champion-capture..HEAD | wc -l`
  `Bash(git push *)` stays in `ask`, so ask before every push regardless.

  ► **AND THE REWRITE STILL LEFT A DECAYING CLAUSE IN, WHICH IS THE WHOLE
    LESSON REPEATING ITSELF INSIDE THE PARAGRAPH ABOUT IT.** The version that
    replaced the count named three specific commit hashes and then said "only
    the correction commit that rewrote this very block came after it" — an
    enumeration of the future, which the very next commit falsified. Naming an
    event is not enough if the sentence also claims what has NOT happened
    since. **Do not write "and nothing else since" into a file that is still
    being written.**

*(The brief it supersedes, whose RANKED LIST IS STILL THE WORK — nothing on it
has been started:)*
[2026-09-10 12:12 — everything is pushed, and the Workflow gate is gone](docs/handoffs/2026-09-10-1212--everything-is-pushed-and-the-workflow-gate-is-gone.md).**
Start there — it is SHORT, and it carries only what changed. **Nothing is
unpushed for the first time in three sessions.** No code changed; the one thing
that binds you is that `Workflow` is no longer in `permissions.ask`, so a
fan-out wave starts with no dialog and **you must say what it will spawn before
launching it.** Its ranked list is unchanged and points at the brief below,
which is still the work.

*(The brief it supersedes, whose RANKED LIST IS STILL THE WORK — nothing on it
has been started:)*
[2026-09-07 12:42 — the 78 are done, and the suite does not bite](docs/handoffs/2026-09-07-1242--the-78-are-done-and-the-suite-does-not-bite.md).**
Start there. **The 78 stale living-head rows are re-derived and corrected AT
their sentences** — every one carries a ► block naming what was measured and the
command that measures it. **Then the finding that outranks them: 37 of 48
deliberate one-line breakages SURVIVE the whole suite** (`docs/mutation-audit-2026-09-07.md`),
with the corpus-integrity gates in `src/golden/` the honourable exception — six
of the eleven kills are theirs, and only two of the thirty-seven survivors.
**And Stage 7 is not the right next thing**
(`docs/stage7-transport-findings-2026-09-07.md`): an owner decision accepted
2026-09-03 lives on an unmerged branch, is invisible to a grep of this tree, and
forbids the one behaviour all five designs were built around.

► **THAT HANDOFF'S OWN PUSH COUNT IS WRONG, AND IT IS THE SAME ERROR IT WAS
  WRITTEN TO WARN ABOUT.** Its frontmatter names FOUR new commits and SEVEN
  unpushed; measured 2026-09-09 the answer is **FIVE new and EIGHT unpushed**,
  because the handoff was written before the commit that carries it and did not
  count itself. **This is the third instance of one defect in three consecutive
  sessions** — a handoff describing a state that its own commit then changes.
  The frozen file is deliberately NOT edited (`docs/handoffs/README.md`: never
  edit a handoff after its session ends; corrections go here). **The durable fix
  is not care, it is arithmetic a session cannot get wrong: after committing a
  handoff, run `git log --oneline github/<branch>..HEAD | wc -l` and put THAT
  number in the living head, where it can be corrected.** As of 2026-09-09,
  eight commits are unpushed and the tree is clean at `79cc325`.

► **THE `Workflow` PERMISSION GATE IS GONE — owner's decision, 2026-09-09.**
  `.claude/settings.json` no longer lists `Workflow` in `permissions.ask`, so a
  fan-out wave now starts with no confirmation dialog. **The reasoning, because
  it changes what you must do rather than only what you may do: the dialog
  bought VISIBILITY, not safety.** What still binds is the 6-questions /
  6-verifiers hard cap inside `.claude/workflows/question-fanout-audit.js` and
  the one-wave-at-a-time rule in `AGENTS.md`. **So SAY WHAT A WAVE WILL SPAWN IN
  THE TRANSCRIPT BEFORE LAUNCHING IT** — that is now the only place the owner
  sees the number, and it is on the session, not the harness. Authoring an
  inline workflow to get past the committed cap was already a rule violation and
  now has no dialog behind it. **`Bash(git push *)` STAYS in ASK**: that gate is
  about what leaves this machine, not about cost. The settings file carries the
  full rationale, including a claim it used to make about bypass mode that the
  owner's own experience contradicted — do not cite that claim, measure it.

*(The brief it supersedes, whose ranked item 1 is DONE and whose items 2-5 are
all still the owner's:)*
[2026-09-07 11:40 — the sweep reached the untouched six](docs/handoffs/2026-09-07-1140--the-sweep-reached-the-untouched-six.md).**
Start there. The six documents the previous sweep never touched are done — **79
rows, 73 applied and 6 rejected**, every one re-derived by hand, and four of the
six rejections are numbers that do not reproduce at all. **The remaining
worklist was 78 rows in THIS FILE's LIVING HEAD, not in the archive:** the sweep
chunked `HANDOFF.md` as though `## THE ARCHIVE LINE` were near line 800, and it
is not, so three of its four surveyed chunks were labelled archive and never
applied. The unapplied range holds § "What is running, and how to run it",
§ "Non-negotiable rules", § "Next steps, in order" and § "Open items" —
precisely the sections that misdirect a session when stale.
**THOSE 78 ROWS WERE RE-DERIVED AND APPLIED 2026-09-07 (next session); every one
now carries a ► correction AT its sentence.** Find any section by NAME, never by
a line number some earlier session wrote down: `grep -n '^## ' HANDOFF.md`.

► **THE PARAGRAPH ABOVE ORIGINALLY CARRIED SIX LINE NUMBERS AND THE COMMIT THAT
  WROTE THEM INVALIDATED ALL SIX IN THE SAME BREATH. MY OWN ERROR, 2026-09-07.**
  `4fe5dd8` inserted 24 lines ABOVE this paragraph while writing it, so its
  "archive line at 3133" was 3157 the instant it was committed, its worklist
  range "801–3132" was 825–3156, and its four section anchors were all 24 low.
  **The commit that repaired one stale pointer minted six new ones inside the
  paragraph explaining why stale pointers are dangerous** — and it was caught
  not by me but by two independent agents of the very wave the paragraph was
  written to launch. `test/handoff-navigation.test.js` checks § NAMES, never
  line numbers, so the suite was green with all six wrong. **That is the whole
  lesson: a line number into a growing file is a claim with a half-life of one
  commit. The numbers are gone from this paragraph rather than corrected,
  because correcting them would only restart the clock.**

► **AND THE SWEEP'S OWN ROW NUMBERS WERE NEVER RIGHT EITHER — they are ~92 off
  at HEAD, not the ~65 the file grew.** The next session's first move was to map
  the 78 rows by adding the file's growth (+65, measured and correct) to the
  sweep's numbers. That was WRONG, and it went out in six agent briefs before
  text-matching the quotes caught it: the surveyors' own numbers were **already
  ~27 lines low against the very blob they read** (`git show 470c56a:HANDOFF.md`
  — archive line 3065, exactly the "3,064 lines" the sweep claims for the living
  head). The wave was killed and relaunched with every anchor located by
  MATCHING THE QUOTED TEXT. **If you ever need to find a sweep row again, match
  its quoted sentence. Do not do arithmetic on the number in the table.**

► **AND THAT HANDOFF'S OWN COMMIT LEFT THREE TESTS RED (found by the next
  session, 2026-09-07).** `42527e0` added the handoff file without repointing
  this `**LATEST:` marker or adding a row to `docs/handoffs/README.md`, so the
  measured suite was **816 / 812 / 3 / 1** where that handoff's frontmatter
  claims `816 / 815 / 0 / 1`. Repaired here. The lesson is not "be careful": the
  three guards that caught it exist BECAUSE the pointer went stale twice before,
  and they only help a session that RUNS them. **A handoff commit is not
  finished until `node --test --test-concurrency=1` is green — and the handoff's
  own suite line must be measured after that commit, not before it.**

*(The brief it supersedes, whose ranked items 2-5 are all still open and all
still the owner's:)*
[2026-09-07 09:55 — the last adapter gap, and the sweep](docs/handoffs/2026-09-07-0955--the-last-adapter-gap-and-the-sweep.md).**
Start there. **The adapter's last documented gap is closed** — per-action
animation acknowledgement — and the mechanism this repository's own contract
proposed for it was WRONG: `event.sequence` is stamped per EVENT and one action
emits up to four, so a token read off it splits a killing blow into four
actions. The boundary that works, `lastResolvedAction().firstEventSequence`, is
deliberately NOT projected, because `combatStateHash` hashes everything that is.

► **AND EVERY DOCUMENT WAS SWEPT (2026-09-07):** 17 write-nothing surveyors and
  34 adversarial refuters, `started == returned` on both phases, **3,146 claims
  examined and 264 STALE or WRONG.** The corrections that were re-derived by
  hand have landed at their sentences; the remaining ~250 are in
  **`docs/doc-integrity-sweep-2026-09-07.md`, labelled as CLAIMS TO VERIFY
  rather than results.** **The refuters broke 7 of 34 — a 21% base rate — and
  one of the breaks would have BROKEN THE CORPUS.** Read that file's header
  before applying anything from it.

► **AND THE ADAPTER HOST CANNOT DRIVE `ss2TeamRules` WITH A GLADIATOR A PERSON
  CONTROLS (2026-09-07).** It CAN drive it through an AI-filled slot carrying
  `team.aiFill.resources` — a full 27-action battle, measured — but the
  SUPPLIED path stops at the role-based `max_damage`/`min_damage` requirement,
  because `CANONICAL_RESOURCE_SOURCES` (20 names) does not carry 14 of the 32
  `SS2_RESOURCE_NAMES`. **Do not write "the host cannot drive ss2TeamRules":
  that over-general claim is the one `src/team/ss2-rules.js`'s own header warns
  about, and I made it anyway.** A diagnostic that could abort construction has
  been fixed, and `CANONICAL_RESOURCE_SOURCES` is now pinned literally —
  nothing was watching it, so growing it would have re-hashed every
  adapter-built battle with the suite green.

  ► **AND IT CAN NOW (later the same day).** `toCanonicalCombatantSource` takes
    an OPT-IN `resources` override and `battle-host.js` passes
    `member.resources`, so a supplied gladiator declaring the SS2 bag fights a
    full battle under `ss2TeamRules`. A caller that declares nothing is
    byte-identical to before — the hash moves only for a caller who asks, and a
    test pins that it moves. **What it does not buy: a destroyed armour piece
    still does not reach the vanilla mirror**, because piece ids are outside the
    write allowlist. Reported, pinned, and harmless today because a campaign
    record carries no resources at all (measured, not assumed).

*(The brief it supersedes, whose ranked items 1, 3 and 4 are all still open and
all still the owner's:)*
[2026-09-07 08:25 — the accepted decisions do not authorize anything](docs/handoffs/2026-09-07-0825--the-accepted-decisions-do-not-authorize-anything.md).**
Start there. Ranked item 2 is ANSWERED and the answer is a fork for the owner:
three EP decisions are accepted, forty normative clauses, and **every one ends
"This decision does not authorize implementation."** The accepted text is NOT on
this branch — it is on the unmerged `design/endless-progression-owner-packet`,
and this tree's copy is the older design where all six read `pending`. Read it
with `git show`, never by checking that branch out (its `AGENTS.md` is 156
commits stale). Meanwhile the campaign read-back got its first consumer —
`node tools/hotseat.mjs --circuit 3` — and `playable` turned out to be a flag
that CANNOT be true.

► **THE OWNER ASKED THE NEXT SESSION TO PARALLELIZE (2026-09-07), and that
  brief's § "PARALLELIZE" says where it applies.** The short version, because
  the precedence rule is easy to misread: ADR 0001 putting a fan-out wave LAST
  is about the `question-fanout-audit` wave aimed at the game's BYTES or the
  CAPTURE ARCHIVE. **It is not a ban on ordinary parallel investigation of code
  and docs.** A capped `Workflow` over code/doc questions is the right tool and
  was used successfully this session. Keep the caps; do not read the precedence
  as "work alone". Serial and non-negotiable: Ruffle, the install, the save, the
  snapshots, `captures/`, every state-mutating git command, edits to one file,
  and THE FINAL NUMBER — an agent finds, the main session re-derives.

*(The brief it supersedes, whose ranked items 1, 3 and 4 are all still open and
all still the owner's supervised lanes:)*
[2026-09-07 07:24 — the ranked list ran out](docs/handoffs/2026-09-07-0724--the-ranked-list-ran-out.md).**
Start there. Every ranked item is closed; the game gained status phases, team
fights and a campaign record that can be read back; and **the most useful move
of the session was to stop reading the brief and start reading
`docs/roadmap.md`'s "not started" column**, which is where the last two features
came from. It also carries what to be careful of, in the order it will bite.

*(The brief it supersedes, written MID-session and stale in places it names
itself — read it for the email record:)*
[2026-09-07 03:30 — the armoured golden reaches the resolver](docs/handoffs/2026-09-07-0330--the-armoured-golden-reaches-the-resolver.md).**
Start there. `REPLAY_UNDRIVABLE` is EMPTY and all 23 goldens drive a real
battle; the email to the developer was already SENT and the record now says so;
and **the owner has DECIDED the enchantment fork — option (a), status phase as a
forced legal action — so it is a build instruction, not an open question.** It
also carries what blocks that build: byte verification is not possible from this
WSL tree, and nothing had written that down.

*(The brief it supersedes, whose ONE task is now done:)*
[2026-09-02 23:13 — reach for the stars: the email to the developer](docs/handoffs/2026-09-02-2313--reach-for-the-stars-the-email-to-the-developer.md).**
Start there: the owner's FIRST task is drafting (never sending) a careful
email to the game's developer, SOLO — no wave. It also records the decided
verification precedence (Pocock first, Codex second, one capped wave last;
harness ADR 0001) and that ultracode stays ON at the owner's instruction.

► **THAT FIRST TASK IS DONE AND CLOSED: THE EMAIL WAS SENT. Do not draft it
  again** — the 23:13 brief above still reads as though it is pending, and a
  session that follows it will re-do finished work. The owner sent it himself
  and reported so on **2026-09-07**; the sent text, the verified recipient
  (`info@whiskeybarrelstudios.com`, confirmed from the studio's own press kit
  that day) and a provenance table for every factual claim it makes are in
  **`docs/outreach/2026-09-02-email-to-oliver-joyce.md`**. **No reply is
  recorded — append one THERE, not to a handoff**, which freezes.
  One claim in the sent text overstates the record and is flagged in that
  file: *"every number... observed in the real game and confirmed twice"* is
  true of the 23 goldens, NOT of the engine, whose rule set declares
  `kind: "map-derived"`, `runtimeVerified: false` (`src/team/ss2-rules.js:914`).
  The owner's signature block is redacted there because **this repository is
  public**; nothing evidentiary depends on it.
  **The next task is therefore the 16:59 brief's ranked item 1**, the
  role-based damage-pair requirement.

  ► **AND RANKED ITEM 1 IS NOW DONE (2026-09-07, `89bc6c0` + `df14b24`).**
    `REPLAY_UNDRIVABLE` is EMPTY, all 23 goldens replay through
    `createTeamBattle`/`applyAction`, and the armoured golden is in
    `SS2_GOLDEN_FIXTURE_IDS`. Suite 728 / 727 / 0 / 1 from 721 / 720 / 0 / 1.
    **It was NOT done with a wave** — both of the brief's unverified claims were
    CODE claims, so ADR 0001 puts them behind a test, not behind agents. Three
    things it found that the brief did not predict, each measured:
    1. **A defender's declared damage pair MOVES the battle hash** while
       reaching no arithmetic (`combatantProjection`, `resolver.js:480-496`,
       into `combatStateHash` `:560`). Declaring it as `1/1` — the value the
       arithmetic defaults to anyway — still moves it, because the projection
       covers the DECLARATION. So "complete the fixture so the guard stops
       complaining" is a PROTOCOL change and would desync peers. Pinned.
    2. **The armoured golden is `fightMode: "tournament"`, not `misc`.** The
       mode play uses now has exactly one runtime-verified fixture behind it,
       where `ss2-rules.js`'s header said it had none. It is also the only
       golden with a `provenance.staged` string — the attestation header
       PREDICTED that would happen one day, and it has.
    3. **A refused attack was not free**, and that was a regression this work
       introduced: the guard sat after the direction draw, so three rejections
       took the journal from 3 draws to 6 and moved the hash each time. Found
       by an INDEPENDENT CODEX REVIEW, confirmed by measurement, fixed by
       building both vanilla records before the first draw. Same review caught
       that the new hash test filtered to settled goldens and therefore skipped
       the only fixture that omits the pair. **Codex earned its place in the
       precedence again: two real defects, neither reachable by the tests I
       had just written.**

  ► **AND RANKED ITEM 2 IS BUILT (2026-09-07, `86ccb68` → `dda33d4`): the
    STATUS PHASE.** The owner chose option (a), so a condition —
    burning/frozen/poison/life_stolen — is now the ONLY legal action its bearer
    has, ticks damage through the existing `magic_damage_character` model,
    draws NO rng, costs no stamina while `nextphase` still regenerates, and is
    consumed. `node tools/hotseat.mjs --enchant burning:3` plays it. Suite
    748 / 747 / 0 / 1. **Read these three before building on it:**
    1. **THE WIRE FORMAT CHANGED AND NOTHING SIGNALS IT.** Declaring
       `weapon_enchantment_damage`/`secondary_weapon_enchantment_damage` puts
       them in every combatant's projection, so **all 23 golden replay hashes
       moved** (armoured `70e605e1` → `4032d673`, measured against `842f45f`
       in a worktree). No ASSERTED pin moved, which is why the suite stayed
       green and why `86ccb68`'s message wrongly said no hash moved. An old
       peer and a new peer now hash the same battle differently and
       `ss2-map-derived-<mode>` carries no version to tell them apart.
       **The owner's call, 2026-09-07: NOT a versioned id — pin the SHAPE
       instead** (`7464ca0`). A version integer is only as good as the
       discipline that bumps it, and this repository's record on metadata
       discipline is poor; the projection's vocabulary, its DEFAULTS, the
       declared-vs-projected key sets and one canonical battle hash are pinned
       instead, so the next change to the wire format has to be a decision.
       Replaying the original defect now fails two of those pins. **The
       versioned id is deferred, not rejected: it earns its place at the first
       release or the first second implementation, when it can be tested at
       the value that matters.**
    2. **A condition carries its inflictor** (`"burning:from=villain"`), the
       owner's decision, because vanilla reads the tick damage off "the other
       gladiator" and that names nobody at 2v2. At 1v1 they coincide exactly.
       A bare flag stays legal and means "inflictor unknown": it costs the turn
       and applies nothing.
    3. **THE HERO'S RULE WAS ADOPTED FOR EVERYONE.** First match wins, and
       every condition is consumed whether or not it played. The villain's
       last-match rule and the taunted-run row are NOT modelled; a symmetric
       engine cannot have both, and the player's rule was chosen.

  ► **AND TWO THINGS THE GAME COULD NOT DO BEFORE (2026-09-07, `a380fa0`,
    `de18178`), both found by asking what the roadmap says is missing rather
    than what the brief says is next:**
    - **TEAM FIGHTS ARE PLAYABLE.** `node tools/hotseat.mjs --teams 2v2` (1-3 a
      side; four is refused BY NAME because three is what the six-slot
      measurement covered). The resolver has supported N-a-side since long
      before anything was playable and no person had ever taken a turn in one.
      Almost nothing needed changing, which is the point — the loop, the
      scoreboard and target selection already worked for N. It also makes the
      status phase's NvN inflictor rule reachable by a human for the first
      time.
    - **THE CAMPAIGN LOOP IS CLOSED.** `src/campaign/to-battle.js` —
      `rosterFromCampaignRecord(record, { blueprints })`. The roadmap said "a
      record is written and never read back into a battle"; now one can be.
      **It needs the BLUEPRINTS as well as the record and that is the format's
      real shape, not a shortcut:** `outcomes` carry survival, health,
      maxHealth and statuses and carry NO stats, loadout or resources, so a
      record alone cannot rebuild a gladiator. **Rewards are still not built,
      deliberately** — paying one is a progression decision and EP-D04 is
      pending.
    - **Conditions and bout boundaries: state this as a SWEEP, not a law.** A
      condition takes its bearer's very next turn, so a gladiator does not land
      a killing blow while carrying one, and if the bearer dies `death()`
      clears the other side too — so a 40-seed 1v1 sweep leaves no survivor
      afflicted, and a team sweep does only when a teammate ends the bout.
      **An earlier version of this line said a condition CANNOT cross a 1v1
      boundary, and a reviewer broke that universal within the hour**: the
      inflictor's death-clear took only the FIRST token per condition, so two
      tokens naming one condition left a survivor still alight. Fixed and
      pinned. The tests assert what they visit.
    - **`rosterFromCampaignRecord` reports two things it cannot prevent**:
      `seatChanges`, because a survivor behind a casualty MOVES UP (seats come
      from the array index and `"empty"` means AI-fill, not a vacant chair), and
      `playable`/`unplayableTeamIds`, because a roster including the fallen can
      never fight — a settled bout always has a wholly eliminated team. Both
      were claims this session got WRONG first and measured second.

  ► **RANKED ITEM 4 IS CLOSED, and the instruction that opened it is STALE.**
    The 16:59 brief warns that `~/projects/claude-harness/workflows/question-fanout-audit.js`
    is "the UNCAPPED pre-2026-09-02 version: no `verifierBudget`, no
    `environment` field, no `maxItems: 6`", and that any project adopting it
    re-learns the five-hour usage limit. **Measured 2026-09-07: that is no
    longer true.** Both copies carry `verifierBudget` (3 occurrences each) and
    `maxItems: 6` at the same line, and the ONLY difference between the two
    files is one `whenToUse` string — in which the HARNESS copy is the better
    of the two, because it cites `docs/adr/0001` where this repository's still
    points at `docs/overnight-agent-plan.md`. The harness is committed and
    pushed. Nothing to sync; if anything, this repository's copy should take
    the harness's wording.

*(The brief it supersedes, whose findings and ranked list are unchanged:)*
[2026-09-02 16:59 — three waves, cut at the usage limit](docs/handoffs/2026-09-02-1659--three-waves-cut-at-the-usage-limit.md). Three capped fan-out waves on the 13:40 brief's ranked items 1–3
were stopped at 92% of the session limit; ranked item 4 is CLOSED by
measurement (the branch was already pushed), item 3's premise is BROKEN (the
hero's walk count is set by the villain's approach), and the one VERIFIED
result is that nothing on the hero's one-action path reads the defender's
damage pair — so the armoured candidate's omission is correct and the fix is a
role-based requirement on the rule-set side. **Read its cost section before
launching any wave.**

*(And before that:)*
[2026-09-02 13:40 — the first armoured golden](docs/handoffs/2026-09-02-1340--the-first-armoured-golden.md).

*(And the one before that:)*
[2026-09-02 00:07 — the wave refuted more than it confirmed](docs/handoffs/2026-09-02-0007--the-wave-refuted-more-than-it-confirmed.md).

► **`ls docs/handoffs/` PUTS THE NEWEST BRIEF SECOND-TO-LAST, NOT LAST, AND WILL
  UNTIL SOMEONE RENAMES A FILE.** `2026-09-02-0130--ss2-rules-and-the-wave-that-broke-it`
  is stamped with the UTC time under a `-0400` label — it was committed at
  **2026-09-01 22:58 -0400**, so its true stamp is `2026-09-01-2258`. It carries
  a forward pointer at the top so a reader who lands on it is redirected, and it
  was NOT renamed, because every link to it would break. **This is the SECOND
  time this bug has shipped** (see the `-1950-`/`-1550-` rename below).
  **Stamp handoffs in LOCAL time and check with `git log --date=iso-local`
  before you commit one.**

  ► **IT IS NOW ENFORCED, so a third occurrence fails the suite rather than
    reaching the next reader (2026-09-02).** `test/handoff-navigation.test.js`
    derives each handoff's FIRST commit instant with
    `git log --follow --diff-filter=A --format=%at` and asserts three things:
    the head's `**LATEST:` pointer names the handoff that entered git most
    recently; that file is not one some other handoff declares it supersedes;
    and the filename stamps sort in commit order, with the two KNOWN inversions
    (`2026-09-01-0030`, `2026-09-02-0130`) listed with their reasons and
    asserted MINIMAL — an allowance that stops inverting fails as unnecessary.
    Where git history is not derivable the git-free half still runs and the
    assertion message SAYS which check it made.

    **And the test that was supposed to catch this could not.** The old
    assertion was `linked.includes(newest)` over EVERY handoff link in the
    head, and the head links five. Measured, not argued: with the LATEST
    pointer deliberately aimed at the superseded `-0130` brief, the old
    assertion still returned PASS, because the newest FILENAME was linked
    lower down the page as "the brief that opened the items the newest one
    closes". It was blind to the exact defect it was named for — the project's
    signature failure, found for the seventh time. Four mutants now die:
    repointing LATEST at the superseded brief kills two tests, deleting a
    known inversion kills the third, adding an allowance for a file that does
    not invert kills it as stale, and flipping the ordering comparison kills
    it too.

*(The brief that opened the items the newest one closes:)*
[2026-09-02 — the corpus got a consumer, and the wave broke ten of twelve claims](docs/handoffs/2026-09-02-0130--ss2-rules-and-the-wave-that-broke-it.md).**
**`src/team/ss2-rules.js` exists**: SS2's own attack arithmetic
runs inside the shared resolver, all 22 goldens replay through
`createTeamBattle`/`applyAction`, and `node tools/hotseat.mjs` plays that rule
set by default. **Its ranked items 2, 3 and 5 are now DONE or REFUTED, and item
4 is answered but left to the owner — read the newest brief, not this one, for
which is which.** Notably its item 2 is REFUTED: `activeEnchantment`'s
primary-potency pairing is byte-faithful and must NOT be changed.

**Read its corrections before quoting anything in it.** A 12-agent write-nothing
wave broke **10 of 12** load-bearing claims, and two of the breaks were
evidence-level, not stylistic: the `rest` branch has its OWN
`hitpoints += 3 + ceil(stamina)` at `+0x51d5` (the map's prose said so and this
session OVERRULED it), and `death()` deletes `nextphase` before the phase
transition can fire, so **a killing blow costs the attacker nothing** — the
golden replay had been asserting nineteen times that the engine must DISAGREE
with the fixtures' only measured attacker number. Both are fixed and both are
now pinned by tests. The battle map itself carried two errors, both corrected in
place from the bytes.

*(The previous LATEST, still the state it describes:)*
[2026-09-01 21:12 — the project became playable](docs/handoffs/2026-09-01-2112--the-project-became-playable.md).
Start there. **`node tools/hotseat.mjs` now plays a fight** — two humans, one
keyboard, to a winner — the first playable thing in this project's history, and
the answer to a question from the owner that outranks every measurement below:
**the verification machinery had become the project.** 22 runtime-verified
goldens fed nothing, the resolver ran invented formulas, and this file's own note
that "the corpus is an asset nothing consumes, and breadth is buying less than
use would" had been ranked LAST every session since it was written. **When a true
observation keeps being ranked last, that ranking is the finding.**

It also adds the `map-derived` verification tier — whose absence, not effort, is
what kept SS2's real arithmetic from ever being wired in — retracts the previous
handoff's ranked items 1 and 3 by measurement, and makes the raw archive
verifiable (`captures/ARCHIVE-MANIFEST.sha256`) and mirrored. Three waves, all
VERIFIED, **28 of 48 verdicts BROKEN**: read the corrections, not just the claims.

Its retraction of the 15:50 ranked item 1 still stands and is worth the summary:
an arming gate keyed on the fixtures would have armed **0 times in 38**, its hero
predicate CONTRADICTS all eight target fixtures, and a new branch in it is dead
code under `validate-vehicle.ps1`. But **35 of 38 archived rounds already
reproduce the fixture on every pinned field except `staminaleft`**, and
`hero.staminaleft == 110 − (walk count)` holds 38 of 38.

**Still current, and superseded only in its ranking:**
[2026-09-01 15:50 — Codex independence, and what the corpus actually proves](docs/handoffs/2026-09-01-1550--codex-independence-and-the-corpus-archetype.md).
It carries how to drive a capture from WSL (five things nothing had
written down, three of which fail looking like a wrapper defect), and — read this
one carefully — a derivation that the armoured/tournament villain `staminaleft`
is 110 which was **RETRACTED the same day by its own author**. Neither 110 nor
105 is determined by the scenario. See § "Found 2026-09-01" for the retraction.
Both of its agent waves completed VERIFIED (209/209 and 230/230 verifiers, zero
errors). An independent Codex review then found what neither wave did — 67 raw
traces wrongly committed — so read its opening paragraph before quoting it.
*(That file was renamed from `…-1950--` to `…-1550--` on 2026-09-01 with the
owner's approval: it was stamped in UTC while claiming `-0400`, which would have
kept `ls docs/handoffs/` pointing the next session at the superseded brief.)*

**Two earlier sessions closed the night of 2026-08-31 and each left a handoff.
Read both, and know which answers what** — `ls` puts the migration one last, and
it is not the corpus brief:
[00:30 — migration close-out, and what is untested](docs/handoffs/2026-09-01-0030--migration-closeout-and-what-is-untested.md)
covers the WSL/Windows split and what on this machine has never been exercised;
[00:21 — corpus repair and doc-integrity guards](docs/handoffs/2026-09-01-0021--corpus-repair-and-doc-integrity-guards.md)
covers the goldens, the promotion driver and the ranked work, and supersedes
`2026-08-31-2244`.

---

**THIS FILE IS SPLIT. Everything above `## THE ARCHIVE LINE` is the LIVING HEAD:
state, rules, next steps and open items. It is appended to and CORRECTED IN
PLACE. Everything below that line is frozen evidence and history — do not append
there.**

The invariant, which this project has now broken twice: **there must be exactly
ONE document where a wrong instruction can be corrected in place, and it must be
the one `AGENTS.md` points at.** That document is this head. A handoff under
`docs/handoffs/` is frozen the moment its session ends, so a correction that
lives only there never reaches the next reader — which is how a false top-ranked
next step survived in this file while a correction 270 lines above it already
said so. **Retract AT THE INSTRUCTION, not only above it.**

If you find a live instruction BELOW the archive line that is not represented up
here, HOIST IT UP rather than correcting it in place.

---

## What to read, and what you may skip

**The living head is ~810 lines and a session should not have to read all of it
to start.** This map is keyed on WHAT YOU ARE ABOUT TO DO, deliberately not on
the numbered next-steps list — that list renumbers every session, and a map
pinned to its numbers would rot within one. Added 2026-08-31 by the first WSL
session, whose measured complaint was ~50 KB of reading before any work began.

**Everyone reads:** § "READ THIS FIRST — corrections from the 2026-08-31 audit pass",
and § "Non-negotiable rules (each learned the hard way)". Nothing else is
universal.

| If you are about to… | read | and you may skip |
| --- | --- | --- |
| promote, re-promote, or touch a golden's provenance | § "What the re-promotion did and did not establish", § "The pairwise gate: what the 2026-08-31 measurement settled" | the staging/wrapper sections |
| author or re-derive a candidate fixture | § "Next steps, in order", § "The single most important correction" | everything about the promotion gate |
| run a capture, or edit the wrapper | § "What is running, and how to run it", § "`validate-vehicle.ps1` proves less than its name suggests", § "AVM1 has ONE comparison opcode" | the whole of § "Open items" |
| land a field exclusion (`staminaleft` or any other) | § "The pairwise gate: what the 2026-08-31 measurement settled" IN FULL, and § "Read this before you touch the staminaleft exclusion" in the 18:20 handoff | § "What changed at the level of what this project can do" |
| change the campaign driver or the test suite | § "Open items" → "Found 2026-08-31, not yet closed" | the champion/DNA chronology |
| work on the design track | `design/endless-progression` only — and see § "The design track is deliberately quarantined" first | ALL of this file, deliberately |

**Two things no section title advertises, and both have cost a session:**

- **An observation record's FILE NAME is not its `observationId`.**
  `obs-20260830-auto1.json` carries `obs-diag`, `auto2` carries `obs-nav6`,
  `auto3` carries `obs-gold3`. Key on the id inside the file, always. Keying on
  the name silently no-ops rather than failing.
- **`captures/` absent is a CAPABILITY boundary, not a test-count difference.**
  The raw traces are the only artifact that can distinguish two independent
  captures from a copy — the normalized records cannot, measured. They are
  Windows-side and gitignored, so ~~**a question that turns on record
  independence cannot be settled from a WSL clone at all.**~~ The 1-skipped test
  profile is the visible symptom of this, not the substance of it.

  ► **CORRECTED 2026-09-01 (evening). THE ARCHIVE IS FULLY READABLE FROM WSL, AT
    `/mnt/c/ss2-capture/captures`** — 240 entries, 1,603 files, 42 of them
    `session-adc*`; `grep`, `find` and `node` all read it normally. The
    distinction the old sentence missed is CLONE versus MACHINE: a fresh clone
    has no `captures/`, but a WSL session ON THE CAPTURE BOX reaches the Windows
    tree through `/mnt/c`. **This wording is what would have stopped this
    session's central measurement**, and two independent agents flagged it before
    taking any number. Two further copies of it live at line ~1492 ("the archive
    is not reachable from Linux") and line ~1524 ("not adjudicable from a WSL
    clone at all"); both are struck there too. Retract at every site.

  ► **SUPERSEDED THE SAME EVENING, BY MY OWN OVER-READING — AND THE FIX IS
    DONE. `D:` WAS UNPLUGGED, NOT GONE.** When the owner attached the drive,
    `D:\ss2-backups` turned out to hold a real mirror from 2026-08-31:
    **1,589 files / 19,904,374 bytes**, matching this file's recorded figure
    exactly, plus mirrors of the snapshot store and the Ruffle profile. So the
    bullet below is right that only ONE copy was REACHABLE, and it invites the
    stronger reading that only one EXISTS. It did not. **State reachability and
    existence separately; an unplugged drive is a latency, not a loss.**

    **Current state, 2026-09-01 evening, verified rather than asserted:**
    `D:\ss2-backups\captures-2026-09-01` now holds all **1,588 files /
    18,194,754 bytes**, hashed file-by-file on `D:` and compared line-for-line
    against `captures/ARCHIVE-MANIFEST.sha256` — **1,588 of 1,588 match**.
    (It was 1,603 / 20,008,972 until 15 UI screenshots were moved out of the
    evidence archive to `C:\ss2-capture\ui-shots\` the same evening, with the
    manifest and the mirror both regenerated and re-verified afterwards. The
    drop is a relocation, not a loss — see `captures/README.md`.)
    `ss2-capture-snapshots-2026-09-01` (225 files) and
    `ruffle-SharedObjects-2026-09-01` (6 files, the whole Ruffle profile
    including `openh264-2.4.1-win64.dll`, which a WSL-driven capture needs
    seeded) are alongside it, matching the 08-31 naming convention.
    **The manifest is now committed at `captures/ARCHIVE-MANIFEST.sha256`** —
    the one file under `captures/` that is not gitignored — so any future copy
    is checkable with `sha256sum -c`. Read `captures/README.md` for what it does
    and does not prove: it is an integrity check, NOT a provenance claim, and a
    copy hashes exactly like its original.

    ~~**What is genuinely gone is the OneDrive tree**, which now holds only
    `ss2-team-arena-foundation.bundle` — a git bundle, which by construction
    cannot carry gitignored traces. So it is two copies, not three, and the
    second one is normally unplugged.~~

    ► **WRONG, AND CORRECTED 2026-09-07 BY MEASUREMENT. THE ONEDRIVE TREE IS
      NOT GONE, AND IT IS A THIRD COPY OF THE EVIDENCE ARCHIVE.**
      `/mnt/c/Users/corey/OneDrive/Documents/ChatGPT/SS2 Multiplayer Mod/ss2-team-arena-foundation/captures`
      holds **1,589 files / 19,904,374 bytes, including 292 raw `.rufflelog`
      traces** — byte-for-byte the figure this same section records ~20 lines
      above for the 2026-08-31 `D:` mirror, so it is a frozen replica of that
      snapshot rather than a bundle. The directory alongside it carries
      `_RETIRED-DO-NOT-WORK-HERE.txt`, which is presumably why a previous
      session inferred it had been emptied and never looked. **So it is THREE
      copies, not two**, and two of the three are reachable from a WSL session
      on this box right now. *(How this got written: the retired tree was
      checked for a git bundle, found to have one, and the presence of the
      bundle was read as the absence of everything else. State what you
      measured, not what you inferred from one file.)*

  ► **`/mnt/d` FAILING DOES NOT MEAN `D:` IS UNPLUGGED, AND THIS FILE HAS NOW
    DRAWN THAT WRONG INFERENCE TWICE. Measured 2026-09-02.** `ls /mnt/d` returns
    `cannot access '/mnt/d': No such device` while the drive is **attached and
    healthy**: `powershell.exe -NoProfile -Command "Get-PSDrive -PSProvider
    FileSystem"` reports `D` with 4.79 TB free, and `D:\ss2-backups` holds all
    seven expected directories (`captures-2026-08-31`, `captures-2026-09-01`,
    both `ss2-capture-snapshots-*`, both `ruffle-SharedObjects-*`,
    `ui-shots-2026-09-01`) plus `README.txt`. **The evidence mirror is intact.**

    The failure is a STALE WSL 9p mount, not a missing disk — the mount entry
    still exists (`mount | grep /mnt/d` shows `D:\ on /mnt/d type 9p`), it just
    no longer resolves, which is what happens when the drive is attached after
    the WSL instance starts. Repairing it needs `wsl --shutdown`, which kills
    every running WSL session, so it is the owner's call and not something an
    agent should do mid-session.

    **So: check `D:` from Windows, never from `/mnt/d`.** A session that reads
    `/mnt/d` and concludes the backup is gone will report a data-loss scare that
    is not real — which is exactly what this file did, and the bullet below is
    left standing only because its OTHER measurements hold.

  ► **AND THE ARCHIVE HAS ONE REACHABLE COPY TODAY, NOT THREE.** The head says
    below that three exist (live tree, retired OneDrive tree, `D:`). Measured:
    `D:` is not attached (`/mnt/d` is an empty mount point), the OneDrive
    Documents tree holds only `ss2-team-arena-foundation.bundle` — a git bundle,
    which by construction cannot carry gitignored traces — and a bounded search
    of `/mnt/c` to depth 5 finds every `.rufflelog` under
    `/mnt/c/ss2-capture/captures` and nowhere else. **1,603 files, ~20 MB, the
    primary measured evidence the whole corpus is ingested from, unreplicated.**
    Note the exposure inverts what the head assumes: the archive sits OUTSIDE the
    Claude MSIX container, so an app reset does not touch it — while the
    save-state store INSIDE the container (75 snapshots, ~62 KB) is the smaller
    store. **Protecting the container does not protect the evidence.**

## The design track is deliberately quarantined

A separate track researches endless progression, on branch
`design/endless-progression` (PR #1), and it now carries a complete proposed
Arena Circuit progression, loot, inventory, opponent and settlement design.

**Design must never flow into candidate authoring.** A candidate fitted to a
design is a candidate fitted to a hypothesis, and the capture that "confirms" it
confirms a fit rather than a prediction — which is the one failure this whole
pipeline exists to prevent. The rule is not that the two tracks disagree; it is
that the measuring instrument must not be shaped by what anyone hopes to
measure. Read the design if you are working on the design. Do not read it while
authoring a fixture.

This omission is mine: the rule was in the previous handoff and I dropped it
when rewriting this file, at exactly the moment the design track grew from a
brief into a full proposal.

## 2026-08-31 Endless readiness update

The docs-only branch `design/endless-progression-readiness` adds the
[six-decision owner record](docs/design/endless-progression-decisions.md) and
[MVP readiness record](docs/design/endless-mvp-readiness.md), refreshes the
reference-game and SS2 mod-scene research, and red-teams the stable proposal.
It implements no Endless mechanics and does not authorize implementation.

Before any Endless code, the owner must accept EP-D01–EP-D06 and EP-A01–EP-A03,
or supersede any of them with a fully normative, explicitly accepted replacement.
A rejection or open revision remains blocking. The audit also requires complete
designed combat and Pressure specifications, a JSON/u64 encoding decision, rule-contract
v2/provenance, canonical active-battle state, collision-resistant durable
digests, one atomic progression boundary, crash-safe settlement, and separate
headless/playable gates. Playable work additionally needs an evidenced
per-action animation-completion signal. The branch did not run capture tools,
launch Ruffle, or touch parity evidence, candidates, classic rules, or the
licensed installation. Its fresh-worktree verification profile is 584 tests:
583 passed, one expected raw-trace archive check skipped, and zero failed.

*(Rescued 2026-09-01 when `main` was merged into this branch: this section reached `main` through PR #2 and had never been on `arena/champion-capture`, so the branch would have carried a HANDOFF.md that silently lacked it.)*

**Repository naming.** The GitHub repo was renamed to
`Zanzagar/swords-and-sandals-2-multiplayer`; the `github` remote already points
at the new URL. The local worktree directories and the `origin` bundle keep the
old `ss2-team-arena-foundation` name **intentionally** — do not rename them or
hand-edit worktree metadata. `package.json` still carries the old identity on
`main`; the migration is part of PR #1 and lands when that merges.

## Working agreement for parallel agents

Exclusive file ownership stated in every prompt; no agent runs a state-mutating
git command; no agent launches Ruffle or touches the installation, the save or
the snapshots; adversarial verifiers write nothing at all.

**The limit is the file graph, not the budget.** Writers are capped at ten to
twelve coherent slices. Auditors have no cap, because they write nothing and
cannot conflict — and several independent auditors on the same target is a
quality technique, not duplication. Give each one ONE named claim to break.

## Keep the project lawful and reversible

Use only a licensed local copy for inspection. Keep originals untouched, work in
a separate mod folder, and distribute patches or independently authored files
rather than the original game files or assets.

---

## READ THIS FIRST — corrections from the 2026-08-31 audit pass

A 13-agent write-nothing audit checked EVERY hand-authored scalar in all 60
candidates against a byte-level derivation. **Roughly 3,300 scalars derive
cleanly with no free parameter; 60 do not.** The corpus is about 98% sound, and
four claims below this line are now WRONG. They are corrected here rather than
edited away, because each was load-bearing.

~~**Baseline is 622 tests, 0 failed, 0 skipped**~~ ► **808 / 807 / 0 / 1
(fresh-clone), measured 2026-09-07. Every number in the parenthesis below is a
historical trail, not a baseline — read it as history and measure the current
one.** (614 at the end of the audit pass,
617 by the end of that session — a number this file was never updated with, so
every "614" below it was stale on the day it was written; 620 after `2b123b9`.
Was 603 before the audit pass; the "602" written below was already stale when
written — `20197f2`'s own message says 603). `github/main` is **`362859a`** — corrected 2026-09-01; this
line has now named a stale tip twice, first `e3f14aa`, then `4409ec7`. `4409ec7`
was PR #2 (`design/endless-progression-readiness`) merging; `362859a` is the
`.mailmap` landing directly on `main` — a normal commit with `4409ec7` as its
only parent, authored by Corey, not a PR merge. **So `main` does take direct
commits; "do not push to `main`" binds AGENTS, not the owner.** That `.mailmap`
is the one the authorship decision left as available-if-ever-needed, so that
part of the record has moved too. **Re-derive this rather than trusting it:
`git fetch github && git log --oneline -1 github/main`.**
No PR is open for `arena/champion-capture`, which is now 61 commits ahead of
`main` — every promoted golden and the whole capture pipeline sit unmerged. **`gh` IS installed and authenticated
in WSL** (2.98.0, `Zanzagar`) as of 2026-08-31; it is NOT installed on Windows.
`git ls-remote github "refs/pull/*/head"` works in both and needs no `gh`.

► **THE "IMPOSSIBLE" FIXTURES ARE REACHABLE. This is the correction that changes
  the roadmap.** This file has said no tool path can change hero `attack` or
  `defence` — "not `-StageHero`, not the shop, not levelling" — and on that basis
  22 fixtures were written off. **The third clause is false.** Root frame 227
  (`levelup`) places character 2265, carrying eight `+` buttons, one per base
  stat, each with the identical body behind a `statpoints > 0` guard:
  `1596` strength, `1600` speed, **`1602` attack**, **`2252` defence**,
  `2253` vitality, `1608` charisma, `2254` stamina, `2264` magicka. No per-stat
  cap, no exclusion. And the writes PERSIST: `constructDNA` reads `hero.attack` at
  `+0x1e1b` and `hero.defence` at `+0x1e36` into `charDNA`; `initcharacter`
  restores them from DNA indices 18 and 19; button 2283 calls `backup_char` and
  `restore_char`, both ending in `constructDNA`. So a spent point survives the
  per-turn re-skin that discards every `-StageHero` write. Entry is ordinary play
  — `gotoAndPlay("levelup")` has exactly ONE site in the build, on button 775 of
  the reward overlay. The wrapper spends all four points into `vitality` BY POLICY
  (it replicates button 2253 verbatim), to keep sessions comparable. **That is a
  choice, not a limit.** Verified independently by the main session with
  `inspect-swf --references 'statpoints'`. Detail is in `ss2-battle-map.md`.

  Still to do: the arithmetic of which exact stat vectors are hittable under "four
  points per level, all four must be spent" (GATE C will not release the level-up
  screen until `statpoints` reads 0). Note also that the impossible-hero set is
  better identified by `attack 11 / defence 11` (15 fixtures) than by the
  strength/damage signature this file uses, which catches only 14 and misses
  `candidate-grievous-knockback`; and the `attack 3 / defence 2` duel pair was
  never counted at all.

► **THE TRANSCRIPTION IS FIVE FIXTURES, NOT THE WHOLE CORPUS.** A digest detector
  flags 23 candidates; only FIVE are transcriptions. **Digest equality between a
  candidate and an observation is the signature of a CORRECT PREDICTION, not of a
  copy** — when a map-derived candidate is right, the confirming observation has an
  identical scenario and tape by definition. The discriminator is lineage, not
  identity. Relabelling the other eighteen would have installed eighteen false
  provenance claims and made ten probe goldens permanently unpromotable. The five,
  each with the commit that landed fixture and record together:
  `candidate-prisoner-normal-kill` ← `obs-20260830-t1` (`135f211`),
  `-dir8` ← `obs-20260830-u1` (`5f45627`), `-dir6` ← `obs-diag` (`19aead3`),
  `-dir5` ← `obs-nav6` (`5317cec`), and
  `candidate-duel-firstblood-normal-kill` ← `obs-20260830-e1` (`74a07a4`).

  **Four goldens counted their candidate's own source record as one of their two
  "independent" observations.** `135f211` says so in plain words and draws the
  opposite conclusion. That is now REFUSED (`7856e2b`, `141e98a`). **DONE
  2026-08-31: all four are RE-PROMOTED, pipeline only, from every other
  committed record that matches them** — 3, 5, 9 and 4 records respectively,
  each from that many distinct sessions. Their scenario, samples and expected
  blocks are byte-identical to what they were; only `provenance` moved. Read
  the block "What the re-promotion did and did not establish" below before
  quoting it as an independence result.
  What is NOT in question: the goldens' measurements. The game really does produce
  those outcomes. What was broken is the provenance argument, and for four of them
  the independence of the pair.

► **THE PRESCRIBED `staminaleft` FIX IS DEAD. Do not write it.** Its premise —
  that `staminaleft` is inert — is false: the map has it gating which attack
  buttons exist, forcing the rest phase, and steering the villain AI. Separately,
  an auditor promoted a golden from two records disagreeing by **99,992 stamina**
  with the new pairwise gate installed and silent, because this repository's only
  existing exclusion (`comparableSamples`) is PROJECTION-side, and a
  projection-side exclusion silences the gate. The sound path is to **fix the
  capture, not the comparison**: pin the approach-step count so the value is
  deterministic, turning a silent non-match into a visible refusal. That needs a
  wrapper edit and supervised rounds. And do NOT "restore" 105 to 110 — 105 is a
  TRUE description of that route; the defect is that the fixture pins a quantity
  the scenario does not determine.

► **THE PAIRWISE GATE'S DORMANCY IS SETTLED — run
  `node tools/pairwise-gate-dormancy.mjs`, do not read the next two paragraphs
  as current.** The gate HAS TEETH (407 free leaves it alone refuses, all at
  `/samples/*/callSite`) and on committed evidence it still refuses NOTHING,
  because the nonce check refuses every forgery about forty lines earlier. Both
  facts, and what they do and do not license, are in the block at
  "The pairwise gate: what the 2026-08-31 measurement settled" below. **The
  "162" retraction in this bullet is itself wrong: 162 reproduces exactly.**

  *The original bullet is kept below because it was load-bearing.*

► **THE PAIRWISE GATE'S DORMANCY NUMBERS ARE WRONG, and the gate is weaker than
  recorded.** **Both numbers in this bullet are wrong — see the note below it.**
  **And the correction is wrong too: see the settled block below.**
  "162 leaves" is a full-record count, not the comparison projection's
  (142); over the surface it names at least 10 leaves can differ, not 0, and 2 of
  them MUST differ in every legitimate promotion. The gate is LOGICALLY unable to
  fire on the promotion path. **The largest hole in the pipeline is now this: two
  fabricated observations that are copies of EACH OTHER still promote a new
  golden.** Before any field exclusion ever lands, make
  `projectSs2ObservationForComparison` structurally incapable of sharing an
  exclusion with the matcher.

  **Both halves of that were done on 2026-08-31.** The projection split landed in
  `f2a57c4`. The copy hole is closed in `2b123b9`, and closing it needed
  something the paragraph above did not see: **no pairwise comparison could ever
  have caught it**, because copies agree, and agreement is what that gate checks
  for. It went through the nonce instead. `cc42503` had already made
  `launchNonce` mandatory at INGEST, but the promotion gate bound only the
  records that HAPPENED to carry one — so deleting the key from the copy walked
  past it, which was demonstrated end to end against the committed corpus. Absence
  is now enumerated: `src/golden/pre-nonce-observations.js` names by digest the 58
  records that predate the field, the list may only ever shrink, and three tests
  audit it. **What is still open, and is smaller than what was closed: a forger
  who MINTS A FRESH NONCE for the copy is refused by none of this.** A nonce off
  the wrapper is unverifiable text; no repository-side check distinguishes one the
  player minted from one a person typed.

Also corrected this pass: three circular warrants in the staging docs — including
`capture-staging.md:318`, which attributed the villain's `100→95` to the HERO's
five walks, when `+0x32a1..+0x3304` mutate `game_attacker.staminaleft` ONLY, so
that derivation was impossible — and five wrong rows in the `staminacost` table,
notably `rest`, which is `0 - round(stamina*15)`, a GAIN, not 0.

Not yet done, in priority order (the projection/exclusion hazard and the copy
hole that led this list are both closed — see the paragraph above; ~~re-promote
the four goldens from eligible records~~ **DONE 2026-08-31**): correct the
CONTRADICTED scalars in non-promoted fixtures (7 of 9 misc-a carry a
strength/damage triple no weapon row in the build produces; two pin an enchantment
potency of 5 against a cap of 3; spell `damageMethod: null` for ids 31/32/35 where
the bytes pass `"burning"` and `"lightning"`; villain blocks omit `<piece>_defence`
fields `battlevalues` rewrites every phase); the stub rewrite (**only 4 of 15**
hook slots can change the vehicle gate's PASS/FAIL, and every `dbg` line —
including every `wrapped:`, `capture-refused-*` and `attacker-resolved-*` — is
stripped before the match); and the attacker identity, whose record field is
written 16 lines before the game is loaded.

## State at the end of the 2026-08-31 session

22 promoted goldens and **no runtime evidence yet for the champion, armoured or
tournament families**. **622 tests, all passing, 0 skipped** (this paragraph said 602, then 614; see the corrections block above) in a capture-bearing
worktree.

The 2026-08-30 session landed 38 commits (`1d829c7..2d70738`); the previous
handoff said 36. PR #1 and PR #2 have since merged and `github/main` has moved past both — it is
`362859a` as of 2026-09-01, and `4409ec7` and `ecf4510` are both still ancestors
of it (checked with `git merge-base --is-ancestor`, not assumed) — and the
2026-08-31 session added the commits on `arena/champion-capture`.

### Expected test profiles

► **DO NOT READ ANY NUMBER IN THIS SECTION. MEASURE. Re-measured 2026-09-07 on
  this tree: `808 tests, 807 passed, 0 failed, 1 skipped`** — the fresh-clone
  profile, since this tree's `captures/` holds only `ARCHIVE-MANIFEST.sha256`
  and `README.md`. **The SHAPE of the section is what is durable and it still
  holds**: two profiles, differing by exactly the raw-trace archive existence
  check, and a partial archive fails rather than skipping.

  *(This block previously said "STALE BY 8 … read every 622 below as 630 and
  every 621 as 629". That correction was itself stale by 178 when it was found
  on 2026-09-07, and its substitution instruction was wrong at both values — so
  a reader following it would have replaced one wrong number with another. A
  correction that carries a number goes stale exactly as fast as the number
  did; the durable fix is to state the COMMAND, which is
  `node --test --test-concurrency=1` from the repo root.)*

- A capture-bearing operator worktree with the complete ignored raw-trace
  archive runs **every test, 0 skipped, 0 failed**. *(Last measured at a total
  of 622 on 2026-08-31; the total is now 808 and this profile has NOT been
  re-measured since — do not assume 808/0.)*
- A fresh clone or worktree with none of those ignored traces runs **one test
  fewer passing and 1 skipped**: measured 2026-09-07, `808 tests, 807 passed,
  1 skipped, 0 failed`. The skipped test is the raw-trace archive existence
  check; the committed observation and divergence integrity checks still run.
- A partial raw-trace archive does **not** skip: it fails and names every
  missing expected trace.

**Both profiles were MEASURED AGAIN at `ce5699f`, not derived by adding 2** —
622 passed / 0 skipped in the capture-bearing tree, and 622 tests / 621 passed /
1 skipped in a detached worktree holding only committed content, which is the
fresh-clone condition. The two tests added that session run in both. They were
first measured the same way at `2b123b9` (620/0/0 and 619/1/0).

Doing this every time is worth the minute: the four sessions before `2b123b9`
each carried the previous session's count forward untouched, which is how "614"
survived in three places after the suite had reached 617.

**The skip is now anchored, and this is the part that changed.** It used to skip
whenever zero expected traces resolved, and a count of successful lookups cannot
tell "fresh clone" from "the path derivation is broken" — three one-character
edits each made it skip silently on a machine holding the complete archive, and
the resulting run was byte-identical to the fresh-clone profile documented
above. It now requires a POSITIVE anchor: `captures/README.md` is the one path
`git ls-files captures` returns, so it exists in a fresh clone AND on an
operator machine. If it does not resolve, the derivation is wrong and the test
FAILS naming it, instead of skipping.

So a skip no longer needs a human to check which kind of machine they are on.

Read this section, then [`docs/overnight-agent-plan.md`](docs/overnight-agent-plan.md)
for how the parallel work is organised.

### What changed at the level of what this project can do

1. **Parallel capture works.** `-SaveDirectory` was never broken. Three
   concurrent sessions complete in 22s against ~45s serial, all matching
   promoted goldens, master save byte-identical.
2. **The leveled-gladiator arena route runs end to end.** A gladiator was taken
   1 → 4 and fought the tournament ladder to rank 2 in five of six attempts.
3. **The wrapper can stage a scenario and buy equipment**, both owner-approved,
   both declared in the evidence.
4. **The champion's numbers were derived with no free parameter, from formulas
   committed a day before the champion was ever met.** `unleash_hell`'s
   hard-coded DNA, read through `initcharacter` and `battlevalues`, gives
   `hitpointsmax` 110 and `armourclass` 86, and thirteen live draws recorded
   exactly those. Five `candidate-champion-*` fixtures exist.

   **The previous version of this file said the champion was "decoded from the
   map before it was ever seen" and that the reading "PREDICTED" those numbers.
   That is not what the record shows, and the overstatement was mine.** It is
   corrected here rather than quietly fixed because it was load-bearing: it was
   the stated reason to trust the champion family, in the document a new session
   reads first, on a project whose whole discipline is that a candidate fitted
   to a known answer makes its own confirmation meaningless.

   The chronology, established by an auditor and then checked independently:

   - `6dc750e` (2026-08-29 23:57) already carried every term needed —
     `hitpointsmax = herolevel * 10 + vitality * 20`, the per-piece armour
     multipliers, and decisively the `helmet > 25` branch — at
     `docs/integration/ss2-battle-map.md:131-134`, in a file that contains no
     champion.
   - The thirteen draws ran 2026-08-30 21:31 to 22:06.
   - `ss2-champion-dna.md`'s only commit before today, `5d3d777`, is
     2026-08-30 22:48 — **42 minutes after the last draw.**

   So the FORMULAS were effectively pre-registered, some 21 hours before the
   opponent existed in this project. The DNA INDEX MAP was written afterwards.
   That map has no fitting freedom to exploit — 50 strictly sequential
   `characterDNA[n]` assignments, re-derived mechanically from the opcode stream
   and matching the published table offset for offset — but "written afterwards"
   and "predicted" are different claims, and only the first one is true.

   The pre-registration is the stronger argument anyway, and the old wording
   omitted it entirely. Without the `helmet > 25` branch the same arithmetic
   gives `armourclass` 1081 rather than 86, so that branch is exactly the
   constant a back-fit would have had to invent — and it was in the repository a
   day early. [`ss2-champion-dna.md`](docs/integration/ss2-champion-dna.md) now
   states this as a postdiction in its own text, and says it must not be
   restated as a forward prediction.

### The single most important correction

**Five separate adversarial passes each found the same defect class — a test
whose assertion cannot fail — and each one had been hiding a real bug.** That is
now the project's most reliable signal, and the reason to keep running
write-nothing auditors against named claims.

Two forgeries against the promotion gate worked *by the documented pipeline*
and are now closed:

- **The launch-nonce gate was opt-out.** Copy a raw trace, change the ids,
  delete the nonce key: both ingest, both promote, and you get a golden claiming
  two independent sessions from one capture. Now mandatory for
  `injected-tape-runtime` on the same terms as `overdraw`.
- **An observation could carry unlimited invisible draws.** Cosmetic opcode
  rolls are excluded from matching by label regex on *both* sides, so a record
  with 120 fabricated debris rolls matched a 7-sample fixture. Records now
  refuse opcode samples outright — the doc's own reasoning (no instrumentation
  can observe the opcode stream) is exactly why no record should hold one.

**The 22 goldens are sound.** Independent re-derivation reproduced every one
byte-for-byte; manifests, digests and cited observations all resolve.

---

## What is running, and how to run it

| Script | Purpose | Guards |
| --- | --- | --- |
| `run-campaign.ps1 -Concurrency N` | capture families in parallel | refuses `N>1` for any navigator but `prisoner` |
| `run-arena.ps1` | the save-mutating arena route | refuses to start without a fresh snapshot, takes it itself, hashes before/after |
| `launch-capture.ps1` | one session; the only script with `-Autopilot` **and** `-ArenaPolicy ''` together | **no snapshot guard** — see Open items |
| `validate-vehicle.ps1` | wrapper gate after any edit | prints the source hash it compiled, and what it does not prove |
| `save-state.ps1` | snapshot/restore | refuses an empty tree, and refuses to restore a WIPED save |

► **THE "ONLY SCRIPT WITH BOTH `-WatchFields` AND `-Stage*`" CLAIM WAS STALE AND
  IS CORRECTED ABOVE (2026-09-02).** `run-arena.ps1` declares
  `[string] $WatchFields = ''` at `:137` and forwards it to `launch-capture.ps1`
  at `:295` (appended only when non-empty), alongside `-StageHero`/
  `-StageVillain` at `:100-101`. So **`run-arena.ps1` carries staging, watch
  fields AND its own snapshot guard together**, and the armoured removal pair
  does NOT have to go through the unguarded vehicle.

  **It is exercised, not merely declared:** five rufflelogs in the archive
  (`arena-champ-2`, `session-champ-n1`) emit
  `{"t":"dbg","at":"watch-extended","added":11}` — the eleven names in
  `run-arena.ps1`'s own header at `:66`. Verify with
  `grep -oh '{"t":"dbg","at":"watch-extended"[^}]*}' /mnt/c/ss2-capture/captures/*/*.rufflelog`.

  What is still TRUE of `launch-capture.ps1`, and must not be swept up in this
  correction: it remains the only script that can pass `-ArenaPolicy ''` with
  `-Autopilot` (`run-arena.ps1:267-269` does not forward those). That is why
  only the two DIRECTION-5 armoured members clear the guarded vehicle; a
  non-normal-band member still needs the unguarded one.

Snapshots: **`level4-vitality-tournament-gate`** (vitality 13, 5723 gold,
`current_tournament` 1 — `hitpointsmax` reads 220 in the level-up log because
`battlevalues` last ran pre-spend; the formula gives 300) and
**`level4-armed-weapon39`** (the same gladiator after a shop trip: weapon 39,
843,130 gold, strength and speed 60). `verified-good-1701` and `pre-arena-path`
are the original level-1 gladiator.

**`zainger-repaired` is a WIPED save under a reassuring name.** `save-state.ps1`
now refuses to restore it without `-Force`.

► **THE SNAPSHOT STORE IS 75 DIRECTORIES HOLDING ONLY 7 DISTINCT SAVES, AND THE
  LIVE SAVE IS ALREADY ONE OF THEM. Measured 2026-09-01 (evening) by hashing
  every `ss2_data.sol` under `/mnt/c/ss2la/ss2-capture-snapshots`; the head's
  "74" at line ~608 is stale.** Distribution of the 75:
  **58** share `2514b1cb…`, 12 share `6a06e9e8…`, and five are unique.
  ► **THIS POINTER RESOLVES NOWHERE, AND THE SURVEYOR CHASED IT TO THE WRONG PLACE
    TOO.** There is no "74" at the line named — that line is about `github/main`'s
    tip. The referent BY CONTENT is the "74 snapshots" sentence in § "Driving the
    capture pipeline FROM WSL", which IS in the living head, and **which still
    says 74 today** — so the correction announced here was never applied at the
    sentence it corrects, and 74 is now wrong twice over (the store holds 1,429
    directories). Fixed by quoting the text instead of a line: search
    `grep -n '74 snapshots' HANDOFF.md`.

  ► **DENOMINATOR STALE BY TWENTY-FOLD; THE SHAPE IS EXACTLY INTACT.** Re-measured
    2026-09-07: **1,429 snapshot directories, not 75** — and still exactly 7
    distinct saves, still 12 sharing `6a06e9e8…`, still five unique; the big
    cohort is 1,412 sharing `2514b1cb…`, not 58. Every snapshot dir holds exactly
    three files. **This is a live growing store, so the durable form is the
    command, not the number:**
    `find <snapshot-root> -name ss2_data.sol -exec sha256sum {} + | awk '{print $1}' | sort | uniq -c | sort -rn`.
    The "the live save is already one of them" half was NOT re-derived — reading
    the live save is outside the read-only boundary.


  **The operationally useful part: the LIVE save is `2514b1cb…` too** — byte
  identical to those 58, which include `level4-vitality-tournament-gate`. So for
  the armoured/tournament family **"restore `level4-vitality-tournament-gate`"
  is a no-op today and destroys nothing**, and the starting state that family
  needs is redundantly preserved 58 times over. That removes the restore risk the
  runbook warns about — but NOT the run risk: `run-arena.ps1` mutates the live
  save DURING a run, which is why it takes its own snapshot and why a fresh
  snapshot name stays mandatory.

### Codex: which machine owns which config, and what is actually installed

**BOTH `.codex/config.toml` files that matter are on THIS box.** Corrected
2026-09-01 by the peer session `Codex workflow operations`, which is on a
DIFFERENT physical machine (Corey's primary WSL box). This machine is the
migrated capture machine — WSL agents plus a Windows-native capture side — so
"the Windows config" is ours, not theirs. I had assumed the opposite and relayed
it to them; they sent it straight back.

| Config | Model / effort | Owner |
| --- | --- | --- |
| `~/.codex/config.toml` (this box, WSL) | `gpt-5.6-sol` / **`xhigh`** | ours — briefly raised to `ultra` 2026-09-01 and REVERTED the same day, see below; backup of the ultra state at `~/.codex/config.toml.bak-20260901` |
| `/mnt/c/Users/corey/.codex/config.toml` (this box, Windows) | `gpt-5.6-sol` / **`ultra`**, plus `service_tier = "priority"` | ours — ALREADY aligned, no change made |
| the peer machine's | `gpt-5.6-sol` / `xhigh` | theirs; divergence is deliberate and in front of Corey |
► **RE-MEASURED 2026-09-07: the WSL row is now `gpt-6-astra` / `medium` /
  `service_tier = "fast"`; the Windows row still HOLDS exactly.** ► **And the
  backup file this sentence names does NOT hold "the ultra state" — it holds the
  PRE-ultra state.** This is a live-mutable store, so the durable form is the
  command: `cat ~/.codex/config.toml` and
  `cat /mnt/c/Users/corey/.codex/config.toml`.


`codex` is NOT on the Windows PATH here, which fits the migration guide's
position that agents run in WSL and the Windows side is capture-only. The
Windows file is full of `\\?\C:` paths and bundled-plugin entries; **do not
"align" it further without a reason** — it is a different install, not a copy.

**`xhigh` IS THE CONFIGURATION WITH A TRACK RECORD; `ultra` IS A PREFERENCE.**
Decided 2026-09-01 on evidence, after raising it to `ultra` and reverting within
the hour. The Codex review that found the 67 wrongly committed traces — the
defect 758 of this session's own verification agents walked past — ran at
**`xhigh`**, 220,010 tokens, ~13 minutes. Every `ultra` run on this box was a
trivial probe (17,044 tokens, "reply with EFFORT-OK"). **There is no measurement
here in which `ultra` outperforms anything.** Swapping a proven setting for an
unproven one because more effort ought to be better is the reasoning this
project exists to refuse, and it was refused here against my own earlier
position.
► **FALSIFIED 117 TIMES OVER.** Of 124 rollouts under `~/.codex/sessions`, **118
  ran at `ultra`**, 5 at `medium` and 1 at `xhigh`; exactly ONE ultra rollout is
  the 17,044-token probe, and 101 of the 118 exceed 1 M total tokens (median
  ~3.0 M, max ~112.8 M). The sentence was true when written and is now the
  opposite of true. ► **The comparative claim it supports — that no measurement
  here shows `ultra` outperforming anything — is NOT falsified by this**, because
  no A/B exists in the rollout store; but its stated evidence is gone, so the
  sentence must be REBUILT, not renumbered. ► **Two further facts.** `ultra` is
  still in active use today even though the WSL config now reads `medium` — so
  the config value is not what the runs actually used, which is exactly what this
  section warns about elsewhere. And **the "220,010 tokens" figure for the xhigh
  run is not reproducible**: the single xhigh rollout records 5,566,666 total
  tokens (uncached input 230,075), and this same living head gives "5.57 M total
  tokens" for what must be the same run ~100 lines later — **two irreconcilable
  figures for one run.** The "~13 minutes" HOLDS (13 m 28 s).


**If anyone wants `ultra` back, measure it: run the same review over the same
diff at both efforts and compare findings.** Until that exists, this is settled.

**PREFER THE PLUGIN, KEEP THE CLI AS THE ESCAPE HATCH.** Source of
`openai/codex-plugin-cc` read at HEAD 2026-09-01 (32.6k stars, actively pushed):

- **It CANNOT express `ultra`.** `scripts/codex-companion.mjs`'s
  `normalizeReasoningEffort()` throws on anything outside
  `none|minimal|low|medium|high|xhigh`. Insisting on `ultra` means permanently
  staying off the maintained path.
- **Its review path passes `model` but NOT `effort`** (`~line 409-414`), so a
  plugin review INHERITS `config.toml`. That is why both machines' config must
  stay honest and identical — through the plugin, effort is not per-run.
- **Its read-only IS a real sandbox, not a prompt instruction** — `sandbox:
  "read-only"` is hardcoded at `companion.mjs:411`, and `workspace-write` only
  ever comes from an explicit `--write` (`:491`). I had doubted this; it holds.
- **It does not use `codex exec`** — it drives Codex's app-server protocol
  through a broker and returns STRUCTURED findings against a committed
  `schemas/review-output.schema.json`.
  ► **OFF BY THREE, AND THE FILENAME IS WRONG TOO.** The `read-only` literal is
    three lines below the line named — that line is the opening of the same call.
    The `workspace-write` citation is exact, and the substance (a real sandbox, not
    a prompt instruction) holds in both the installed copy and the marketplace
    checkout, which are byte-identical. **The file is `codex-companion.mjs`, not
    `companion.mjs`** — a filesystem search for the latter returns nothing.


**ANSWERED 2026-09-01, AND IT SETTLES WHICH PATH TO USE WHEN: THE PLUGIN
PRESERVES NO PER-COMMAND TRANSCRIPT AND WRITES NO ROLLOUT RECORD AT ALL.**
Established two independent ways. The peer session measured the OUTCOME on its
box after a `/codex:review` smoke test: only truncated command previews in the
live log, only the structured final message in the result, and the review threads
left nothing in `~/.codex` — no `rollout-*.jsonl`, nothing in
`archived_sessions`, no grep hit for the thread ids. This session measured the
MECHANISM from the installed source here: `lib/job-control.mjs:137-144` reads
`"running command:"` / `"command completed:"` lines **only to pick a progress
label** (`verifying` / `reviewing` / `investigating`) and then discards the
text; `writeJobFile` persists a job payload, not a transcript; and
`lib/app-server.mjs` has no rollout or persistence path at all. Same answer from
opposite directions.

**Two consequences, and the second is a hole in this file's own instructions.**

1. **The raw-CLI escape hatch is LOAD-BEARING, not habit.** The CLI emits every
   shell command Codex ran and its output, which is exactly what let this session
   AUDIT the review's seven findings rather than trust them — and two of the
   seven were defects in my own work that I would otherwise have had to take on
   faith. **For any review whose findings will be acted on, use the CLI.**
2. **"Verify by the rollout record" is EXECUTABLE ON THE CLI PATH ONLY.** That
   instruction appears below and is correct there; against a plugin review there
   is no rollout record to read, so the model and effort a plugin review actually
   used are **not verifiable after the fact by any means found so far**. That is
   the real reason both machines' `config.toml` must stay honest and identical:
   for plugin reviews, config is not merely the default — it is the ONLY record
   of what ran.

**THE PLUGIN IS NOW INSTALLED ON THIS BOX (2026-09-01): `codex@openai-codex`
v1.0.6, user scope, enabled.** Installed non-interactively — `/plugin ...` is a
built-in a session cannot invoke, but `claude plugin marketplace add
openai/codex-plugin-cc` and `claude plugin install codex@openai-codex` are
supported CLI subcommands and work fine. I first told the owner to run them
himself; that was wrong, and the CLI surface is worth remembering.

It registers `/codex:review`, `/codex:adversarial-review`, `/codex:rescue`,
`/codex:setup`, `/codex:status`, `/codex:result`, `/codex:cancel`,
`/codex:transfer`, plus the `codex-rescue` subagent. **Commands load at session
start**, so they are unavailable in the session that installs them.

**THE PLUGIN SHIPS THE GATE THIS PROJECT DISABLED — AND IT REGISTERS THE HOOK,
BUT DORMANT.** `plugins/codex/hooks/hooks.json` wires a `Stop` hook to
`scripts/stop-review-gate-hook.mjs` with a **900-second timeout**, alongside
`SessionStart`/`SessionEnd` lifecycle hooks. VERIFIED INERT rather than assumed:
the hook's `main()` early-returns on `if (!config.stopReviewGate)`,
`scripts/lib/state.mjs:23` defaults `stopReviewGate: false`, nothing on disk sets
it, and `~/.claude/settings.json` has `hooks: none` and no gate keys. So the
install did NOT arm it, and AGENTS.md's `reviewGateEnabled: false` remains the
true state.

**But the footgun is now reachable on this machine, where before it was not.**
**Do NOT run `/codex:setup --enable-review-gate`** — AGENTS.md's reason stands:
the only controlled study of Codex reviewing Claude found harm precisely when
reviewer output was auto-adopted. Note `/codex:setup`'s own description offers to
"optionally toggle the stop-time review gate", so the toggle is one command away
and reads as routine setup. **If a future session finds `stopReviewGate` true,
that is a regression to undo, not a preference someone expressed.**

**FOR THE RAW-CLI PATH ONLY, pin the model and effort at the invocation.** Both
machines now treat this as standard. I ran this session's review without pinning
either and inherited `xhigh` without knowing; it was a good setting by luck, and
I could not have said what ran until I read the rollout record afterwards. Use:

```
codex exec -m gpt-5.6-sol -c model_reasoning_effort=ultra -s read-only \
  --skip-git-repo-check - < prompt.txt
```

**Verify by the ROLLOUT RECORD, never the exit code.** Acceptance is not
application: `~/.codex/sessions/<date>/rollout-*.jsonl` carries the resolved
`"effort"` and `"model"`. A flag the CLI tolerates but ignores exits 0.

**Budget for `ultra`.** A trivial one-line prompt exceeded a 240 s timeout. A
real review of this session's diff took ~13 minutes, 5.57 M total tokens (5.3 M
cached input), 34.5 k output of which 20.4 k reasoning. And `codex exec` buffers
ALL stdout until it finishes, so a run in progress is indistinguishable from a
wedged one — check the process, not the output file.

**WHAT IS INSTALLED, AND WHERE — I OVERSTATED THIS ONCE.** On this box there is
NO Claude/Codex integration: `mcpServers` is empty, no codex plugin is
installed, and `/codex:adversarial-review` is unavailable, so reviews here run
as a plain npm CLI subprocess
(`~/.nvm/.../@openai/codex/bin/codex.js`). I wrote that the documented slash
command "is not registered anywhere". **That was true of this machine only.**
The peer reports that on ITS box the `codex@openai-codex` plugin
(`openai/codex-plugin-cc`) registers `/codex:review` and
`/codex:adversarial-review`, smoke-tested 2026-08-31. Reported, not verified
from here — this session cannot see that machine's plugin state. So the
migration handoff's "never exercised" claim holds for THIS box and should not be
generalised.
► **TWO OF THREE CLAUSES ARE FALSE, AND THIS FILE CONTRADICTS ITSELF ~50 LINES
  ABOVE.** `mcpServers` empty HOLDS. But **the codex plugin IS installed**
  (`codex@openai-codex` v1.0.6, user scope, 2026-09-01) and
  **`/codex:adversarial-review` IS registered** — the command file ships in the
  install alongside `review`/`rescue`/`setup`/`status`/`result`/`cancel`/
  `transfer`, and agent sessions in this repo load the `codex:*` skills. ► This
  same living head says "THE PLUGIN IS NOW INSTALLED ON THIS BOX (2026-09-01)"
  fifty lines earlier, and this block then denies it in the present tense.
  **A search of the surrounding hundred lines for a retraction finds none — this
  is a live self-contradiction, not a retained historical bullet.** The one
  surviving true clause is the npm CLI escape hatch.


### Driving the capture pipeline FROM WSL (measured 2026-09-01, first run since the relocation)

**The vehicle gate PASSES from WSL** — `validate-vehicle.ps1` round-tripped
wrapper → Ruffle → delog → ingest → verify, and the save tripwire read all three
`.sol` files unchanged. The migration handoff called the next capture run "the
real test"; this was it, and it needed five things nothing had written down.

- **`powershell.exe -NoProfile -ExecutionPolicy Bypass`.** The Windows execution
  policy blocks every `.ps1` here. Without `-ExecutionPolicy Bypass` the scripts
  do not run at all.
- **`$env:LOCALAPPDATA` must be set to `C:\ss2la`** (see the junction below).
  Every earlier capture ran INSIDE the Claude Windows app, whose MSIX container
  virtualises `%LOCALAPPDATA%`. So the licensed save universe, the 74 snapshots
  and `ss2-capture-isolated` all live under
  `C:\Users\corey\AppData\Local\packages\Claude_pzs8sxrjxfjjc\LocalCache\Local\`,
  NOT under the `%LOCALAPPDATA%` an outside process sees. A WSL-driven session is
  outside the container and silently addresses an EMPTY store otherwise.
- **`C:\ss2la` is a directory junction to that LocalCache path**, created
  2026-09-01. It exists because the literal path is 75 characters and
  `save-state.ps1` blows MAX_PATH on the store's own nesting: a `snapshot` run
  through the literal path FAILED HALF-WAY and left a partial snapshot that
  `Remove-Item` could not delete either — and a partial snapshot is
  indistinguishable from a real one in `save-state.ps1 list`. Inside the
  container the same code is fine, because the app sees the short
  `C:\Users\corey\AppData\Local` and the redirect happens below the filesystem
  API. **Use the junction; do not pass the literal LocalCache path.**
- **Ruffle IGNORES `%LOCALAPPDATA%`.** It resolves its own profile through the
  Windows Known Folder API, which only the container virtualises, so an
  unpackaged Ruffle starts from an EMPTY profile at
  `C:\Users\corey\AppData\Local\ruffle`. It then stalls fetching OpenH264 and
  never loads the movie: the run dies at `Opening file:…` with no `avm_trace`
  lines and the gate reports "No capture-trace lines found", which reads like a
  wrapper defect and is not one. Seed the profile by copying
  `…\LocalCache\Local\ruffle\video\openh264-2.4.1-win64.dll` into
  `C:\Users\corey\AppData\Local\ruffle\video\`. Done 2026-09-01.
- **A cold profile needs `-RunSeconds 30`;** the 12-second default is not enough
  and fails the same indistinguishable way.
- **From WSL, a campaign needs `-Concurrency 2` or more.** At `-Concurrency 1`
  `run-campaign.ps1` passes no `-SaveDirectory`, so Ruffle falls back to its own
  profile store — which, unpackaged, is the empty one. `N>1` forces a
  per-session store seeded from the real save, which is what makes it work.

  ► **THIS RULE IS SCOPED TO `run-campaign.ps1` PRISONER CAMPAIGNS, AND READING
    IT AS GENERAL IS DANGEROUS FOR THE ARMOURED FAMILY. Verified in the scripts
    2026-09-01 (evening).** `run-campaign.ps1:123-124` **refuses**
    `-Concurrency > 1` for any `-Navigate` other than `prisoner`, and passes
    `-SaveDirectory` only when `Concurrency > 1` (`:166`, `:179`).
    `run-arena.ps1` — the vehicle all five armoured fixtures use — has **no
    `-Concurrency` parameter at all** (its only mention is a comment at `:121`)
    and passes `-Navigate arena` (`:266`). **So the armoured family cannot get
    per-session save isolation by any parameter, and necessarily runs against the
    licensed save.** That is not a nicety: it is why `run-arena.ps1` snapshots
    first, and why an armoured run is a supervised, serial, save-mutating
    operation rather than something to fan out.

- **`-RunSeconds` is NOT a capture parameter.** It exists only in
  `validate-vehicle.ps1` (default 12), so the "cold profile needs `-RunSeconds
  30`" rule above governs the VEHICLE-VALIDATION step that `AGENTS.md` requires
  after a wrapper edit — not `launch-capture.ps1`, `run-arena.ps1`,
  `run-campaign.ps1` or `run-capture.ps1`, none of which accept it.

- ► **THE TWO THINGS THAT MADE A WSL-DRIVEN `run-arena.ps1` CAPTURE ACTUALLY
  WORK, found 2026-09-02 on the first attempt to run one. Neither was written
  down, because the 2026-09-01 session only ever ran `validate-vehicle.ps1`,
  which uses `--save-directory` and therefore never touches the licensed
  store.**

  1. **RUFFLE READS A DIFFERENT SAVE STORE FROM THE ONE `save-state.ps1`
     MANAGES, AND THE GUARDS WATCH THE WRONG ONE.** Setting
     `$env:LOCALAPPDATA=C:\ss2la` makes `save-state.ps1` snapshot and restore
     `C:\ss2la\ruffle\SharedObjects` — the licensed store. Ruffle resolves its
     profile through the Windows Known Folder API and ignores the variable
     entirely, so it read `C:\Users\corey\AppData\Local\ruffle\SharedObjects`,
     found nothing, and **created a fresh 267-byte empty save**. The route
     aborted at `new_or_continue` with `level: null` and
     `ABORT:time-of-day-ceiling` after 188 s — a symptom that reads like a
     navigator defect and is not one. **The gladiator was simply not in the
     save Ruffle opened.**

     Worse than the failure: `run-arena.ps1`'s snapshot guard AND its
     before/after save tripwire both read the `C:\ss2la` store, so the run
     printed `UNCHANGED (byte-identical)` — **truthfully, about a file it never
     touched, while the file Ruffle did write was unguarded.** A save-mutating
     run whose guard watches the wrong store is worse than no guard.

     **Fix, applied 2026-09-02:** make the two stores one, with a directory
     junction, so `save-state.ps1`, the tripwire and Ruffle all address the same
     bytes:

     ```
     mklink /J "C:\Users\corey\AppData\Local\ruffle\SharedObjects" ^
               "C:\ss2la\ruffle\SharedObjects"
     ```

     After it, the route loaded the hero (`level 4`, `gold 5723`,
     `currentTournament 1`), reached `versus` and `battle-ready`, and returned
     `Route outcome: CAPTURED`. The 267-byte stub Ruffle had minted is backed up
     in this session's scratchpad; it was a fresh-new-game artefact, not
     evidence.

  2. **`campaign.mjs ingest-round` CANNOT RUN UNDER WSL NODE, AND IT FAILS WITH
     A LICENCE-INTEGRITY SCARE.** `capture-session.mjs`'s `DEFAULT_INSTALL_DIR`
     is the literal Windows path `C:\Program Files (x86)\Steam\...`, and
     `ingestAgainst` calls `verifyInstallAgainstFingerprint()` with no
     arguments. Under WSL node that path is `ENOENT`, `check.ok` is false, and
     the thrown message is **"Post-session hash verification FAILED: the
     installed build no longer matches the pinned fingerprint"**. Nothing is
     wrong with the build — `verify-install` under Windows node reports both
     SWFs OK against the current pin. **The message names the wrong cause and
     the cause it names is the most alarming one available.** Run ingest under
     Windows node:

     ```
     & 'C:\Users\corey\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' `
        tools\runtime-capture\campaign.mjs ingest-round --family <f> --session <s> --observation <o>
     ```

     Note also that `--observation` takes the ATTEMPT-suffixed id (`obs-x-a1`),
     not the id passed to `-ObservationId`; the un-suffixed form is an `ENOENT`
     on the `.rufflelog`.

  3. **A round costs 14 seconds end to end** (restore, route, capture, ingest),
     measured over the first rounds of 2026-09-02. The armoured route is
     therefore far cheaper than "a supervised window" implies, and a few hundred
     rounds is an evening rather than a campaign.

- ► **`powershell.exe` DRIVEN FROM WSL INHERITS A WORKING DIRECTORY INSIDE THE
  REPO, so a malformed destination WRITES INTO THE REPO. Found the hard way
  2026-09-01, by me, in this file's own session.** A stray
  `Copy-Item 'C:\...\captures\README.md' -Destination $null` — left in a command
  by mistake — resolved `$null` to the shell's CWD and **overwrote the
  repository's root `README.md`** with `captures/README.md`. It was caught by
  reading `git status` before committing, and restored with
  `git checkout -- README.md`; nothing reached a commit. **Give every
  `Copy-Item`/`Move-Item`/`Set-Content` an absolute `-Destination`, and read
  `git status` before every commit rather than trusting the paths you passed to
  `git add`.** This is the same lesson as the `git add -A` incident from a
  different direction: in a tree where agents write, the working tree is the
  thing to check, not your intent.

- **The WSL repo cannot launch Ruffle at all.** `launch-capture.ps1:156`
  resolves `ruffle.exe` under `$projectRoot/.tools`, which exists only in the
  Windows tree at `C:\ss2-capture`. **A capture must be driven from that tree —
  which is currently 28 commits behind this one**, so any wrapper edit made here
  has to reach it before it can run. Its 38 "modified" files are pure CRLF churn
  (verified by diffing content, not `git status`), so the tree is clean in
  substance; it simply has not been fetched since `98482b6`.
  ► **THE "38" IS RIGHT AND THE SWEEP'S "1366" WAS THE WRONG QUANTITY.** Measured
    2026-09-07: the tree shows **40 modified tracked files and 1,326 untracked**,
    totalling the 1,366 the sweep reported as modified. **So "clean in substance"
    needs re-deriving against 40, not abandoning against 1,366** — and it now
    fails narrowly: exactly **2 of the 40** differ in real content rather than only
    line endings (`src/golden/observation.js` and `src/golden/run-1v1-fixture.js`).
    There is no `core.autocrlf`, no `.gitattributes` and no skip-worktree bit.
    Command: `git -C /mnt/c/ss2-capture --no-optional-locks status --porcelain | cut -c1-2 | sort | uniq -c`.

  ► **"SINCE `98482b6`" HOLDS EXACTLY; "28 commits behind" is now 113**, with
    nothing unique on that side (`git rev-list --count HEAD..98482b6` is 0). Live
    moving target — write
    `git -C /mnt/c/ss2-capture --no-optional-locks rev-list --count 98482b6..HEAD`
    rather than a number.


### The live save has moved past the prisoner, and 22 goldens depend on that bout

The saved gladiator (John Ringler) has progressed beyond the dungeon prisoner
fight. Two live rounds run 2026-09-01 with `-Navigate prisoner` each emitted a
`meta` line and nothing else: Ruffle launched, the wrapper traced, and the
navigator never reached a bout. **Every prisoner and probe family — all 22
promoted goldens — is therefore uncapturable from the LIVE save**, and
reproducing or extending any of them means restoring an early snapshot first
(`verified-good-1701` or `pre-arena-path`).
► **SUBSTANCE HOLDS; THE APPOSITION IS THE BIT THAT IS STALE, AND "23" WOULD MAKE
  THIS SENTENCE FALSE.** The prisoner+probe subset is exactly 22 of the 23
  goldens, so "uncapturable from the LIVE save" is true of it. What is stale is
  the apposition equating that subset with the whole corpus. **Correct form:
  "22 of the 23 promoted goldens".** A blanket 22→23 here breaks a true
  sentence — the armoured golden is in neither family.


That makes the snapshot store load-bearing evidence infrastructure rather than a
safety net, and it is the one copy: it sits inside the MSIX container, and the
`D:\ss2-backups` mirror is on an external drive that is usually unplugged.

**`jr-live-0901` is the live John Ringler save, snapshotted 2026-09-01** (3 files
verified identical) before any restore was attempted. Restore overwrites the live
save, so take a snapshot BEFORE a restore, not only before a capture.

### Throughput is memory-bound, and the per-round hash is 93% waste

Measured 2026-09-01 on this machine (15.3 GB RAM, 8 physical cores, RTX 4060):

| | measured |
| --- | --- |
| Available memory (free + standby) | **76 MB** |
| One Ruffle instance | 373 MB working set / 449 MB commit |
| `verify-install`, 1 run | 5.5 s |
| `verify-install`, 4 concurrent | 6.1 s |
| SS2-only hash, 4 concurrent | **0.43 s** |

So concurrency is capped by RAM at about 2 today, not by CPU, which is mostly
idle. Closing Firefox/Spotify/Dropbox/ChatGPT frees ~1.8 GB (≈4–5 instances);
capping WSL2 in `%USERPROFILE%\.wslconfig` frees up to ~3 GB more (≈8, matching
the physical cores) but needs `wsl --shutdown`.

**The larger lever costs no memory.** `verify-install` hashes 102 MB per round
and 95 MB of it is the AVM2 launcher SWF — which `98482b6` established the
capture route never loads, and which that commit deliberately left as an open
design decision ("SS2 mismatch should stop a session; launcher mismatch should
warn"). Hashing only the 7.3 MB SS2 SWF turns ~6 s of every batch into ~0.4 s.
Note what was NOT true: concurrent hashing does not contend badly on disk — 4
concurrent full runs cost only +0.6 s over one, because the page cache absorbs
them. The win is deleting redundant work, not relieving contention.


---

## Non-negotiable rules (each learned the hard way)

- Licensed SWFs are read-only and hash-verified before and after every capture.
  Never copy, export or commit game assets or extracted scripts.
- **Never shortcut the game's own frames.** Jumping past the prologue tripped
  the game's own validation screen.
- A candidate becomes golden ONLY via >=2 matching observations from >=2
  sessions. Never hand-write a golden, observation or manifest.
- **Derive candidates from the battle map, never from a capture.**
- `validate-vehicle.ps1` must PASS after ANY wrapper edit — but see below for
  what that does and does not mean.
- Snapshot before every save-mutating run. `run-arena.ps1` does it for you.
- Use `git commit -F <file>` for any message containing quotes.

### AVM1 has ONE comparison opcode

~~`>` is `<` with operands swapped;~~ `>=` and `<=` are `<` negated. Every
comparison with NaN is false, so **both negated forms return TRUE for NaN**, and
every field the wrapper reads is undefined until the frame that initialises it.
This caused **three separate live defects in one day**, including one that
rewrote the gladiator's gold. The only safe shape is un-negated `<`, twice:
`(n < 1) || (0 < n)`. Use `isNum()`.

► **THE HEADING AND THE FIRST CLAUSE ARE WRONG; THE RULE THEY JUSTIFY IS RIGHT.
  Corrected 2026-09-01 (evening) — and this section is titled by the wrong half,
  which is why it is corrected here rather than quietly rephrased.** This build's
  AVM1 has **TWO** numeric comparison opcodes, `ActionLess2` (0x48) and
  `ActionGreater` (0x67, SWF6+). Verified two ways: an opcode census over the
  compiled wrapper artefact (Less2 70 = 51 `<` + 19 `>=`; Greater 39 = 28 `>` +
  11 `<=`), and directly by the main session against the hash-verified licensed
  SWF, whose own action stream contains both `Greater` and `Less2`. So `>` is a
  real opcode here, not `<` with swapped operands.

  **What survives untouched, because it is what the section exists for:** on this
  toolchain `a >= b` compiles to `Less2; Not` and `a <= b` to `Greater; Not`, so
  **both still return TRUE when an operand is NaN**, while bare `<` and `>`
  return FALSE. Keep using `isNum()`.

  **But do not read "un-negated `<`, twice" as a universal.** NaN-safety here is
  branch POLARITY plus a guard, not an operator whitelist. The wrapper's own
  dominant idiom — used inside `captureAllowedNow()` — is *reject NaN first, then
  compare normally* (`if (!isNum(f)) return false;` then any ordinary
  comparison), at lines 2029→2031, 755→756 and 735→737. A rule that forbade `>=`
  outright would condemn all three. Where no `isNum` guard precedes the test:
  if the true-branch ACCEPTS, the comparison must be un-negated so NaN fails it
  (line 574); if the true-branch REFUSES or defaults, it must be negated so NaN
  triggers the refusal (lines 588, 2137). Rewriting the second kind into the
  first is what turns a gate fail-OPEN.
► **THIS CITATION WAS NEVER RIGHT — not drift.** The wrapper line named is a
  plain assignment with no comparison in it, and the wrapper blob is BYTE-
  IDENTICAL at HEAD to what it was at the commit that wrote this sentence, so
  the number cannot have moved. Re-derive the site before relying on the
  argument; `git rev-parse HEAD:tools/runtime-capture/ss2-capture-wrapper.as`
  matches the blob at that commit.


  **And `isNum()` rejects only NaN.** `Number("")`, `Number(null)`,
  `Number(false)` and `Number([])` are all 0, so `isNum(f) && Number(f) == want`
  ACCEPTS all of them whenever `want` is 0 — and the armoured fixture family
  carries 19 zero-valued fields, including `hero.armourclass` and eight zero hero
  armour slots. **Before any gate compares a game field against a target of 0,
  measure what Ruffle yields for a field that is `""` or `null`.** The wrapper
  already treats `""` as a distinct hazard for FlashVars (lines 571, 580, 2118);
  the same hazard for game-read fields is unsolved.

### `validate-vehicle.ps1` proves less than its name suggests

Audited: it catches **0 of the 6 defects found live on this route**, `isNum` has
**zero reachable call sites** in a stub run, and a one-line revert of `isNum`'s
body leaves the gate green while restoring the demonstrated save-corruption bug
verbatim. Save corruption is outside its observable universe by construction —
it compares a trace to a fixture, never a save. It now says so in its own PASS
output and names the wrapper source hash it compiled.

► **BUT ITS PASS TEXT NOW OVERSTATES ITS OWN BLINDNESS, AND THAT MATTERS FOR THE
  ARMING-GATE WORK. Measured 2026-09-01 (evening).** The PASS output says the
  gate "never enters the navigator, the arena state machine, the four gates,
  staging, the shop, the fight policy or **the capture gate**". The last item is
  false: **`captureAllowedNow()` runs on every gate run.** The path is
  `ov.checkattackroll()` → the checkattackroll wrap (wrapper 2376-2389) →
  `if (!actionCaptured) beginAction();` (2381) → `if (!captureAllowedNow())
  return;` (2216). A gate run's own log shows `called:checkattackroll` followed
  immediately by `attacker-resolved-hero`, and **two archived gate runs went RED
  on a capture-gate refusal** — they produced a 387-byte `.jsonl` with no
  observation, so ingest threw.

  **So the gate is a working oracle for the FIRST HALF of that function** — the
  `arenaStopped` check and the whole attacker-side guard (2006-2023) — and blind
  only from line 2024 onward, because no `-Pnavigate` is passed and `arenaMode`
  is false. **Anything added inside the `champion` block is DEAD CODE under the
  gate and would pass green untested.**

  **The remedy is proven on this codebase, not speculative:** when the
  attacker-side guard was fixed, `stub-game.as` was extended with
  `ov.game_attacker` / `ov.game_defender` (`stub-game.as:52-65`, whose comment
  says exactly why), and the gate then demonstrated that guard firing in BOTH
  directions and going red for each. **Extend the stub so the gate can see a new
  branch** — that is the technique, and it has worked here once already.

  *(Also corrected: `attack_chances` is NOT the arming point the gate exercises.
  `called:attack_chances` appears **0 times** in vehicle-check rufflelogs and 209
  times across the archive. The single vehicle-check "hit" for that string is
  inside a decompiled wrapper SOURCE copy, not a trace — the exact false-positive
  class the wrapper's own comment warns about, and it has now caught a reader
  twice.)*
► **BOTH LOAD-BEARING HALVES HOLD; THE "209" IS NOT A COUNT OF TIMES AND NEVER
  WAS.** `dbg()` in `tools/runtime-capture/ss2-capture-wrapper.as` returns early
  on a label it has already emitted, so `called:*`, `wrapped:*` and
  `action-armed` appear AT MOST ONCE PER TRACE — measured across the archive,
  every rufflelog carrying the label carries it exactly once, never twice. So
  209 was a count of TRACES, and substituting a bigger number would fix the
  denominator and leave the category error in place. Its provenance is nailed:
  209 is exactly the file count in the frozen 2026-08-31 replica under
  OneDrive, not a live measurement. Say it as a proportion of traces and give
  the command:
  `grep -rlc --include='*.rufflelog' -e 'called:attack_chances' <archive> | wc -l`
  (1531 of 1650 rufflelogs on 2026-09-07). The vehicle-check half HOLDS exactly:
  0 of its 49 rufflelogs carry it, and the single hit is a decompiled wrapper
  SOURCE copy — precisely the false-positive class this sentence names.


---

## Next steps, in order

► **STATE AS OF 2026-09-07. Suite is 808 / 807 / 0 / 1 (fresh-clone profile),
  re-measured that day; it read 708 / 707 / 0 / 1 from 2026-09-02 until then,
  and the line's own instruction had been ignored for five days. MEASURE IT, DO
  NOT COPY THIS LINE** — two commit messages
  this session said "703 / 702" and were stale by one when written, which is the
  same error the previous session's last commit existed to fix. Ranked items 2, 3 and 5 of the `…-0130` brief are DONE
  or REFUTED and item 4 is answered; see
  `docs/handoffs/2026-09-02-0007--the-wave-refuted-more-than-it-confirmed.md`.
  **What is left, in order:**
  ► **RE-MEASURED 2026-09-07 (next session): 816 / 815 / 0 / 1, and the 808 above
    went stale THE SAME DAY it was written** — `d7ff634` added 128 lines of tests
    hours later. Three values have now been in play for one quantity: the sweep
    proposed 787/786, this line was written as 808/807, the truth is 816/815.
    **The line's own instruction now applies to itself, which is the whole point:
    any digit written here is stale within a commit.** Keep the instruction; treat
    every number beside it as expired on sight.


  1. **CAPTURE AN ARMOURED FIXTURE — still first, and the vehicle blocker was
     never real.** `run-arena.ps1` carries `-WatchFields` (`:137` → `:295`),
     `-StageHero`/`-StageVillain` (`:100-101`) and its own snapshot guard, and
     it is exercised — five archived rufflelogs emit
     `{"t":"dbg","at":"watch-extended","added":11}`. Both removal fixtures take
     the identical flag `-WatchFields "helmet_defence,shoulderguard_defence"`.
     **Expect no observation from one window**: both pin `staminaleft 105` on
     both sides, which held in 0 of 38 armed rounds, and six other fields also
     diverge. Raise the odds first by pinning the approach-step count and
     extending `-StageVillain` to `speed` and `strength` (`applyStageSide` has
     no whitelist, so it can already write them).
     ► **CLOSED 2026-09-02 by `2341789`, and re-verified 2026-09-07. DO NOT
       RE-CAPTURE.** `golden-armoured-deflection-threshold-cleared` is promoted:
       `provenance.observationIds` = `["obs-onx1405-a1","obs-onx1521-a1"]`,
       `repetitions: 2`, and it is the only golden carrying `provenance.staged`.
       **Goldens are 23, not 22.** This item spans ~90 lines and carried ZERO
       retraction markers while this same file records the promotion in five other
       places. Following it would burn the project's single serial, supervised,
       irreplaceable resource — a Ruffle capture window — on work already done; the
       2026-09-02 13:40 handoff records that it cost 1,201 unattended rounds. The
       item's own closing question ("whether they assert a villain state the build
       can reach at all") is ALSO answered: 2 matches in 1,201 staged rounds, right
       on its own predicted ~1-in-450.


     ► **IT IS NOT A "WINDOW" ANY MORE. A ROUND COSTS 14 SECONDS, AND 150 OF
       THEM RAN UNATTENDED ON 2026-09-02.** Driven from WSL with the store
       junction in place (see § "Driving the capture pipeline FROM WSL"),
       restore → `run-arena.ps1` → ingest is one command and takes 14 s. 150
       rounds against `candidate-armoured-deflection-threshold-cleared`: 149
       CAPTURED, 0 matched, 150 divergence reports filed. **The whole framing
       of this item as a scarce supervised window was a cost estimate nobody
       had re-measured since the protocol changed.**

       **The yield, measured over those 150 rounds rather than argued:**

       | pinned field | rounds that CLEARED it | rate |
       | --- | ---: | ---: |
       | `attackDirection` 5 | 46 | 31% |
       | hero `staminaleft` 105 | 47 | 31% |
       | villain `staminaleft` 105 | **5** | **3.3%** |
       | hero `hitpoints` | 107 | 71% |

       The other 104 directions split 33 / 37 / 34 across 6 / 7 / 8 and never
       landed outside that band. **Zero rounds cleared direction-5 and
       villain-105 together**, so the joint rate is at most ~1 in 450 and the
       villain's stamina is the single binding constraint — its observed mass
       sits at 85-99, not at 105.

     ► **Refined by a verifier wave, 2026-09-02. Every count above reproduces;
       three things are added and one confident correction was REFUTED.**

       - **`attack_direction` is the only real draw, and its rate is exactly
         1/4** — not the ~31% observed. `normal_attack` assigns
         `randomBetween(5, 8)` at `+0x61f1`, so the band is `{5,6,7,8}` by
         construction. Pooled over 243 rounds the split is 70/53/60/60,
         χ² = 2.416 on 3 df: uniform is not rejected, and no direction outside
         the band has ever been observed.
       - **Hero stamina is not a draw at all: `heroStam = 110 − walk steps`,
         holding in 249 of 251 pooled rounds.** So `heroStam == 105` is exactly
         "the approach took five steps" — which is what "pin the approach-step
         count" above would fix, and it would fix two constraints at once,
         because `P(hero hitpoints intact | 5 walks) = 0.718`.
       - **A FIFTH axis nobody had listed:** `gladiator_dir` flipped in
         `obs-ondc143` — hero `left`, villain `right` — 1 round in 150. The
         protocol occasionally starts the gladiators on swapped sides.
       - **The denominator is wrong by one:** 151 sessions were launched, 150
         are usable, and `session-ondc224` aborted (one `meta` record, log dies
         at root frame 164). Not a hidden success, but "150 rounds → 150
         reports" should read "151 launched, 150 usable, 1 aborted".

       ► **REFUTED, and it is the one that would have changed the protocol:**
         the wave concluded that villain stamina is "written into the campaign
         driver, not drawn by the game", that its 1-in-31 rate is a harness
         setting, and that staging `villain.staminaleft=105` would cut the cost
         to one success per 5.6 rounds. **It read the `"t":"end"` record's
         `staged:` string as the driver's staging INPUT. It is the CURRENT
         value.** Measured on `session-ondc100`: the `{"at":"staged"}` record —
         which IS the input — says `staminaleft=105`, the `{"t":"state"}`
         record at arming says **97**, and the `end` record's `staged:` string
         says 97. Every round of this batch already stages a constant 105; the
         villain then takes phases and walks it down before the hero's armed
         action. **The recommendation was to do what the driver has been doing
         all along.**

         So the binding constraint stands, and it is not settable by staging.
         Getting 105 at ARMING needs zero villain drift, which means arming
         before the villain has taken a phase — and `initbattle` puts the
         villain at `staminamax` = 110 there, not 105. That is the same
         contradiction recorded below, and it is still the open question.

       **So "run more rounds" is now a real strategy where it was not, but the
       PROTOCOL is still what decides it.** `initbattle` (`+0xb8a`-`+0xbb6` of
       `sprite:2249/frame:1/DoAction@0x6e421b`, re-read 2026-09-02) sets
       `villain.staminaleft = villain.staminamax` unconditionally, so arming on
       the hero's FIRST action — the change this file recommends two paragraphs
       up — would put the villain at **110, not the 105 both fixtures pin.** It
       would make the villain side deterministic and deterministically WRONG
       against these fixtures. Whether they assert a villain state the build can
       reach at all is the open question, and it is the same class as "fifteen
       fixtures assert a hero the build cannot produce". Re-derive from the map;
       never edit a fixture to fit.
  2. **Model enchantment DAMAGE** — `+0x320c` and `+0x3326`, both dropped, so an
     enchanted weapon applies a status and deals no magic damage.
  3. ~~**Transcribe the static weapon table and make `weapon` declarable**,
     which closes gap 3 in `ss2-rules.js` rather than restating it.~~
     ► **THE FIRST HALF IS ALREADY DONE AND THE ITEM AS WRITTEN WOULD BURN A
       SESSION REDOING IT. Corrected 2026-09-02.**
       [`docs/integration/ss2-item-tables.md`](docs/integration/ss2-item-tables.md)
       has carried the transcription since 2026-08-30: §2.3 tabulates weapon
       ids 1-80 and §2.4 ids 0 and 201-220 — **90 rows, each with the
       instruction offset of its own literal** — §2.1 gives the meaning of
       every array index (`[0]` type, `[1]` display name, `[2]` weight and
       `attack_speed`, `[3]` min damage, `[4]` max damage, `[5]` range
       multiplier), and §5 does the same for armour. It also SETTLES the
       licensing boundary this work needs: **display-name string literals are
       game content and are not reproduced; items are identified by id only.**
       I re-read two rows from the bytes independently — id 22 at `+0x4174`
       and id 24 at `+0x41c6` — and both match the document exactly.
       Neither `ss2-rules.js`'s gap 3 nor this list mentioned that the file
       exists; both said "the table is not transcribed".
     ► **BOTH OFFSETS ARE NOW MODELLED, so "both dropped" is closed** — `ss2BattleValues`
       computes `weapon_enchantment_damage` and `secondary_weapon_enchantment_damage`,
       proved at runtime rather than by reading: a call with `weapon: 5`,
       `weapon_enchantment_potency: 3`, `secondary_weapon: 7`,
       `secondary_weapon_enchantment_potency: 2` returns 49 and 54. **Ranked item 2
       here still reads "both dropped" and is unstruck while item 3 beside it carries
       a correction.** ► The sweep's own replacement line numbers for this are
       themselves stale — find the derivation with
       `grep -n 'weapon_enchantment_damage' src/team/ss2-rules.js`, not with a
       number.


     ► **AND ALL 90 ROWS ARE NOW MECHANICALLY VERIFIED, so that half is done
       too.** `node tools/item-table-transcription.mjs` diffs **540 of 540
       fields** — the per-row instruction offset included — and separately
       confirms the INDEX CONVENTION from the build rather than assuming it,
       by reading the `Push <n>; GetMember` at each `battlevalues` reader site
       (`weapon_type` 0 at `+0x3134`, `weapon_weight` 2 at `+0x3186`,
       `weapon_min_damage` 3 at `+0x31d0`, `weapon_max_damage` 4 at `+0x31ec`,
       `weapon_range` 5 at `+0x31aa`). All agree against `77cb545c…`. Without
       that second check the first proves only that the document's numbers are
       the build's numbers UNDER THE DOCUMENT'S OWN CONVENTION, which is the
       shape of an oracle computed from the table under test.

     ► **AND THE REST IS NOW DONE TOO (2026-09-02). RANKED ITEM 3 IS CLOSED.**
       `src/team/ss2-weapon-table.js` carries the ninety rows, generated from
       the build's own literals, and `ss2BattleValues` derives the damage pair
       from a `weapon` id — weapon 24 gives 28 / 52, weapon 0 gives 21 / 23,
       which is the live save's own gladiator derived rather than read.
       `secondary_weapon` likewise, at the build's `round(strength * 1)`.

       **An explicit pair OUTRANKS the table, and that is load-bearing, not
       defensive.** All 22 goldens supply `min_damage`/`max_damage` and none
       supplies `weapon`, so deriving first would re-datum runtime evidence
       from a map-derived table. Derivation fills a hole; it never overwrites a
       measurement.
► **22 → 23, AND THE UNIVERSAL IS NOW ROLE-SCOPED.** Hero pair present 23/23;
  villain pair 22/23 — the armoured golden's villain supplies NEITHER
  `min_damage`/`max_damage` NOR a `weapon` id. **"None supplies `weapon`" HOLDS
  EXACTLY: 0 of 23 files contain the string.** Third thing neither the document
  nor the sweep says: on that one fixture the precedence rule is UNEXERCISED, not
  violated — there is nothing to arbitrate. Adjacent stale in the same block:
  "ONE test of 718" → 816, and "22 measured damage pairs" → 23 hero, 22 villain.


       **And the corpus cannot defend that rule.** Mutating the derivation to
       overwrite instead of fill fails ONE test of 718 — the new precedence
       assertion — and the golden replay does not notice, because no golden
       carries a `weapon` id for the derivation to fire on. One assertion is
       all that stands between the table and 22 measured damage pairs.
► **THE MUTATION REPRODUCES EXACTLY; ONLY THE SUITE TOTAL MOVED.** Re-run
  2026-09-07 in a disposable copy: overwriting instead of filling still fails
  precisely one test — "an explicit damage pair OUTRANKS a weapon id, so evidence
  is never re-datumed" — and the golden replay still does not notice, because
  `grep -l '"weapon"' test/fixtures/ss2-1v1-golden/golden-*.json` is 0 of 23, so
  no golden fires the derivation. "718" → 816.


       Still genuinely open, and NOT needed for the above: `weapon` as a
       declarable RESOURCE (`SS2_RESOURCE_NAMES`, `SS2_RESOURCE_DEFAULTS`,
       `CANONICAL_RESOURCE_SOURCES`, `SS2_PROJECTED_COMBATANT_KEYS`). It is
       read straight off the character object today, because `ss2BattleValues`
       opens with `const source = { ...character }`.
  4. **The `COMBATANT_KEYS` schema question is unchanged and still the owner's.**

► ~~**FIVE LIVE INSTRUCTIONS SIT IN `ss2-item-tables.md` §9 THAT THIS LIST HAS
  NEVER CARRIED, AND AT LEAST TWO ARE STILL UNFIXED (checked 2026-09-02).**~~
  **RETRACTED THE SAME NIGHT, BY THE WAVE I HAD LAUNCHED. BOTH OF THE TWO I
  "CHECKED DIRECTLY" WERE WRONG, AND THE FIRST ONE WAS WRONG BECAUSE OF MY OWN
  TRUNCATED GREP.** The general point survives — §9 is a side document carrying
  instructions this list never hoisted, and a side document freezes the way a
  handoff does — but every specific claim below it was mine and is corrected
  here rather than deleted.

  - **§9.1 — the wrapper must call `onRollOver()` before `.onRelease()`.**
    ~~It still does not; `onRollOver` appears nowhere in the wrapper.~~
    **FALSE. It does, and has since before §9.1 was written.**
    `ss2-capture-wrapper.as:1200-1201` is `chosen.onRollOver(); chosen.onRelease();`
    inside the `shop-open` block, with a guard at `:1193` that refuses and
    reports `hasRollOver`/`hasRelease` if either handler is missing.
    `onRollOver` appears on lines 1177, 1193, 1195 and 1200. It landed in
    `2df4ba0` at 2026-08-30 22:46:58 -0400 — **four minutes and 41 seconds
    before `df3a122` created §9.1 asking for it**, so that instruction was
    stale at the moment it was written.

    **HOW I GOT IT WRONG, because the mechanism matters more than the fact.**
    I ran `grep -n "onRollOver\|onRelease" <file> | head -10`. The first ten
    matches are all `onRelease`, at lines 384 through 1137; `head` cut the
    output off forty lines before the first `onRollOver`. I then read the
    absence of a match as the absence of a call. **`docs/overnight-agent-plan.md`
    already names this exact failure** — "whenever you filter it, print what
    the filter REMOVED" — after `git ls-files test | grep -v fixtures` silently
    ate three real test files. It is the same mistake with `head` instead of
    `grep -v`, made by the session that had read the rule that morning. **A
    truncating pipe is a filter.**
  - **§9.3 — `ARMOUR_PAGES = ["browse"]`.** The line is still there (`:852`),
    but the conclusion drawn from it is wrong: `-ShopArmour` does NOT silently
    reach `shop-unreachable`. `:828-831` refuses up front and emits
    `{"at":"arena","step":"shop-armour-unimplemented"}`. That is a declared
    not-implemented with an honest refusal, not a lurking defect, and it should
    be read as scope rather than as a bug.

  §9.2, §9.4 and §9.5 remain unchecked here. (§9.5 asked the battle map to
  record the `[3]`/`[4]` indices, which it now does at `:447-452`.)
  **Treat the rest of §9 as unverified: two for two of the ones I checked were
  stale, which is what a three-day-old instruction list is worth.**

► **ITEMS 1 AND 2 OF THE 2026-09-01 BRIEF ARE DONE (2026-09-02).**
  `src/team/ss2-rules.js` exists and the 22 goldens replay through the resolver.
  What that opened, and what it did NOT close, is in
  `docs/handoffs/2026-09-02-0130--ss2-rules-and-the-wave-that-broke-it.md` and
  in § "Found 2026-09-02" below. **The corpus now has a consumer; it still has
  no armour, no enchantment and no non-tournament coverage, and a mutation
  sweep showed the suite cannot see most of what the rule set could get wrong
  in those dimensions. That is an evidence problem — a capture problem — not a
  test-writing problem, and it is now the top of this list.**
  ► **ONE THIRD OF THIS IS NOW BACKWARDS AND ALWAYS WAS.** "No armour" is FALSE
    since 2026-09-02 (villain `armourclass` 79/79, helmet 6, shoulderguard 1,
    gauntlet 1, greaves 2, expected `armourDamage` 22). "No enchantment" HOLDS —
    `statusApplied === null` in 23 of 23. **"No non-tournament coverage" IS THE
    WRONG WAY ROUND.** The build's modes are tournament / duel / misc; 22 of the
    23 goldens are `misc`, which IS non-tournament, so the corpus has had
    non-tournament coverage from the first golden. What it LACKED was TOURNAMENT
    coverage, and that gap closed 2026-09-02. `src/team/ss2-rules.js:156` already
    carries the correct form. Neither this document nor the sweep spotted it.



1. ~~**The champion family cannot be captured, and the fixtures must be
   re-derived.**~~ **RETRACTED 2026-08-31 (`2d0b077`). ALL THREE ARITHMETIC
   BLOCKS BELOW ARE FALSE. Do not act on this item; capture the armoured family
   instead (item 2).**

   This was the file's top-ranked next step while the corrections block at the
   head of the same file already called its first premise false. A session that
   read the list and not the block would have spent a window re-deriving five
   fixtures that are capturable as written. **A retraction at the top of a file
   does not reach a reader who starts at the section that tells them what to do:
   retract AT THE INSTRUCTION, not only above it.**

   The three blocks, and what each is refuted by — run
   `node tools/stat-vector-reachability.mjs` for the current answer:

   - ~~"no tool path can change `attack`/`defence` — not levelling"~~ **False.**
     Root frame 227's level-up panel carries one `+` button per base stat,
     `attack` (1602) and `defence` (2252) included, and `constructDNA` persists
     them. Corrected in the block at the head of this file.
   - ~~"`hitpointsmax` 250 … no reachable (herolevel, vitality) pair"~~ **False.**
     `L=11, vitality 7` gives `110 + 140 = 250`. Six further odd levels also work.
   - ~~"`staminamax` 150 needs `stamina` 5. Nothing in the tooling writes
     `stamina`"~~ **False.** `stamina` is an ordinary level-up stat, button 2254.

   The champion family is reachable at `herolevel 11` (vitality 7, speed 7,
   stamina 5, weapon 24). It is NOT the cheapest target — weapon 24 costs 4542
   against a 2500 start, so it needs won purses. See
   `docs/integration/ss2-battle-map.md` § "The reachability arithmetic, done".

   **The byte answer to why staged hero fields die** — the question runbook §2A.5
   left open, and it is not the `experience` hypothesis. Overlay frame 1
   (`initialise`) re-runs once per turn and calls
   `skincharacter(_root.game.hero, this.hero)` → `initcharacter(hero, avatar,
   hero.charDNA)`, which rewrites all 40+ DNA fields, then `battlevalues`. The
   villain is never re-skinned there — which is exactly why `-StageVillain`
   survives to arming and `-StageHero` does not. **Nothing in the build derives
   `herolevel` from `experience`**, so the runbook's `experience:0` story was a
   coincidence: the staged run's experience sits inside the unstaged
   distribution, and nothing was suppressed. Battle-time `-StageHero` is a
   one-turn write on the hero and a durable write on the villain.

   **The "arrive empty" idea for the stamina gate is also wrong** and should not
   be tried: overlay frame 62 refills the hero's stamina AND hitpoints on every
   won bout, so a hero arriving at the rank-1 bout already has a full bar. The
   only remaining stamina risk is the number of walk actions before the first
   `checkattackroll`.

   Do NOT edit the staging string to fit. Re-derive the family's hero from the
   gladiator the project actually has — `attack` 1, `defence` 1, `magicka` 1,
   `charisma` 1, `stamina` 1, `vitality` 1 + 4 per level — and recompute the
   chance, roll and damage chain from that. The champion OPPONENT is unaffected:
   `hitpointsmax` 110 and `armourclass` 86 are hard-coded DNA and were confirmed
   again live (fifteen sightings).

2. **Capture `candidate-armoured-*` (5) and `candidate-tournament-*` (3).**
   Both reachable with the tooling as it stands, and neither needs the
   tournament ladder, so neither carries the level/stamina problem above.
   `campaign.mjs watch-fields --family <f>` prints what each needs — note the
   armoured family does NOT agree on one watch list, so it must be run one
   member at a time. Staged armour IS honoured (`damagecharacter` reads the live
   reference at roll time); staged `hitpoints` is NOT (`check_stats` clamps it
   every phase transition). **This is now the cheapest real evidence available
   and should probably come first.**

3. **The spell family (8) is still blocked** — the hook fix was necessary but
   not sufficient. See below.

`campaign.mjs plan --family <f>` names blocking reasons derived from the
repository, and [`ss2-staging-runbook.md`](docs/integration/ss2-staging-runbook.md)
has per-fixture commands.

---

## Open items

### Found 2026-09-02: what wiring SS2's arithmetic into the resolver exposed

All of these came out of a 12-agent write-nothing verification wave against
`src/team/ss2-rules.js` (12 started, 12 returned, **10 BROKEN**). The ones that
were fixed are recorded in the handoff; these are the ones still open, each with
the one fact that would settle it.

- **THE MAP WAS RIGHT AND THIS PROJECT OVERRULED IT.** `src/team/ss2-rules.js`
  was written asserting that `+0x684c` (taunt) was the only site for
  `hitpoints += 3 + ceil(stamina)`, and dropped the rest branch's heal on that
  basis — while `ss2-battle-map.md`'s own prose said the taunt copy was a copy.
  The bytes agree with the prose: `+0x51d5`, inside the rest branch's
  `struck == null` arm. **The mechanism was that the map's TABLES omitted the
  row its PROSE described**, and a table is what an implementer reads. Both are
  corrected. The general lesson is the standing rule running backwards: *derive
  from the map, and when you think the map is wrong, read the bytes before you
  write the code that says so.*
- **A MUTATION SWEEP IS THE ONLY THING THAT MEASURED THE SUITE'S REACH.** Nine
  mutations of `ss2-rules.js` passed all 685 tests. Seven of the ones tried
  since are now caught, and the fixes were never "add an assertion" — they were
  **desaturating the fixtures**: the defender sat at full stamina so the
  breastplate join clamped and wrote nothing; hero and villain shared
  `attack == defence` so swapping them was invisible; `stamina 4` makes
  `round(x/3)` and `floor(x/3)` agree. **A green suite over symmetric,
  saturated inputs is a suite that cannot see.** Run a mutation sweep on
  anything load-bearing before believing a green run.
- **The 22 goldens still cover ONE archetype in ONE dimension.** All 22:
  `armourclass 0`, eight zero piece ids, no enchantment, `fightMode: "misc"`,
  hero attack 1 == defence 1, damage exactly equal to the defender's hitpoints,
  hero at full health. Three clamp sites can each be deleted with the replay
  file green because no value ever reaches a bound. **The armour-first split,
  piece destruction, the breastplate stamina join and enchantment status have
  ZERO runtime backing.** `test/ss2-team-rules.test.js` cross-checks them
  against the arithmetic itself and says so; that is not evidence about the
  build. What closes it is a capture, not a test.
- ~~**`src/golden/ss2-attack-candidate.js:254-264` looks wrong and was NOT
  touched.**~~ **REFUTED 2026-09-02 FROM THE BYTES. The code is FAITHFUL and
  must not be "fixed"; the flag was a false positive.** `damagecharacter`'s proc
  gate is `randomBetween(1,100) < game_attacker.weapon_enchantment_potency * 10`
  at `+0x1bf1`/`+0x1c09..+0x1c22` — the PRIMARY potency, read unconditionally,
  in a gate hoisted OUT of and evaluated BEFORE the first `equipped_weapon` test
  at `+0x1c27`. Only the TYPE branches on the weapon.
  `secondary_weapon_enchantment_potency` is read NOWHERE in `damagecharacter`;
  census settles it, since `magicweapon_percentage` occurs exactly twice in the
  whole build (one write, one read), so there is exactly one enchantment roll.
  `ss2-battle-map.md:1485` already said so in prose. Derived independently by
  the main session and by two of three verifiers, and the offsets are now quoted
  AT the function so the next reader has to delete a derivation rather than redo
  one. **This is last session's `+0x51d5` lesson from the opposite direction: a
  plausible bug report against faithful code.**
  ► **WRONG AS COMMITTED, AND THE SWEEP'S REPLACEMENT IS WRONG TOO — the honest
    answer is a third thing.** The prose bullet cited was the enchantment bullet
    BEFORE the very commit this sentence describes inserted an offsets block above
    it; by the time the sentence was written one commit later, that line was the
    armour-removal bullet. **So the citation was already ~18 lines stale the moment
    it was committed.** ► Second flag: "already said so in prose" is itself
    misleading — the census sentence it now points at was written by that same
    commit; only a weaker statement pre-existed. Find both with
    `grep -n 'exactly one enchantment roll' docs/integration/ss2-battle-map.md`.

  ► **STALE, AND ONE CLAUSE IS FALSE AND KNOWN-FALSE ELSEWHERE IN THIS SAME FILE.**
    Over the 23: villain `armourclass 0` in 22; all 23 carry eight piece keys per
    side, hero all-zero 23/23 and villain all-zero 22/23; "no enchantment" 23/23
    HOLDS; `fightMode "misc"` in 22; "hero attack 1 == defence 1" 23/23 HOLDS;
    "hero at full health" 23/23 HOLDS. **But "damage exactly equal to the
    defender's hitpoints" is FALSE for every golden** — hero 21–23 against villain
    hitpoints 10 (×22) or 80 (×1) — and a paragraph further down in this living
    head says so explicitly ("The premise is false"), while this one was never
    struck.


  **The REAL defect was three lines below, and nobody had named it. FIXED.**
  Each status arm is `(equipped_weapon == 1 && weapon_enchantment_type == N) ||
  (equipped_weapon == 2 && secondary_weapon_enchantment_type == N)`
  (`+0x1c27`/`+0x1c58`, `+0x1cab`/`+0x1cdc`, `+0x1d16`/`+0x1d47`,
  `+0x1d81`/`+0x1db2`), so any other `equipped_weapon` applies NO status — while
  the module treated "not 2" as "primary" and applied one. Data-neutral today
  (all 12 corpus values are 1); it removes a divergence a future enchanted
  capture could have hit. Three tests pin it; both mutants fail.

  **Still open, and it is the bigger gap: enchantment DAMAGE is unmodelled on
  both weapons.** `weapon_enchantment_damage` (`+0x320c`) and
  `secondary_weapon_enchantment_damage` (`+0x3326`) are each
  `ceil(<max_damage>/3 * <potency>)`. ~~The secondary is absent from the adapter
  catalogue too (`src/adapter/vanilla-fields.js` carries only the primary) —
  an asymmetry, not a decision.~~ **STALE since `52bc570` (2026-09-02 06:05),
  corrected 2026-09-02 evening from the file:** `vanilla-fields.js:150,155`
  carries BOTH, and `ss2BattleValues` DERIVES both at `ss2-rules.js:472-475`.
  What is still true is the sentence that opens this bullet: the damage is
  computed and never APPLIED, because the build applies it as a status phase
  that replaces the afflicted combatant's next turn. See the 16:59 handoff for
  the costed fork.
► **DRIFT — AND THE CITATION WAS NEVER EXACT, AND THE SWEEP'S FIX IS ALSO
  STALE.** At the commit that wrote this sentence those four lines were the
  COMMENT BLOCK immediately above the assignments, not the derivation. The
  substance holds: both are derived, and `src/adapter/vanilla-fields.js:150`
  and `:155` carry both — those two anchors are still exact. Locate the
  derivation with `grep -n 'derived.weapon_enchantment_damage' src/team/ss2-rules.js`.

► **CLOSED 2026-09-07 by `86ccb68`** ("Build the status phase: a condition now
  takes its bearer's turn"), with four commits stacked on top (`1f90d3e`,
  `dda33d4`, `07773db`, `659dfab`). `resolveStatusPhase`
  (`src/team/ss2-rules.js:1146`) reads the INFLICTOR's enchantment damage at
  `:1186-1189`, selects primary vs secondary by the VICTIM's `equipped_weapon`
  at `:1188` — reproduced, not corrected, and the code says so — and applies it
  through `applySs2MagicDamageCandidate` at `:1203`. Both weapons are covered,
  so "unmodelled on both weapons" is closed. Pinned by
  `test/ss2-team-rules.test.js:1218`.


- ~~**`localeCompare` is a desync hazard and survives in two files.**~~
  **DONE 2026-09-02, and it was FIVE files, not two. The one nobody had found is
  the one that matters.** `tools/runtime-capture/build-manifest.mjs:136` broke
  the capture-manifest session tiebreak on `localeCompare`, and that array order
  is inside the digest **all 22 promoted goldens cite as
  `provenance.captureManifestSha256`** — so two machines could mint two
  different, equally "correct" digests for byte-identical evidence. Its own
  comment four lines up exists to prevent exactly that class one layer higher.
  ► **COUNT STALE, CLAIM STRONGER: 23 of 23 goldens carry
    `provenance.captureManifestSha256`.** ► **AND THIS ROW HAS TWO MORE TARGET
    SITES IN THE SAME PARAGRAPH that a careless application would miss** — "all 22
    committed manifests" and "0 of 22 reorder" — because the sweep's own table cell
    contains an escaped pipe and any naive parse of it drops them. Measured: 23
    committed manifests, **23 of 23 rebuild to the digest their golden cites**, one
    manifest per golden, none unmatched. The locale census in the same paragraph
    reproduces exactly (86 sessionIds, 3,655 pairs, az-AZ 682, haw-US 1).


  Measured over the 86 committed sessionIds (3,655 pairs): en-US and eleven
  other locales order every pair as the code-unit comparator does; **haw-US
  reorders 1 and az-AZ reorders 682.** So the fix is provably free — verified
  directly, not inferred: all 22 committed manifests still rebuild to the digest
  their golden cites, and 0 of 22 reorder under six locales. Re-derive with
  `node tools/stable-order-locale-census.mjs`.
► **OFF BY ONE, AND WRONG WHEN WRITTEN: it is en-US and TWELVE other locales.**
  `node tools/stable-order-locale-census.mjs` reports 86 sessionIds / 3,655
  pairs, az-AZ 682, haw-US 1, and thirteen of the fifteen locales scoring 0. The
  census already covered the same fifteen locales at the commit that wrote this
  sentence, so this was an arithmetic slip, not drift. The 86 / 3,655 / 1 / 682
  figures all HOLD.


  **`initiativeOrder` was worse than "the hash diverges".** It drives
  `currentCombatant` and `advanceTurn`, so a locale difference changes WHO ACTS
  FIRST: on one blueprint the RNG stream stayed bit-identical (21 draws, same
  final state) and the WINNER still flipped. It also reaches a sealed campaign
  record via `src/campaign/from-battle.js`.

  The shared comparator and the whole measurement live in
  `src/common/stable-order.js`; `test/stable-order.test.js` pins it. **Note it
  does NOT case-fold** — `["alpha","Beta"]` orders differently from en-US
  collation — which is pinned by a test rather than papered over.

  **Two traps this produced, both worth keeping.** (1) My first draft of those
  tests was SATURATED: restoring `localeCompare` left the tests *named for*
  locale-independence green, because the assertions ran in an en-US process.
  They now run the real code in a child under `LC_ALL=az-AZ`, each with a
  vacuity guard. (2) The manifest site had NO test at all, and only a mutation
  found it — reverting that one line and running all of
  `capture-campaign.test.js` under `az-AZ` passed **76 of 76**.

- ~~**The RNG tape is not inside the hash.**~~ **CLOSED 2026-09-02 with the
  CONSUMED-PREFIX digest, decided by the owner. The remedy this file used to
  prescribe pointed the WRONG WAY and was not taken.**
  The collision is real and was reproduced directly: two battles whose tapes
  differ only in an UNCONSUMED sample both hash to `2b429191`, with
  `rngState 0 / rngCursor 0` on both sides (`rng.js:126` sets `#state = 0` for
  tape mode, and `toTeamWireState` carries only `rngState`/`rngCursor`).
  ► **ANCHOR DRIFTED BY TWO, AND THE SECOND CLAUSE IS NOW FALSE.** `toTeamWireState`
    no longer carries only `rngState`/`rngCursor`: in tape mode it ALSO projects
    `rngMode` and `rngDrawn` — the consumed-prefix fix this same bullet announces.
    **The code says so itself**: `src/team/rng.js` reads "`toTeamWireState`
    **projected** only `rngState` and `rngCursor`", past tense. Locate the
    tape-mode reset with `grep -n '#state = 0' src/team/rng.js`.


  **This file said "projecting the channel mode and a digest of the samples
  would close it". Projecting a digest of the REMAINING tape closes it and
  hands every receiver a brute-forceable commitment to undrawn randomness** —
  measured, with two samples left, recovered in 600 candidates from the labels
  and bounds the rule set already dictates. **And splitting the wire from the
  hash does NOT fix that**: with the digest in the hash preimage only, the same
  search still recovered the values from the transmitted hash in 436 tries,
  because peers must exchange the hash for a desync check to exist at all. The
  leak is intrinsic to detecting divergence in samples nobody has drawn yet.

  **The leak-free maximum is a digest of the CONSUMED PREFIX.** It cannot detect
  a future divergence, but it closes the divergences that have already happened
  — including the case all three candidate designs miss: two tapes whose
  ALREADY-DRAWN sample differed while producing identical state.

  So the decision is not "what to project" but **"detect future divergence early
  and leak future rolls, or detect only past divergence and leak nothing".**
  A tape-only projection was measured to break 0 tests: the 12 pinned hashes in
  `test/team-resolver.test.js` are the only literal hashes in the repo and none
  is a tape battle.
► **WRONG ON ITS FACE, AND WIDER THAN THE SWEEP SAID — SCOPE IT.** (a) The twelve
  pins named are real, all seeded, none a tape battle, so that clause holds.
  (b) There is now a THIRTEENTH `combatStateHash` pin, in
  `test/ss2-team-rules.test.js`, also seeded, so the tape-only projection still
  does not move it. (c) **"The only literal hashes in the repo" is false**:
  `src/golden/pre-nonce-observations.js` alone carries 58 literal 64-hex
  sha256s, and there are more elsewhere. **Correct scope: "the only literal
  pinned COMBAT-STATE hashes", and there are 13.** The load-bearing conclusion —
  the projection landed and the suite is green — survives.


- **`ss2BattleValues` reproduces a SUBSET of `battlevalues`, and two omissions
  change a fight.** `weapon_min_damage`/`weapon_max_damage` are themselves
  `battlevalues`'s lookups into `_root.weapon[...]` (`+0x31be`, `+0x31da`) and
  are taken as caller-supplied inputs here, so a gladiator's damage pair cannot
  be produced from a character record alone; and `weapon_enchantment_damage`
  (`+0x320c`) is dropped entirely, so an enchanted weapon applies a status and
  deals no magic damage. Also dropped: `maximum_ammo`'s herolevel tier chain,
  `character_xp`, and `weapon_range`'s bow override.
- **A fight can run forever.** `phaseTransitionEffects` heals the acting
  combatant every non-lethal action, so any pair whose per-action self-heal
  exceeds expected incoming damage never dies (measured at 30,000 actions).
  This may be faithful — vanilla has the same regeneration — but the resolver
  has no draw or turn cap, so it surfaces as `AI turn limit reached`.
- ~~**AGENTS.md's two test profiles are stated in a way that invites a false
  finding.**~~ **ALREADY CLOSED — verified 2026-09-02 at `AGENTS.md:153-156`,
  which reads "holding at least one probe session directory under the gitignored
  `captures/` archive" and says in its own parenthesis that a tree with
  `captures/` and 1 skipped is CORRECT. Nothing to do; the item outlived its
  fix.**
  ► **PURE DRIFT; the quoted wording is word-for-word unchanged.** Find it with
    `grep -n 'holding at least one probe session directory' AGENTS.md`. (The
    sweep's replacement span over-reaches — it includes the bold header and the
    following bullet.)

  ► **BOTH NAMED HALVES ARE NOW FALSE.** `ss2BattleValues` derives the damage pair
    from a `weapon` id (an explicit pair still wins) and derives
    `weapon_enchantment_damage`; a call with `weapon: 5` alone returns
    `min_damage 27 / max_damage 69`. ► **But do NOT sweep away the REST of this
    bullet's "also dropped" list, which still HOLDS**: no `maximum_ammo` herolevel
    tier chain (only the `ammo_left` fallback), no `character_xp`, no bow
    `weapon_range` override. The offsets themselves are unchallenged.


### Found 2026-09-02 (overnight): what a CAPPED verification wave established

Seven questions, 50 verifiers, **50 returned, 0 dead — status VERIFIED**, after
the previous four waves died at 119 verdicts of 1,069. Each item below was
re-derived by the wave and the load-bearing ones re-derived again by the main
session before anything was written.

- **THE WEAPON TABLE IS NOT RUNTIME-CORROBORATED, AND THE TEST THAT SEEMED TO
  SHOW IT IS NEAR-TAUTOLOGICAL.** An investigator claimed that inverting
  `min_damage − round(strength*2)` over the archive lands on a real table pair
  for 26 of 28 triples, which would have lifted the table above `map-derived`.
  Broken four ways:
  1. **The test cannot fail for an honest record.** `battlevalues` derives
     `min_damage` and `max_damage` from the SAME table row (`+0x31be`, `+0x31da`)
     and adds the same `round(strength*k)` to both (`+0x3356`, `+0x3386`). So
     any record the game itself produced inverts back onto a table pair BY
     CONSTRUCTION. It measures that arithmetic is arithmetic.
  2. **Measured false-match rate is high.** Perturbing every observed triple by
     ±1 in min and max — 423 deliberately WRONG triples — still passes 6.1%.
  3. **No observation carries a weapon-identifying field at all.** `weapon`,
     `whichweapon`, `using_bow`, `weapon_min_damage`, `secondary_min_damage`
     and `attack_type` occur ZERO times across all 447 `.jsonl` and 57 `.json`
     records. Only `ammo_left` appears. So nothing pins WHICH row a match used.
  4. **Coverage is 10%.** The matching triples collapse to 7 distinct
     `(min,max)` pairs of the table's 69, compatible with 9 ids of 90 —
     **81 rows corroborated by nothing.**
  Also: the inversion formula is wrong in bow mode, where `+0x3416` overwrites
  the primary pair with the secondary one at `round(strength * 1)`.
  **The table stays `map-derived`, and `tools/item-table-transcription.mjs`
  against the build remains the only thing that backs it.**
     ► **RE-MEASURED 2026-09-07 AND THE COVERAGE IS HIGHER, NOT LOWER: 68 distinct
       triples, 63 inverting, collapsing to 10 distinct `(min,max)` pairs of the
       table's 69, compatible with 14 ids of 90 → 76 rows corroborated by nothing,
       coverage ~15.6%, not 10%.** The table constants are unchanged (90 ids, 69
       distinct pairs, re-derived from `src/team/ss2-weapon-table.js`), and adding the
       archive's 57 `.json` files contributes zero new triples, so the result is
       robust to the scope question. Live growing store — carry the command.
       ► **SCOPE HAZARD: do NOT push this correction up into the sentence above that
       says an investigator "claimed … for 26 of 28 triples".** That is a quotation
       of a past claim, not a live count; rewriting it would falsify the record of
       what was claimed.

     ► **ONE DENOMINATOR MOVED, THE OTHER MUST NOT BE TOUCHED.** The zero-weapon-field
       finding HOLDS exactly — `weapon`, `whichweapon`, `using_bow`,
       `weapon_min_damage`, `secondary_min_damage` and `attack_type` are still ZERO
       across both file types. **`.jsonl` moved 447 → 1,544; `.json` is still exactly
       57, so a blanket substitution would falsify the half that is correct.**
       ► And the claim is true only because it is SCOPED to `.jsonl`/`.json`: the
       RUFFLELOGS do carry weapon data. `equipped_weapon`/`secondary_weapon` appear
       in 140 rufflelogs, but only inside `navdiag` property-NAME enumerations, and
       two arena-shop traces record a real weapon-table id as a VALUE. Neither of
       those two sessions has a `.jsonl` or any `min_damage` line — **so the
       conclusion survives for a sharper reason than the one given: the id-bearing
       and triple-bearing traces are DISJOINT sets.**


- **THE THIRD FORGERY IS OPEN, AND WIDER THAN THE HEAD DESCRIBES. The vehicle
  is `capture.method`, not `callSite`.**
  - **A purely synthetic `simulateSs2CaptureTrace` output, with only
    `meta.method` re-stamped to `injected-tape-runtime`, PROMOTED TO A GOLDEN
    through the unmodified CLI.** That is the vehicle every one of these rides.
  - `passive-runtime` is **unreachable by the honest pipeline** — the wrapper's
    only `t:"roll"` emitter is guarded by `config.injected`, so a passive trace
    has zero samples and ingest refuses a zero-sample trace. Every
    passive-runtime record is therefore, by construction, not from the wrapper —
    and only `synthetic-simulator` is refused at promotion. **The promoted
    golden carries no capture-method field at all.**
  - The co-forgery must also forge the manifest's `sessions[].method`, or
    promotion refuses with "disagrees with its manifest session about the
    capture method". That is the one guard that fires.
  - ► **"and the suite stays green" is FALSE, and the true statement is worse.**
    Promoting any new golden from `candidate-lethal-result` fails 15 of 715
    tests whether or not anything is forged — but the forged and honest suite
    outputs normalise to a **0-line diff**. The suite is not green; it is
    BLIND. Do not quote the green form.
  - The committed forgery probe (`test/capture-campaign.test.js:~903`) forges
    exactly ONE cited record per iteration, so **the two-sided case — both
    records agreeing on the same fabrication — is covered by no test.** That is
    precisely the case the head says still promotes.
  - `hook` IS caught (DIVERGE at `/mutationTrace/0/hook`, refused at
    promotion), and `injected` alone is refused at ingest in both directions.
    So of the head's three named channels, one is closed and one is only open
    with `method` co-forged.
    ► **THE SWEEP CALLED THIS UNCHECKABLE. IT IS CHECKABLE, AND THE ANSWER IS A
      DIFFERENT NUMBER, NOT A STALE DENOMINATOR: 8 failures of 816, not 15 of 715.**
      Measured 2026-09-07 by actually doing it in a disposable copy: simulate two
      traces for `candidate-lethal-result` with distinct launch nonces, ingest them,
      and promote through the UNMODIFIED CLI — the suite then reads 816 / 807 / 8 / 1
      and the total does not grow. The eight are named in the session record.
      ► **A TRAP FOR WHOEVER REPEATS THIS: a scratch copy built without `.git` is
      NOT a valid baseline** — it reads 813/811/1/1, because a transcription test
      reads the git history and fails at file level, swallowing its own four tests.
      Copy with `.git` included. ► Also worth stating: **no committed observation
      targets `candidate-lethal-result`**, so this is a hypothetical about a
      promotion the corpus cannot currently reach.


- **THE CLAMP ITEM IS WRONG IN ITS COUNT, ITS CAUSE AND ITS PREMISE.**
  The head says "three clamp sites can each be deleted with the replay file
  green because no value ever reaches a bound".
  - **The premise is false.** All 22 goldens stage villain `hitpoints` and
    `hitpointsmax` at 10 against hero `min_damage` 21 / `max_damage` 23 — so
    damage is NOT "exactly equal to the defender's hitpoints", it hugely
    exceeds them, and values DO reach bounds: instrumented,
    `src/team/resolver.js:259` takes 141 arrivals of which 120 land exactly on
    the floor.
  - **The count is far worse.** At the head's own bar (the replay file green)
    **15 of 16** clamp sites delete green. Against the FULL suite, **exactly
    seven** whole-site deletions stay green: `ss2-rules.js:490`, `:707`,
    `resolver.js:261`, `roster.js:168`, `ss2-attack-candidate.js:228`, `:237`
    and `:575`. Only ONE of the head's three is among them.
  - **`ss2-attack-candidate.js:339` is the only clamp the replay defends**, so
    that file's own header claim at lines 32-35 that it "proves NO CLAMPING" is
    false and should be corrected there.
  - **`ss2-rules.js:784`'s stamina FLOOR is dead code**: deleting just the floor
    stays green even though `test/ss2-team-rules.test.js:456` drives −38
    through it, because `src/team/resources.js:252` re-clamps every resource
    write to the entry's minimum. A guard behind a guard reads as coverage.
    ► **ANCHORS DRIFTED, SUBSTANCE AND MUTATION BOTH HOLD.** Both were EXACT at the
      commit that wrote them. **Re-run 2026-09-07: deleting only the floor stays
      green at 816 / 815 / 0 / 1 — the dead-code claim reproduces.** The −38
      arithmetic is right (`strengthFactor: 2`, so 1 − round(20×2) + 0 + 1 + 0 = −38).
      ► **Bonus defect: that test's own inline comment says "1 - 20 + 1 is 0, not 1",
      using factor 1 — the comment understates its own spend by half.**

    ► **FIVE ANCHORS HOLD, TWO DRIFTED, AND THE MUTATION RESULT REPRODUCES IN FULL.**
      All seven were EXACT at the commit that wrote them, so this is honest drift,
      not a bad citation. **Re-run 2026-09-07 in a disposable copy: all seven
      whole-site deletions applied one at a time, reverting between — seven of seven
      stay green at 816 / 815 / 0 / 1.** The claim survives at HEAD intact. Locate
      the two that moved with `grep -nE 'Math\.max|Math\.min|clamp\(' src/team/ss2-rules.js`;
      the sweep's replacements for them are themselves stale by 14 lines.

    ► **STALE, AND "23" WOULD BREAK IT.** 22 of the 23 goldens stage villain
      `hitpoints`/`hitpointsmax` at 10; the armoured golden stages 80/80 (hero
      300/300). The hero `min_damage 21`/`max_damage 23` pair HOLDS across all 23.
      **So the digit 22 is still a correct COUNT, but "All 22 goldens" misdescribes
      the corpus — name the subset instead.** The bullet's conclusion survives on
      BOTH archetypes (21–23 against hitpoints 10; `armourDamage` 22 against
      `armourclass` 79). The "141 arrivals / 120 on the floor" instrumentation
      figure beside it was NOT reproduced — carry it as unchecked.


- **A METHODOLOGY HAZARD, found by two agents independently and worth keeping:
  the session scratchpad is SHARED between a wave's agents.** One agent's
  `dump.mjs` was clobbered mid-run by a sibling; another copied the repo into a
  path that already held a sibling's copy and got a nested checkout reporting a
  doubled **1425 tests / 1423 pass**. Agents must namespace into their own
  subdirectory, and a doubled test count is the symptom.

### Found 2026-09-01 (evening): the armoured family measured at n=38, and what it is actually waiting on

**Read this before the block below it, which it corrects in its ranking.** All 38
armed `adc` traces were delogged to scratch (27 of them for the first time) and
run through the repository's OWN matcher — `ingestSs2CaptureTrace` +
`matchSs2ObservationToFixture` — against all 8 blocked fixtures. Nothing was
written into the corpus. Re-derive with the archive at
`/mnt/c/ss2-capture/captures`; `node tools/capture-session.mjs delog --trace <f>
--out <scratch>` needs no install and no Ruffle.

► **THE FAMILY IS ONE FIELD FROM EVIDENCE, AND THE FIELD IS THE VILLAIN'S
  `staminaleft`.** Comparing every pinned field the trace actually watches,
  **35 of 38 armed rounds reproduce the target fixture's scenario exactly except
  `staminaleft`**; the only other offender is `hero.hitpoints`, in 3. Under the
  full matcher (samples, mutationTrace, finalState and events included) **4 of 38
  — `adc33`, `adc35`, `adc37`, `adc42` — diverge on NOTHING BUT `staminaleft`.**

► **THE HERO SIDE IS SOLVED AND NOBODY HAS USED IT.**
  `hero.staminaleft == 110 − (hero walk count)` holds **38 of 38**, exceptionless.
  So the hero's value is a deterministic function of a quantity the autopilot
  CHOOSES. The fixtures' `hero.staminaleft 105` is exactly 5 walks, which
  occurred in 13 of 38. **Pin the approach-step count and the hero side stops
  being a lottery** — this is the "fix the capture, not the comparison" remedy
  § "READ THIS FIRST" already prescribes, and it has never been implemented.

► **THE VILLAIN SIDE IS NOT MERELY UNPINNED — IT IS UNOBSERVED, BY
  CONSTRUCTION.** The wrapper's action stream comes from ONE hook,
  `getphase` (wrapper 2347-2357), and `getphase` carries only the HERO's
  actions: the villain is dispatched through `villaindecisionA` /
  `villaindecisionB` (`+0x3ac0`, `+0x3b0a`), written by `villainChooseAction`
  at `sprite:862[overlay]/frame:52/DoAction@0x23f835`. **So the sole determinant
  of `villain.staminaleft` at arming — the villain's own action sequence — is
  recorded nowhere in any of the 240 archive entries.** Confirmed live: `adc36`
  drained 33 villain stamina and its trace records four `phase_action` lines,
  all the hero's. Widening `DEFAULT_WATCH_FIELDS` cannot reach this; a watch
  fires on a field, and this is a sequence. **Hooking `villainChooseAction` is
  the change that would make the villain's stamina explainable from the record.**
  Not attempted; costed nowhere; and note it is an OBSERVABILITY change, not a
  determinism one — `villainChooseAction` makes its own random draws.
  ► **SUBSTANCE HOLDS AND IS STRONGER THAN STATED; ONLY THE DENOMINATOR MOVED.**
    `villaindecision` (case-insensitive) appears in **ZERO** files anywhere in the
    live archive — including the 154 decompiled wrapper-source copies — and zero
    in the frozen replica. The denominator is now ~1,592 entries, not 240; the 240
    described the pre-relocation archive, and the frozen 2026-08-31 replica still
    holds 238, which is within two. Live growing store: write
    `grep -ril 'villaindecision' <archive> | wc -l` rather than a denominator.


► **`attackDirection` IS THE SECOND BLOCKER AND IS IRREDUCIBLE AT P = 1/4.**
  32 of 38 rounds diverge on `/scenario/attackDirection` (observed 4, 8, 10, 11
  against the pinned 5). `normal_attack` draws it at `+0x61f1` as
  `randomBetween(5, 8)`. **It cannot be injected**: across all 38 traces the 254
  recorded rolls are `injected: true` and **not one is a `(5,8)` draw**, because
  the wrapper arms after the direction is already chosen — `beginAction` READS
  `ov.attack_direction` rather than serving it. So every armoured round is a
  1-in-4 lottery on direction before stamina is even considered. The map says
  the same thing in its own words ("nothing in a run can select the direction");
  this is that claim confirmed from the traces.
  ► **THE COUNT HOLDS; THE VALUE LIST IS THE 11 COMMITTED DIVERGENCE REPORTS'
    VALUES, SILENTLY PRESENTED AS THE 38'S.** Across all 38 the non-5 values are
    2, 3, 4, 6, 7, 8, 10, 11 and 20. ► **BUT REFUSE THE INFERENCE THE SWEEP DREW
    FROM THAT.** Attributed by which combatant took the first `damagecharacter`
    hitpoints write — the battle map's own method — **28 of the 38 are HERO swings
    and all 28 landed inside `randomBetween(5, 8)`; the 9 out-of-band rounds are
    VILLAIN swings, which the battle map already states.** Writing "9 of the 38
    landed outside range, so the P = 1/4 framing is in doubt" would put into the
    record an implication that the hero's `+0x61f1` draw produced 2, 3 and 20 —
    contradicting a byte-verified map row, i.e. deriving from a capture instead of
    from the map. **The framing does not merely survive; the archive now confirms
    it at n = 1,171**: every one of the 1,171 delogged `session-onx*` rounds is a
    hero swing and every direction is in {5,6,7,8} — 273 / 287 / 304 / 307, so
    P(5) = 0.2331 against 0.25 (z = −1.33). The rest of the bullet is exact: 254
    roll lines, 0 not injected, 0 that are a `(5,8)` draw.


► **TWO OF THE EIGHT FIXTURES CANNOT INGEST AT ALL, AND IT IS NOT A DIVERGENCE.**
  `candidate-armoured-removal-destroys-helmet` and
  `-destroys-shoulderguard` REFUSE every one of the 38 traces with
  *"the staged villain state is missing the required field `helmet_defence`"*
  (`shoulderguard_defence` for the other). Those fields are pinned by the
  fixtures and absent from the wrapper's 29-key state dump. **The mechanism is
  already right and is `-WatchFields`, which EXTENDS the default per session** —
  do NOT widen `DEFAULT_WATCH_FIELDS`, for the reason the wrapper's own comment
  gives. This is the cheapest unblocking on the list and nothing records it.
  ► **HALF TRUE, HALF WRONG — AND THE WRONG HALF WAS WRONG WHEN WRITTEN
    (`d39fb8b`, 2026-09-01 16:41).** "Nothing records it" is false: it was already
    recorded in three places, two of them PREDATING this sentence —
    `docs/integration/ss2-staging-runbook.md` §1.1 (rows added `d8642b2`,
    2026-08-30 22:47) and `tools/runtime-capture/campaign.mjs watch-fields`
    (`863ac0f`, 2026-08-30 23:19), which DERIVES the string rather than quoting
    it: `node tools/runtime-capture/campaign.mjs watch-fields --family
    armoured-removal-destroys-helmet` prints `helmet_defence,shoulderguard_defence`
    for both fixtures. The CAPTURE is genuinely still open (no
    `armoured-removal-destroys` fixture or observation is committed). So this is
    one sentence with a true half and a false half, and only the false half is
    struck.

  ► **THE PARENTHETICAL IS FALSE.** BOTH removal fixtures pin BOTH
    `helmet_defence` and `shoulderguard_defence`, in the same key order, and
    `projectFields` iterates `Object.keys(fixture.scenario.villain)` in file order
    and fails on the FIRST missing key. **Measured by running the real ingest: 22
    of 22 runs (2 fixtures × 11 delogged traces) fail on `helmet_defence`;
    `shoulderguard_defence` never appears.** Everything else HOLDS exactly — the
    villain dump is 29 keys, neither `*_defence` is in it, 0 of the 38 armed traces
    carry one, and the `-WatchFields` advice is right. **Two caveats on "every one
    of the 38": only 11 are delogged, so the refusal is EXECUTED for 11 and
    INFERRED for 27 from an identical dump shape; and under default options the
    first refusal today is the null-attestation gate, not the field.**


► **ALL 38 ROUNDS TARGETED ONE FIXTURE. Seven of the eight have never had a
  capture attempt that could match them.** Identified by the injected tape,
  whose seven values pick out `candidate-armoured-deflection-threshold-cleared`
  uniquely. `equality-quirk` and the three `tournament-*` stage a different
  villain (`armourclass 22, helmet 2`) that no `adc` round ever staged. **So
  "the armoured family has spent 38 rounds" is really "one fixture has".**
  ► **WRONG ON ITS FOURTH MEMBER; THE CONCLUSION SURVIVES BY TWO ROUTES INSTEAD OF
    ONE.** Three of the four stage villain `armourclass 22 / helmet 2`, but
    `candidate-tournament-nonlethal-normal-hit` stages `armourclass 0` and has NO
    `helmet` key at all. The conclusion is untouched: all 38 armed rounds staged
    one distinct villain tuple (`armourclass 79, helmet 6, shoulderguard 1`), so
    neither the ac-22 nor the ac-0 villain was ever staged; and the injected tape
    is the seven values `(100, 22, 20, 93, 12, 1, 100)`, which among the eight
    fixtures only `candidate-armoured-deflection-threshold-cleared` matches.


► **DELOGGING THE 27 ADDS NO MATCHABLE EVIDENCE, WHICH RETIRES A RANKED ITEM.**
  The 15:50 handoff ranks "27 archived armed traces were never delogged" third,
  on the reasoning that the repository can see only a third of the evidence. It
  can see only a third of the TRACES, but all four staminaleft-only near-misses
  were already among the 11 delogged. The 27 contribute 0 additional near-misses
  and diverge on `attackDirection` 27 times out of 27.

► **AND THEY CANNOT BE HONESTLY INGESTED TODAY.** All 38 traces carry
  `"installHashVerifiedAfter": null`. Ingest's placeholder path then runs
  `verifyInstallAgainstFingerprint` LIVE and stamps `true` — **asserting a
  post-session hash check about sessions that ran on 2026-08-31.** That is the
  quiet conversion of measured evidence into asserted data this project exists
  to refuse, and there is no committed record to carry the value forward from,
  because **zero `adc` observation records are committed** (68 observations, none
  from this family). Measure them in scratch, as this session did; do not ingest
  them without deciding that question first.
  ► **68 → 69, and one half of this is now FALSE.** "Zero `adc` observation records
    are committed" HOLDS — none in `test/observations/ss2-1v1`, and the 11 adc
    records exist only as divergence reports. **But "none from this family" turns
    on what "family" means, and on the reading this paragraph is actually about —
    the ARMOURED family — it is false:** `obs-onx1405-a1` and `obs-onx1521-a1` are
    committed, target `candidate-armoured-deflection-threshold-cleared`, and both
    carry `installHashVerifiedAfter: true`. **So the paragraph's load-bearing
    claim — "there is no committed record to carry the value forward from" — is
    now false for the armoured family**, though still true for the 38 adc traces.


► **THE LOAD-BEARING NEGATIVE UNDER THE WHOLE PLAN HAS NO BYTE CITATION.**
  "The villain is never re-skinned, so `-StageVillain` is durable" is the
  foundation of every armoured capture, and it appears only in this file (lines
  ~716-724, ~897) with no offset, no reference count and no `inspect-swf`
  command — while its HERO half is fully byte-cited. Observational support does
  exist and is decent (12 of 12 staged villain fields constant across all 38
  rounds, while 6 unstaged villain stats vary), but that is not the same as the
  negative being established. Check it with
  `inspect-swf --references '"value":"skincharacter"'` before another supervised
  window is spent on it.

**So the ranked order that follows from the measurements is:** (1) add
`helmet_defence`/`shoulderguard_defence` via `-WatchFields` — two fixtures
unblocked for the cost of one parameter; (2) pin the approach-step count, which
removes the hero-side lottery outright; (3) decide the villain-stamina scenario
question, which is the owner's call and is now costed honestly (3 values per
fixture, 0 recalculations — see the correction in the block below); (4) only
then a gate, and only one that can be exercised by an extended stub. **Nothing
in (1) through (3) needs Ruffle, the save, or a supervised window.**

### DECIDED 2026-09-01 (evening): the villain-stamina remedy needs a SCHEMA change, and the fixtures were NOT edited

The owner chose the remedy — re-scenario the villain with a stat vector whose
stamina is invariant to its own action sequence — and it was derived properly
before being written: a VERIFIED wave (6/6 question-diverse derivers, 18/18
write-nothing verifiers, 0 errors, **7 of 18 verdicts BROKEN**), forbidden from
opening any capture, working from the hash-verified SWF. **The derivation says
the remedy cannot be expressed as a fixture edit today. No fixture was
changed.** That is the finding, and it is worth more than the edit would have
been.

► **THE SCHEMA PINS THE OUTPUT AND REFUSES THE INPUT. This is the whole defect,
  stated exactly, and it is not a fixture-authoring oversight.**
  `COMBATANT_KEYS` (`src/golden/run-1v1-fixture.js:91`) is a closed allow-list of
  **42** keys. `staminaleft` and `staminamax` are in it. **`stamina`, `speed`,
  `vitality` and `herolevel` are NOT** — re-derived directly from the source, not
  relayed. `assertAllowedKeys` (:216-221) throws
  `scenario.villain has unsupported fields: stamina.`, measured at
  **630 / 612 / 17 / 1**. `TOURNAMENT_OPPONENT_PARAMETERS`
  (`test/ss2-post-tutorial-fixtures.test.js:170`) independently pins the same
  15-key villain surface, so two places must move together.
  ► **PURE DRIFT; EVERYTHING SUBSTANTIVE HOLDS AND WAS RE-COUNTED, not relayed.**
    Both anchors were EXACT at the commit that wrote them. The allow-list holds
    exactly 42 keys; `staminaleft` and `staminamax` are IN; `stamina`, `speed`,
    `vitality`, `herolevel` are ABSENT; the throw message is unchanged;
    `TOURNAMENT_OPPONENT_PARAMETERS` holds exactly 15 keys. **The suite figure in
    this same bullet describes a DELIBERATELY BROKEN tree — re-measure it, do not
    substitute today's total into it.**


  So a scenario may pin a quantity the game DERIVES while being forbidden from
  declaring what derives it. Every "unpinned input to a pinned output" finding in
  this file is a symptom of that one fact.

► **AND GOING GREEN ON A VALUE-ONLY EDIT PROVES NOTHING — measured, and this is
  the result that stopped the edit.** Setting
  `villain.staminaleft = staminamax = 300` plus the paired
  `expected.state.villain.staminaleft` in all 8 fixtures **passes the full suite,
  630 / 629 / 0 / 1**. But a verifier then set the same fields to **7** and got
  the identical 630 / 629 / 0 / 1 — and 7 is impossible in the runtime, since
  `battlevalues` makes `staminamax = 100 + stamina*10 >= 100` always. **The suite
  cannot tell a derived value from an arbitrary one here**; its only stamina
  teeth are `clampCombatant`'s `0 <= staminaleft <= staminamax`. A green suite
  would have been mistaken for a validated remedy.

► **THE MINIMUM STAMINA IS NOT THE CONSTANT 20 I CARRIED INTO THIS. It is a
  function of four stats the scenario cannot declare.** Byte-derived:

  ```
  M = max( 2*movement_speed,      chargeleft/right  +0x4214 / +0x4480
           round(strength*3),     power_attack +0x603c; snipe*/bombard* +0x6bb5
           round(charisma*2),     taunt +0x67bb
           round(magicka),        18 cast_* blocks
           7 )                    block +0x4ca4
      movement_speed = clamp(round(speed*1.5), 4, 60)
  regen = 1 + round(stamina/3)       so   stamina_min = 3M - 4
  ```
► **OFF BY ONE: the map records 17 `cast_*` SITES covering 20 distinct labels,
  not 18.** Two rows are shared branches — lightning/frightning bolt at one site,
  fireball/hell/dire at another — so 15 + 2 + 3 = 20 labels across 17 sites. The
  table has 42 rows total, exactly matching the "42 assignment sites" the map
  claims two paragraphs above, so **the table is internally consistent and "18"
  is not any of these numbers under any counting.** Write 17: this citation is a
  SITE count in a formula whose other four citations are single sites. The
  `M = max(...)` derivation is unaffected — every phase in the table reduces to
  `2*movement_speed`, `round(strength*3)`, `round(charisma*2)`, `round(magicka)`
  or the constant 7.


  `M = 8` — and hence `stamina 20`, `staminamax 300` — holds **only** for a
  villain with `strength <= 2, charisma <= 4, magicka <= 8, speed <= 2`. **The
  tournament villain's `strength` is DRAWN by `randomise_gladiator` and was
  observed ranging 1..8**, so `M` is not fixed: at `strength 8`, `M = 24`,
  `stamina 68`, `staminamax 780`. There is no single vector without pinning the
  four stats — which returns to the schema.

► **THE REMEDY HAS A SIDE EFFECT ON A FIELD THESE FIXTURES DO PIN.** `nextphase`
  regenerates the acting combatant's hitpoints by **`1 + Math.ceil(stamina/2)`**
  every phase transition (`+0x3305..+0x3346`, immediately before `check_stats`).
  Raising villain `stamina` to 20 raises that from 2 HP/phase to 11. The 8
  fixtures pin `villain.hitpoints 80`. **Buying stamina invariance spends
  hitpoint stability**, and no one had connected the two.

► **`hitpointsmax: 80` CARRIES THE IDENTICAL DEFECT, and it is worse.**
  `battlevalues` recomputes it unconditionally at `+0x378e` as
  `herolevel*10 + vitality*20`, and **neither is declarable** either. Worse than
  `staminamax`, which inverts to a unique `stamina`: `80` is satisfied by
  herolevel 6/vitality 1, 4/2 AND 2/3, so it does not even pin one vector.

► **THE HERO SIDE IS STRICTLY LESS DETERMINED THAN THE VILLAIN'S, NOT MORE.**
  Arena `initbattle` resets only the VILLAIN's `staminaleft` to its max
  (`sprite:2249/frame:1 +0x0b9c`, unconditional). Nothing does it for the hero,
  and `staminaleft` carries across bouts. So a villain-only fix leaves the same
  defect on the hero, where the guaranteed starting point does not exist.

► **AND A CAVEAT THAT MAY KILL THE APPROACH OUTRIGHT, flagged by the deriver
  against its own answer:** three `getphase` branches rewrite the ACTING
  combatant's own base stats mid-bout — `cast_swiftsandals`, `cast_bloodlust`,
  `cast_colossus` — and all three are villain-selectable through
  `villain_cast_spells`. Hardening the invariant against them needs `stamina 122`.
  **Not verified; treat as the next thing to check**, because if it holds no
  reachable vector is invariant and the answer is a different remedy entirely.

**What to do with this.** The question is no longer "what value should
`villain.staminaleft` be". It is: **should `COMBATANT_KEYS` admit the derived
stats (`stamina`, `speed`, `vitality`, `herolevel`) so a scenario can declare
what the game derives from?** That is a schema decision for the owner, it is now
costed and byte-backed rather than vague, and it is the same decision the head
has been circling since 2026-08-31 under the name "the schema question".
**Do not land a value-only edit in the meantime** — it would put the conclusion
of a derivation into a file that refuses to carry the premise, in a suite
measured to be blind to the difference.

### Found 2026-09-01: the armoured and tournament families are blocked by the FIXTURES, not by capture luck

► **ALL EIGHT REMAINING "REACHABLE" FIXTURES PIN A PATH-DETERMINED OUTPUT WHILE
  OMITTING THE INPUTS THAT DETERMINE IT. No amount of sampling, throughput or
  memory fixes this, and the campaign planner's advice — "the remedy is more
  rounds, not a code change" — is WRONG for this family.** Re-derived from the
  SWF and the archive 2026-09-01, and independently reproduced by the main
  session after a question-diverse wave raised it.
  ► **TWO HALVES, OPPOSITE VERDICTS — AND THE SWEEP'S REPLACEMENT NUMBER IS
    REFUSED.** The STRUCTURAL half HOLDS, including of the promoted golden, which
    pins villain `staminaleft 105 / staminamax 110` while its villain block carries
    no `speed` and no `strength`. **The ABSOLUTE half — "no amount of sampling,
    throughput or memory fixes this" — is FALSIFIED for exactly one of the eight**:
    more rounds WAS the remedy for `candidate-armoured-deflection-threshold-cleared`.
    ► **But the "5 hits" the sweep proposed is wrong: the measured figure is 2.**
    Running the repo's own matcher over the archive, of 1,171 delogged
    `session-onx*` traces exactly **2** produce zero differences — precisely the
    manifest's two. Five traces hit a looser three-condition filter; three of those
    fail a fourth condition the filter omits (hero `hitpoints`), and a sixth hits
    the stamina pair but drew direction 7. **So the joint precondition is FOUR-way
    and it landed 2 in 1,171 (0.17%)**, with the binding constraint being the
    staged villain `staminaleft` surviving to arming (0.51%), not the direction
    draw (23.3%). Live growing store — carry the command, not the ratio. Also
    stale in the same sentence: seven of the eight remain candidates, not eight.


  The five `candidate-armoured-*` and three `candidate-tournament-*` all pin
  hero AND villain at `staminaleft 105 / staminamax 110`. `staminaleft` is
  PATH-DETERMINED — the battle map says so in its own words, and the bytes agree:
  `nextphase` (`overlay:862/frame:52/DoAction@0x240c7f` `+0x32a1`–`+0x3304`)
  subtracts `staminacost` and adds `1 + round(stamina/3)` on `game_attacker`
  ONLY, unbranched, every phase transition. So the value at any
  `checkattackroll` is a function of the actions already taken.

  **What the archive measures.** 42 `session-adc*` directories exist, **38 of
  them armed** (`"at":"action-armed"`), and only 11 were ever delogged to a
  `.jsonl` — so **27 complete armed traces have never been converted into
  observations**, and every count taken from the 11 committed divergence reports
  understates the evidence by 3.5x. Across the 38:

  - hero `staminaleft == 110 − (walk count)`, **38 of 38, no exceptions.** The
    map's stamina arithmetic is runtime-confirmed at n=38.
  - hero `== 105` in 13 of 38; villain `== 105` in **1** of 38 (`session-adc21`);
    **both == 105 in 0 of 38.** Villain range 77–110, wider than the 90–110 the
    11-report subset shows.

  **Why the villain wanders.** The tournament opponent is drawn by
  `randomise_gladiator(whichcharacter, whichavatar, herolevel)` — six call sites,
  including `sprite:1788/frame:69` (x3) and `root/frame:214`. Its `strength` was
  observed ranging 1..8 across the archived rounds. `staminacost` reads
  `strength`, `charisma`, `magicka` and `movement_speed` off `game_attacker`, and
  `movement_speed = clamp(round(speed*1.5), 4, 60)`. **So `speed` and `strength`
  set the villain's per-phase stamina cost — and the armoured villain block pins
  NEITHER.** Compare the two families' villain blocks:

  | | villain stats pinned |
  | --- | --- |
  | `prisoner-*` (12 goldens) | `attack, strength, charisma, magicka, min_damage, max_damage` + armour |
  | `armoured-*`/`tournament-*` (0 goldens) | armour pieces + `defence` ONLY |
► **`armoured-*` now has 1 golden; `tournament-*` still 0.** The stat description
  reproduces for the armoured villain block (`defence` only, plus armourclass,
  hitpoints, stamina, four pieces and `gladiator_dir` — no attack/strength/
  charisma/magicka/min_damage/max_damage). **Two things neither the document nor
  the sweep states.** (1) The `prisoner-*` row of this same table is also
  imprecise: the prisoner villain DOES pin `defence`, at 0, which that row omits.
  (2) **Before escalating the prose under this table from "(0 goldens)" to "the
  defect is now in a golden", check it**: the promoted armoured golden's expected
  block carries no villain stamina arithmetic (`staminaleft` 105 unchanged;
  mutation `armourDamage 22 / hitpointDamage 0`), so "pins an output that its
  unpinned stats determine" is not obviously true OF THAT GOLDEN.


  The armoured fixtures describe a RANDOMISED opponent by its armour alone, then
  pin an output that its unpinned stats determine. That is the whole defect.

  **`speed` is invisible to the instrument as well.** It is absent from the
  wrapper's 28-name `DEFAULT_WATCH_FIELDS`, so no archived trace records it and
  nobody could see it varying. **Do NOT fix that by widening the default** — the
  wrapper's own comment explains why, and it is right: the watch fires per
  assignment, so a newly watched field the game writes during an armed action
  adds mutation lines and DIVERGES EVERY EXISTING GOLDEN. `-WatchFields` already
  EXTENDS the default per session, which is the correct mechanism.

  **What the runbook does and does not stage.** Its `-StageVillain` string
  (`ss2-staging-runbook.md` §3) stages `defence, herolevel, vitality, stamina,
  hitpoints, staminaleft, armourclass, armourclass_max` and the piece ids — and
  neither `speed` nor `strength`. All 11 rufflelogs show the write-time
  `{"t":"dbg","at":"staged"}` line carrying `villain.staminaleft=105` exactly as
  prescribed, and the arming-time readback showing it overwritten. **The operator
  followed the runbook; the runbook under-specifies the opponent.**

  **RETRACTED THE SAME DAY, BY THE AUTHOR, BEFORE ANY FIXTURE WAS EDITED:
  ~~THE DERIVED VALUE IS 110, AND THE ARITHMETIC IS CLOSED~~. 110 IS NO BETTER
  FOUNDED THAN 105.** The 110 derivation assumes the villain took ZERO phases,
  while the same battle has the hero taking FIVE walks. With `stamina 1` the
  villain's net is `1 - staminacost` = -1 per walk, so five villain walks give
  exactly 110-5 = **105 — the value already in the fixture.** Both numbers are
  derivable under different assumptions about an action sequence the scenario
  does not declare, which means NEITHER is determined by it.

  Measured across all 38 armed adc traces before acting: villain `staminaleft`
  is 110 in **2**, is 105 in **1**, and the joint target (hero 105 AND villain
  110) lands in **1** (`session-adc5`). The hero's walk count and the villain's
  stamina deficit are **uncorrelated** — 12 hero walks with a deficit of 8, 5
  hero walks with a deficit of 20. So swapping 105 for 110 would have replaced
  one under-determined constant with another and moved the family from 0/38
  matchable to 1/38.

  **THE HONEST FINDING IS STRONGER THAN THE FIX I NEARLY MADE: `staminaleft`
  cannot be pinned by ANY scenario for an AI-driven combatant on this route.**
  The value is a function of the opponent's own action sequence, and
  `randomise_gladiator` redraws that opponent's `speed` and `strength` every
  round. That is a DESIGN DECISION for the owner, not a fixture edit, and the
  options are: (a) extend `captureAllowedNow` to refuse arming unless the value
  matches, turning a silent near-miss into a visible refusal, then sample; (b)
  choose a villain stat vector whose stamina is invariant — `stamina 2` gives
  regen `1 + round(2/3) = 2`, exactly the minimum walk cost, so walking is
  net-zero and `check_stats` clamps it at `staminamax` 120 — which is a new
  scenario needing every dependent value re-derived, not a correction; or (c)
  stop pinning it, which the head forbids elsewhere and which should stay
  forbidden until (a) and (b) are ruled out.
► **WRONG AS AN ABSOLUTE; THE MECHANISM SENTENCE UNDER IT HOLDS AND MUST BE
  KEPT.** The repository's own corpus falsifies it: the armoured golden pins
  villain `staminaleft 105 / staminamax 110` and hero 105/110 at direction 5,
  `runtimeVerified: true`, `repetitions: 2`, from two independent sessions on
  this exact route. **But the scenario still cannot DERIVE the value** — the
  wrapper STAGES it and the villain's own action sequence then usually destroys
  it, which is what the next sentence says and why it stays. What resolved this
  was option (a) from this same paragraph: sample, and keep only the runs where
  the staged value survived. ► **REFUSE the "5 in 1,171" the sweep proposed.**
  The sweep's own refuter had already broken this row for putting an unmeasured
  ratio into the record; it has now been MEASURED and it is **2 in 1,171**, so
  adopting that sentence would have written a wrong unmeasured number in — the
  exact failure this project exists to prevent. ► **And do not describe option
  (a) as implemented**: the villain-side gate in `captureAllowedNow` checks the
  HERO's stamina and only in champion mode; this route ran `"always"`, so the
  selection was post-hoc through the matcher, not at arming time.


  ► **CORRECTED 2026-09-01 (evening), AND THE FRAMING ABOVE IS THE RANKING
    ERROR: (a) AND (b) ARE NOT ALTERNATIVES — THEY ARE THE SAME PREDICATE.**
    The only villain `staminaleft` a scenario can legally DERIVE from the map is
    `staminamax`, because `initbattle` (`+0x0b9c`) assigns
    `villain.staminaleft = villain.staminamax` unconditionally and the scenario
    declares no villain actions. So (a)'s only legally-founded gate condition is
    `villain.staminaleft == villain.staminamax` — byte-identical in shape to the
    hero predicate the champion branch already computes at wrapper line 2066.
    **(b) is not an alternative to (a); (b) is the only thing that makes (a)
    pass more than twice in 38.** Presenting them as either/or costs (a) its
    success rate and (b) its gate.

  ► **AND `stamina 2` IS WRONG BY AN ORDER OF MAGNITUDE. Byte-verified against
    the licensed SWF by the main session 2026-09-01, not taken from an agent.**
    The arithmetic in (b) is right for a WALK and false for the villain's actual
    action set. `villainChooseAction`
    (`sprite:862[overlay]/frame:52/DoAction@0x23f835`) writes **25 distinct
    labels** into `villaindecisionA`, and they include `chargeright`
    (`+0x0a18`), `chargeleft` (`+0x0d07`) and `jumpleft`/`jumpright` at eight
    sites. Charge costs `Math.round(movement_speed * 2)` — read off the opcodes
    at `+0x4214` (chargeright) and `+0x4480` (chargeleft): push `staminacost`,
    get `game_attacker.movement_speed`, push 2, `Multiply`, `Math.round`. At the
    `movement_speed` clamp FLOOR of 4 that is **8**, against a `stamina 2` regen
    of 2. Net −6, every charge.

    Regen is `1 + Math.round(stamina / 3)`, byte-read at `+0x32c9`–`+0x32fc`
    (the cost subtraction is `+0x32a7`–`+0x32c2`). So invariance to the villain's
    ENTIRE action set requires `1 + round(stamina/3) >= 8`, i.e.
    `stamina >= 19.5`, i.e. **`stamina 20` and `staminamax 300`** — not
    `stamina 2` / `staminamax 120`.

    **A verifier disputed the charge premise and was wrong; the bytes settle
    it.** It argued charge is wired only as a HERO button and that no byte
    evidence places it in the villain's set, which would have made the minimum
    `stamina 8` (no charge) or `stamina 2` (no charge, no jump). Re-derived here
    with `inspect-swf --references 'villaindecisionA'` over the hash-verified
    install (`77cb545c…`, matching the pinned fingerprint): 92 references, and
    charge is in the villain's set at the two offsets above. Record the command,
    not the argument.

  ► **(b) IS ALSO ROUGHLY TEN TIMES CHEAPER THAN THIS BLOCK CLAIMS.** "A new
    scenario needing every dependent value re-derived" is false: across all 8
    fixtures `chance` is 42 and `rollNeeded` 58 (functions of `hero.attack 1` and
    `villain.defence 3` only), `deflectionThreshold` is `(100 − 1.5*helmet) +
    greaves`, and `selectedDamage` comes from the hero's own min/max damage.
    **None of the five reads the villain's stamina vector.** The change is 3
    values per fixture on the villain side plus new PINS for
    speed/strength/charisma/magicka/stamina, and **0 calculations re-derived.**
    Every fixture's purpose survives — the armour-equality quirk is still damage
    22 against armourclass 22, the deflection fixtures still turn on
    helmet/greaves, the removal fixtures still on `helmet_defence`/
    `shoulderguard_defence`.

  *The retracted paragraph is kept below because the arithmetic in it is correct
  and load-bearing; only the conclusion drawn from it was wrong.*

  **The `initbattle` half still holds (2026-09-01).**
  `arena` sprite 2249 frame 1 (`initbattle`), `DoAction@0x6e421b` `+0x0b8a`–
  `+0x0bb6`, assigns `_root.game.villain.staminaleft = _root.game.villain.staminamax`
  UNCONDITIONALLY — the nearby `character_xp` branch at `+0x0b0c` targets the
  first instruction of that write, so both arms execute it. A scenario that
  declares no villain actions therefore determines `staminaleft = staminamax =
  110`, not 105:

  ```
  stamina     = (staminamax - 100) / 10 = 1        // battlevalues +0x37b6
  initbattle  : staminaleft := staminamax = 110
  villain phases declared by the scenario = 0
  staminaleft = min(110, 110 + 0) = 110            // check_stats clamp +0x110a
  ```

  **`obs-adc5` observed exactly that** — villain 110, hero 105 on five walks. So
  one already-archived round matches the corrected villain value, and the
  corrected fixture is not a speculative target.

  **WHERE THE 105 CAME FROM, AND WHY IT IS NOT AN ARBITRARY ERROR.** 53 of the 82
  committed fixtures carry villain `staminaleft == staminamax - 5`, across BOTH
  staminamax values. On the prisoner/probe route that -5 IS derivable: that
  villain has all-zero stats, so `speed 0 -> movement_speed` clamps to 4, walk
  cost `round(4/2) = 2`, `stamina 0 -> regen 1`, net -1 per walk, x5 walks = 95 —
  and it reproduced in 66 of 66 observations, which is why those 22 goldens
  promoted. **The constant was carried from a route where it was derivable to a
  route where it is not.** That is the whole mistake, and it is a much more
  instructive one than a typo.
► **53 of 82 → 54 of 83, and "across BOTH staminamax values" is WRONG.** The
  corpus carries SIX distinct villain `staminamax` values — 100 (59 fixtures),
  110 (11), 130 (1), 140 (1), 150 (10), 160 (1) — and the −5 pattern occurs at
  exactly TWO of them: 44 of 59 at 100, 10 of 11 at 110, zero at the other four.
  **Correct form: "at two of the six staminamax values".** The substantive point
  (105 = 110 − 5) is untouched.


  **The runbook's own rationale is false for exactly one field.**
  `ss2-staging-runbook.md` argues that staging overwrites the generator's draw
  "so the draw stops mattering". True of every staged field EXCEPT `staminaleft`:
  staging runs for `STAGE_APPLY_TICKS = 20` after `_global.battle_started`, the
  autopilot's first action fires at battle tick 8, and arming is later still — and
  `staminaleft` is the sole staged field the villain's OWN turns mutate in that
  gap. Every other staged field is inert across it.

  **The sound remedy is candidate re-derivation, not a capture tweak** — pin the
  villain's full stat vector the way the prisoner family already does, and stage
  it (villain staging is durable; the villain is never re-skinned). NOT ATTEMPTED
  2026-09-01: editing eight candidates is exactly the move this project treats as
  high-stakes, and it should be done against the map with adversarial
  verification, not at the end of a session.

  **Two traps this cost, both worth keeping.** (1) The end-line `staged`
  declaration cannot disagree with the staged state dump — `beginAction` runs
  `stagedAtArming = stagedSummary()` and `dumpSide("state", ...)` as consecutive
  statements over the same objects, so ingest's cross-check is a forgery check on
  hand-edited records, not an overwrite detector. What actually exposed the
  overwrite was the ordinary fixture-vs-observation diff. (2) The main session
  first concluded from the 11 reports that "the villain was never staged to 105"
  and that this was an operator error. Both halves were wrong, and the correction
  came from reading the wrapper rather than from more measurement. **A perfect
  correlation between two numbers is worth checking for a shared source before it
  is worth explaining.**

### Found 2026-08-31, not yet closed

The blocks below are in reverse order of discovery. Read this list first; the
ones that change what the next session should DO are marked ►.

► ~~**THE FIX FOR THE ARMOURED FAMILY ALREADY EXISTS IN THE WRAPPER, BEHIND A
  ONE-LINE BYPASS. It is not a schema change and not a fixture edit.**~~
  **RETRACTED 2026-09-01 (evening) BY MEASUREMENT. Do not act on this item as
  written — it was ranked FIRST in the 15:50 handoff and it is wrong in its
  premise, its mechanism and its cost.** The paragraphs below are kept because
  their byte-level observations are correct; only what was concluded from them
  is not. Established by a VERIFIED question-diverse wave (6/6 investigators,
  18/18 write-nothing verifiers, 0 errors) plus direct re-derivation from the
  licensed SWF by the main session.

  **The four things that refute it, in order of how much they cost to discover:**

  1. **THE GATE IS PROVEN ONLY TO REFUSE, NEVER TO ARM.** Across all four
     champion rufflelogs the branch was evaluated 931 times and emitted
     `action-armed` ZERO times. "Proven on another route" is true only in the
     sense that the answer is "it refuses everything".
  2. **THE GATE'S HERO PREDICATE CONTRADICTS ALL EIGHT FIXTURES.**
     `captureAllowedNow()` requires `hero.staminaleft == hero.staminamax`
     (wrapper line 2066). All 8 target fixtures pin `hero.staminaleft 105` with
     `staminamax 110`. **A session that satisfies the gate can never match a
     fixture, and a session that matches a fixture can never pass the gate.**
     Generalising the branch therefore means REPLACING its stamina predicate,
     and someone must first decide which of the two is the correct scenario.
     Measured on the live data: 0 of 38 armed `adc` rounds had the hero at
     `staminamax`, and in 1091 champion-mode refusals the hero never reached it
     (highest observed 107 of 110).
  3. **A NEW BRANCH THERE WOULD BE DEAD CODE UNDER `validate-vehicle.ps1`.**
     The gate passes no `-Pnavigate`, so `arenaMode` is false and
     `captureAllowedNow()` returns at line 2024 — BEFORE the champion block at
     2026. The gate would go green on a branch that never executed. (What the
     gate DOES reach is the attacker-side guard; see the correction to that
     script's own PASS text below.)
  4. **THE WRAPPER HAS NO CHANNEL THROUGH WHICH A FIXTURE'S SCENARIO CAN
     ARRIVE.** `launch-capture.ps1:278-304` passes `arenaStagedLevel`,
     `stageHero` and `stageVillain` and nothing else. This is a new FlashVar
     plumbed through three files (`ss2-capture-wrapper.as`,
     `launch-capture.ps1`, and `run-arena.ps1`'s `-ArenaCapture` ValidateSet),
     not "a one-line bypass" above an existing branch.
     ► **WRONG, AND THIS FILE ALREADY CONTAINS THE RIGHT NUMBER TWELVE LINES BELOW.**
       There are SEVEN champion rufflelogs across three session directories, not four
       across however many; six declare `"captureMode":"champion"` and the seventh
       dies before any `battle-ready` line. Per-file `capture-refused-unstaged`:
       382, 0, 460, 89, 0, 160, 0 → **1,091 total**. The 931 is 382+460+89+0 — the
       arena-champ-1/2 files only, silently dropping the third session directory —
       **and 1,091 is exactly the figure this same document uses twelve lines down.
       The file states two numbers for one quantity.** The load-bearing half HOLDS:
       `action-armed` is emitted 0 times in all seven. These come from `arenaLog`,
       which does NOT dedupe, so unlike the `attack_chances` figures above they ARE
       genuine event counts — the two families must not be corrected the same way.


  **And the yield it was ranked for does not exist.** A gate keyed on the
  fixtures as written would have armed **0 times in 38** — for every one of the
  8 fixtures, because all 8 pin `staminaleft 105` on BOTH sides and the observed
  joint pair `(105,105)` never occurs (33 distinct pairs in 38 rounds; hero 105
  in 13, villain 105 in 1, both in 0). Re-derived independently three ways.

  **Read that 0/38 narrowly, though — it is not a gate's success rate.**
  ~~All 38 `adc` rounds ran with NO autopilot: `launcher.log` says "Stage the
  scenario yourself, perform the one controlled action". A HUMAN chose the
  arming moment. So 0/38 measures an ungated MANUAL protocol.~~
  ► **FALSE, AND IT IS THE `launcher.log` BANNER THAT MISLED US. Measured
    2026-09-02 from the traces themselves.** Every one of the 38 armed `adc`
    traces records the autopilot DRIVING: `{"t":"dbg","at":"autopilot",
    "step":"walkright","n":1..5,...,"controller":"longrange_warrior",
    "policy":"aggressive"}` then `"step":"normal_attack","n":6`, with 5-14
    autopilot entries per round and the same shape as the `arena-staged`
    sessions. The banner that says "Launching the instrumented session with NO
    autopilot. Stage the scenario yourself" is printed by the launcher and is
    NOT a record of what the wrapper did. **A log line that describes an
    intention is not evidence of a behaviour** — the same lesson as the
    `-WatchFields` docs, from the other direction.
    ► **THE RANGE IS 3 TO 14, NOT 5 TO 14, AND THE QUOTED SHAPE IS NOT UNIVERSAL.**
      Distribution over the 38 armed rounds: 3×1, 4×1, 5×8, 6×2, 7×12, 8×2, 9×7,
      10×3, 11×1, 14×1. One session has four `walkright` entries and **no
      `normal_attack` step at all**; another's is at n:2, another's at n:12 and
      n:13; and `n` restarts, so two `"n":1` entries open every trace. **The literal
      "n:1..5 then normal_attack n:6" shape fits at most 2 of the 38.** The
      load-bearing half HOLDS and is stronger: every one of the 38 records autopilot
      activity, minimum 3 entries, so the launcher's "NO autopilot" banner is
      refuted. This set is CLOSED (nothing added since 2026-09-02), so a number is
      defensible here — unlike the archive-wide rows above.


    So 0/38 measures an AUTOPILOT protocol, and the conclusion drawn from it —
    that the real measurement has never been taken — collapses. It has been
    taken 38 times.
  **The measurement that genuinely has not been taken is narrower: arm on the
  hero's FIRST action of the staged bout rather than after the approach.**
  `initbattle`
  (`+0x0b8a`–`+0x0bb6`) assigns `villain.staminaleft = villain.staminamax`
  unconditionally, so before the villain has taken a phase its value IS
  determined. Every villain turn after that walks it away from the pin.

  **What survives, and it is the useful half:** the armoured family is much
  closer to evidence than the family's 0 goldens suggest. Running the
  repository's OWN matcher over all 38 armed traces (all 38 delogged to scratch;
  27 of them for the first time): **35 of 38 reproduce the target fixture's
  scenario on every pinned, watched field except `staminaleft`**, the only other
  offender being `hero.hitpoints` in 3. And `hero.staminaleft == 110 − (hero
  walk count)` holds **38 of 38**, so the hero side is deterministic and
  operator-controllable; only the villain side is not.

  `captureAllowedNow()` in `ss2-capture-wrapper.as` has a champion branch that
  refuses to arm unless the live hero state matches what the scenario requires
  (`staminaleft == staminamax`, `herolevel == arenaStagedLevel`), emitting
  `capture-refused-unstaged`. **It works and it is proven**: `arena-champ-1` and
  `arena-champ-2` fired it **382 and 460 times** and correctly produced no trace.
  Its own comment states the doctrine better than this file had:

  > *"The wrapper injects only the RNG tape — it stages no combatant state — so
  > there is nothing to force here, only something to refuse. Refusing turns a
  > silent non-match into a visible low success rate, which is the right trade: a
  > session that cannot be evidence should produce no trace rather than a trace
  > nobody can reproduce."*

  Three lines above it: `if (arenaCaptureMode == "always") return true;`.
  **All 38 armed `adc` rounds ran `captureMode: "always"`, and
  `capture-refused-unstaged` appears ZERO times in any of them.** So the armoured
  family spent 38 rounds in the one mode that refuses nothing, and banked 11
  divergence reports against a precondition it never checked.
► **NEVER RIGHT UNDER EITHER READING OF "IT".** The wrapper is byte-identical at
  HEAD to its state at the commit that wrote this sentence, so nothing drifted:
  the `arenaCaptureMode == "always"` early return is ONE line above the champion
  branch and ~29 lines above the quoted comment block. The blockquote itself
  checks out. Locate with `grep -n 'arenaCaptureMode' tools/runtime-capture/ss2-capture-wrapper.as`.


  *(Corrected 2026-09-01 evening: the 15:50 handoff restated this as "with ZERO
  refusals logged", which is false. **Seven refusals ARE logged** — all
  `capture-refused-wrong-side`, in `adc32`, `34`, `35`, `36`, `45`, `47`, `48`.
  What is genuinely zero is `capture-refused-unstaged`, because `always` returns
  true at line 2025 before any scenario check while the attacker-side guard three
  lines earlier still fires. The claim is right about the ARMING gate and wrong as
  literally stated about refusals.)*

  *(Also corrected: all 38 rounds targeted ONE fixture —
  `candidate-armoured-deflection-threshold-cleared`, identified by the injected
  tape, whose seven values match it uniquely. **The other seven of the eight
  blocked fixtures have never had a single capture attempt that could match
  them.** Four of the eight share the staged villain profile and differ only in
  the tape; `equality-quirk` and the three `tournament-*` stage a DIFFERENT
  villain (armourclass 22, helmet 2) that no `adc` round ever staged.)*

  **THE SCENARIO BLOCK IS A PRECONDITION, NOT A STAGED INPUT** — that distinction
  is what the family got wrong. `-StageVillain` is only the MECHANISM that tries
  to make the precondition true; `scenario.villain.staminaleft` is a state the
  capture must actually be IN when it arms. Staging establishes the fields the
  game does not touch afterwards (defence, hitpoints, armour pieces, stamina,
  herolevel, vitality — all durable on the villain). It cannot establish
  `staminaleft`, because the villain's own turns mutate it between the staging
  window and arming. **A field staging cannot hold and the gate does not check is
  a precondition in name only.**

  So the remedy is (c) from the design question, not (d): generalise the champion
  branch to refuse arming unless the live state matches the target fixture's
  scenario on the path-determined fields, and run the armoured family under it
  rather than under `always`. Cost is a wrapper edit — so
  `validate-vehicle.ps1` must PASS afterwards — plus a low per-round success
  rate, which is the trade the comment already argues for and the champion route
  already pays.

  **What this does NOT settle**: how many rounds that then takes. Across the 38
  armed traces the joint precondition (hero 105 AND villain at its pinned value)
  held **0 times** at 105/105 and **once** at 105/110. A gate makes the failures
  visible and the successes trustworthy; it does not make them frequent. Whether
  to also choose a villain stat vector whose stamina is invariant to its own
  walk count — `stamina 2` gives regen 2, exactly the minimum walk cost, so
  walking nets zero and `check_stats` clamps at `staminamax` — is a separate
  scenario-design decision with every dependent value needing re-derivation.

  **A byte-level fact this uncovered, worth keeping**: `staminaleft` CARRIES
  ACROSS BOUTS. `battlevalues` resets it only when it is already `<= 0`, arena
  `initbattle` resets the VILLAIN's only, `restore_char` does not carry it, and
  root frame 214 resets hitpoints alone. Different opponents mean different turn
  counts mean different residual stamina — which is why the champion gate had to
  exist at all.

► **THE WHOLE PROMOTED CORPUS RESTS ON ONE OPPONENT ARCHETYPE, AND `speed` IS AN
  UNPINNED INPUT TO A PINNED OUTPUT IN ALL 82 FIXTURES.** Measured 2026-09-01
  across every candidate and golden:

  - **82 of 82** fixtures pin the villain's `staminaleft`.
  - **0 of 82** pin `speed`, for either combatant.
  - **All 22 promoted goldens share ONE villain profile**: `attack`, `defence`,
    `strength`, `charisma`, `magicka` all **zero**.
    ► **STALE, AND "ALL 23" WOULD BE FALSE.** 22 of the 23 goldens have villain
      attack/defence/strength/charisma/magicka all present and all zero.
      `golden-armoured-deflection-threshold-cleared` breaks it with `defence: 3` and
      the other four **ABSENT — not zero, absent.** Name the subset; do not raise the
      count.

    ► **DENOMINATOR ONLY: 83 of 83 fixtures pin the villain's `staminaleft`; the
      invariant HOLDS.** The paired "0 of 82 pin `speed`" is 0 of 83 and is stronger
      than stated — `grep -rn '"speed"' test/fixtures/` returns NOTHING at all, for
      either combatant, in any fixture.


  `staminacost` for a walk is `round(movement_speed / 2)`, and
  `movement_speed = clamp(round(speed * 1.5), 4, 60)`. For a zero-speed villain
  the CLAMP FLOOR of 4 does the work: any `speed <= 2` gives `movement_speed` 4,
  so the walk costs 2 whatever `speed` actually is, and the unpinned input cannot
  bite. **That is why the prisoner and probe families promoted and nothing else
  ever has** — not because those fixtures are better specified, but because their
  opponent's stat vector makes the missing pin harmless.
► **FALSIFIED AS A UNIVERSAL, AND CORRECTING ONLY THE COUNT WOULD LEAVE THE
  EXPLANATION WRONG.** The armoured family promoted 2026-09-02, so "nothing else
  ever has" is false. But it did NOT promote by the mechanism this sentence
  describes: `golden-armoured-deflection-threshold-cleared` has no all-zero stat
  vector (villain `defence 3`, with `attack`/`strength`/`charisma`/`magicka`
  ABSENT rather than zero) and still pins no `speed`. It promoted because the
  wrapper's `staged` declaration fixed the villain directly and 1,201 unattended
  rounds beat a ~1-in-586 joint precondition. **Scope note: the block this sits
  in is headed "Measured 2026-09-01", so its `82 of 82` / `0 of 82` /
  `All 22 promoted goldens` are dated measurements that were correct then.**
  Today: 83 fixtures, 83 of 83 pin villain `staminaleft`, 0 of 83 pin `speed`,
  and 22 of 23 goldens carry the all-zero villain profile.


  Every other family fights an opponent the build DRAWS: `randomise_gladiator`
  (six call sites, incl. `sprite:1788/frame:69` x3 and `root/frame:214`) redraws
  `speed` and `strength` each round, and the archived traces show villain
  `strength` ranging 1..8. There, `speed` is live, unpinned, and unobserved — it
  is absent from the wrapper's 28-name `DEFAULT_WATCH_FIELDS` too, so no trace
  records it and nobody could see it vary.

  **22 of the 38 unpromoted candidates pin villain `staminaleft` while pinning
  NONE of `speed`/`strength`/`charisma`/`magicka`** — the four stats
  `staminacost` reads. The other 16 (champion 5, spell 8, duel 2, taunt 1) pin
  some of them but still never `speed`.
► **FIRST CLAUSE STALE, SECOND CLAUSE EXACT — DO NOT TOUCH THE SECOND.** 21 of
  the **37** unpromoted candidates, not 22 of 38 (60 candidates less the 23 whose
  stem has a promoted golden). **"The other 16 (champion 5, spell 8, duel 2,
  taunt 1)" reproduces EXACTLY**, and 21 + 16 = 37 closes arithmetically. Only
  the first fraction moves.


  **This reframes the roadmap's "the remaining work is breadth".** It is not
  breadth: 22 goldens covering one opponent archetype is one archetype verified
  many ways. Extending to a second archetype needs the fixtures to pin what the
  first one got away with leaving out — which is a schema question about what a
  scenario must declare, not a capture backlog. **Do not fix this by widening
  `DEFAULT_WATCH_FIELDS`**; the wrapper's own comment explains why, and it is
  right: the watch fires per assignment, so a newly watched field the game writes
  during an armed action adds mutation lines and diverges every existing golden.
  `-WatchFields` already EXTENDS the default per session, which is the mechanism.
► **23 goldens covering TWO opponent archetypes.** "One archetype verified many
  ways" no longer describes the corpus: the armoured golden is defence 3 /
  armourclass 79 / four pieces / four stats absent / `fightMode` tournament.
  ► **Sibling that a digit-grep will miss:** the same defect is spelled in WORDS
  further down this living head as "one archetype twenty-two ways".


► **40 DROPPED LAUNCH NONCES ARE RECOVERABLE FROM THE ARCHIVE, AND DOING IT
  COSTS RE-PROMOTING 20 OF THE 22 GOLDENS.** Measured 2026-09-01 by
  `node tools/recover-launch-nonces.mjs --archive <dir>` — REPORT ONLY, no write
  path, and re-run it rather than trusting these numbers:
  ► **NUMERATOR HOLDS, DENOMINATOR MOVED: 20 of 23.** The tool prints exactly that
    line today. The same stale "20 of 22" repeats in the table just below. This row
    already carries the right correction shape — "re-run it rather than trusting
    these numbers" — so keep the command; note that `--archive` is required by
    design, so the path is not derivable.


  | | count |
  | --- | --- |
  | records whose archived trace carries a nonce the record lacks | **40** |
  | already nonce-bearing (re-ingest is byte-identical) | 9 |
  | genuinely pre-nonce — ingest REFUSES the trace | 18 |
  | pre-nonce waiver, today -> if every recovery landed | **58 -> 18** |
  | **goldens that would need re-promotion** | **20 of 22** |
► **9 → 11 nonce-bearing.** The whole table as measured 2026-09-07: records
  examined **69** (the implicit total 40+11+18, not 67); would-recover 40
  (holds); already nonce-bearing / identical **11** (was 9); genuinely pre-nonce
  / ingest-refused 18 (holds); waiver 58 → 18 (holds); goldens needing
  re-promotion 20 of 23. Cross-checked without the tool: 11 records carry
  `capture.launchNonce`.


  Only `obs-pw10` and `obs-qk8` are cited by nothing and are therefore free.

  **VERIFIED WAVE, and it corrected the main session twice.** `wf_8d57104d-417`
  returned 6 of 6 questions and **209 of 209 verifiers, zero errors** — the first
  wave this session that is not UNVERIFIED-PARTIAL.

  - **THE HEADLINE SURVIVES: zero of 67 records differ in SUBSTANCE.** The union
    of every changed JSON pointer across all 67 is exactly three —
    `/capture/launchNonce`, `/capture/overdraw`, `/digest`. Nothing in
    `scenario`, `samples`, `mutationTrace`, `events`, `resultEvent`,
    `finalState`, `build`, `target` or `observationId` moves. 407 samples, 182
    mutation entries, 189 events and 2,412 `finalState` fields reproduce from the
    traces alone.
  - **"27 reproduce byte-identically" was WRONG — only 17 do.** 27 reproduce with
    zero VALUE difference and an identical digest, but **10 differ in `/scenario`
    key ORDER alone**: committed `[attackerSide, attackDirection, result, hero,
    villain, fightMode]` against today's `[attackerSide, result, hero, villain,
    attackDirection, fightMode]`. The digest is unaffected because
    `computeSs2ObservationDigest` canonicalises with sorted keys. **The churn is
    itself evidence**: today's ingest no longer emits the shape that produced
    those 10, so they were written by an earlier ingest version. They are
    `obs-20260830-auto1/2/3`, `-e1`, `-t1`, `-u1` and `obs-camp1..4` — currently
    correct, gaining nothing, and they would still churn a diff.
  - **The waiver can shrink 58 -> 18 and NEVER to 0.** The 18 traces genuinely
    never recorded a nonce: `obs-20260830-auto1/2/3`, `-e1`, `-t1`, `-u1`,
    `camp1..4`, `pw1..pw8`.
  - **The mis-pairing hazard was real in shape but never fired.** Only two
    archive dirs hold more than one `.jsonl` (`vehicle-check`, `simulated`), and
    they are exactly the dirs `NON_SESSION_CAPTURE_DIRS` already exempts; no
    committed record points at either.
    ► **FIRST AND LAST CLAUSES HOLD; THE SET-EQUALITY CLAUSE IS FALSE.** Exactly two
      archive directories hold more than one `.jsonl` — that half is right. But
      `NON_SESSION_CAPTURE_DIRS` (`test/ss2-divergence-corpus.test.js:121-125`)
      exempts **THREE**: `simulated`, `vehicle-check` AND `wrapper`, and `wrapper/`
      exists in the archive holding exactly one `.jsonl`. **The relation is a proper
      SUBSET, so the word "exactly" is wrong.** "No committed record points at
      either" HOLDS, and is stronger than stated: the same test file ASSERTS at
      `:539-548` that no probe report's `sessionId` collides with the exempt set, so
      it is enforced rather than merely true today.

    ► **ALL FOUR NUMBERS STALE: 421 samples, 184 mutation entries, 191 events, 2,980
      `finalState` fields across the 69 records.** The deltas are exactly the two
      records added 2026-09-02. **State the leaf convention when rewriting** — a
      scalar position, array entries counted individually — because the pairwise
      tool's own leaf counts differ by whether empty containers count, and that
      convention difference is what makes the ranges quoted elsewhere look wrong when
      they are not.

    ► **HEADLINE HOLDS; DENOMINATOR AND POPULATION BOTH NEED SAYING.** Zero of 69
      records differ in substance, and the union of every changed JSON pointer is
      exactly three — `/capture/launchNonce`, `/capture/overdraw`, `/digest`.
      **Precision this sentence loses: 18 of the 69 are ingest-refused and produce no
      diff at all**, so the union is measured over 51 comparable records, of which 40
      changed and 11 were byte-identical. "Across all 69" overstates the population.


  **The reason this is not obviously worth doing.** A verifier this session
  resealed `obs-par1`'s digest with (a) its true nonce, (b) a FABRICATED nonce,
  (c) a nonce STOLEN from `obs-pq1` and (d) no nonce at all. **All four matched
  with zero differences and passed `validateSs2Observation`**, because
  `SS2_PAIRWISE_EXCLUDED_KEYS` excludes `capture` wholesale and the matcher never
  reads it. So nothing downstream can tell a recovered nonce from an invented one,
  and the only assurance available is that the operation REPRODUCES against the
  archive — which is what the tool is shaped to give and why it prints its own
  resolution rule and archive path.

  **Two traps the tool encodes, both of which silently produce a wrong answer.**
  Resolve a record to its trace by the record's OWN `capture.sessionId` +
  `observationId`, NEVER by file name — three records are named after a different
  id than they carry. And carry `installHashVerifiedAfter` FORWARD from the
  committed record rather than asserting it fresh: a re-ingest today measures
  nothing about a session that ran days ago, and asserting it would be exactly the
  quiet conversion of measured evidence into asserted data this project exists to
  refuse.

► **THE FRESH-NONCE RESIDUAL IS WORSE THAN RECORDED: it also unlocks the
  authored-from gate, and all four self-citing goldens are re-promotable from
  the very records they were transcribed from.** Found 2026-08-31 by an
  adversarial pass driving the real promotion entry point, then reproduced
  independently by the main session: 4 of 4.

  The gate compares `observation.observationId` to
  `candidate.provenance.authoredFrom` as a **string**, and `observationId` is
  both invisible to the matcher and excluded from the pairwise projection. So
  renaming the authored-from record walks straight past it.

  **The rename alone is NOT enough, and the composition is the finding.** A
  rename re-digests, which drops the record out of the pre-nonce digest waiver,
  and the nonce check refuses it — verified, 4 of 4 refused. Mint a fresh nonce
  as well and all four PROMOTE. So this is the already-known "forger who mints a
  fresh nonce" residual, which turns out to unlock a second gate nobody had
  connected it to. It is not a separate hole to close; it is a reason the nonce
  residual outranks its current billing as "smaller than what it replaced".

  **The re-promotion this bullet pointed at is DONE (2026-08-31), and the
  advice in it was only half achievable.** The four were re-promoted from
  independent evidence, and 9 nonce-bearing records are now cited — but
  "genuinely independent NONCE-BEARING evidence" was not available for all of
  them: `golden-prisoner-normal-kill` rests on three records of which ONE
  carries a nonce, so it has zero comparable nonce pairs and its independence is
  still two operator-chosen strings plus the blanket pre-nonce waiver. The
  assertion this bullet described no longer exists; see "What the re-promotion
  did and did not establish" below for what replaced it and why deleting it as
  its own comment prescribed would have been a mistake.

► **`capture.observedAt` is free end to end, and nothing anywhere checks it.**
  Its only consumer on the promotion path is the stamp that writes the golden's
  `provenance.observedAt`. There is no ordering, recency or plausibility check,
  so a promoted golden's stated observation date is an unverified operator
  string. Low severity on its own; listed because "when the evidence was taken"
  is provenance, and every other provenance field here is checked.

- ~~**The promotion gate never compared the two observations to each other.** Now
  it does, and the gate is DORMANT by measurement (0 of 162 leaves can differ
  while both still match).~~ **CLOSED 2026-08-31 by measurement. Both bullets
  struck through here were wrong, in opposite directions.** The gate is NOT
  dormant, and "162" was never unreproducible. See § "The pairwise gate: what
  the 2026-08-31 measurement settled" below, and run
  `node tools/pairwise-gate-dormancy.mjs`.
- ~~**The "162 leaves" dormancy measurement does not reproduce, and neither does
  its correction.** No record carries 162 under either, so "162" is not a
  full-record count.~~ **The RANGES in this bullet are right — full-record
  101-184, matcher projection 86-157, both reproduced exactly — and the
  CONCLUSION drawn from them is wrong.** 162 is full-record leaves *minus the
  digest*, which any probe must rewrite; obs-qk1 and ten siblings carry exactly
  that, and 142 is that same family's matcher projection. Both disputed numbers
  name one record family. This is the third time this measurement was re-argued
  from memory, which is why it is now a committed tool.

► **A candidate was fitted to an observation, and it predates this session.**
  `staminaleft` 105 was transcribed after the map predicted 110. The same hero
  block may have carried it into other fixtures — **audit the corpus before
  trusting any staged scalar.**
► ~~**The champion family cannot be captured at all** (hero `attack`/`defence` 3
  is unreachable; `hitpointsmax` 250 and `staminamax` 150 likewise). Five
  fixtures join the fifteen impossible-hero ones. Re-derive from the map.~~
  **RETRACTED 2026-08-31 (`2d0b077`), and this copy was missed at the time.**
  Every clause is false — `attack` and `defence` are ordinary level-up stats,
  `L=11, vitality 7` gives `hitpointsmax` 250, and `stamina` is button 2254.
  The family is reachable at `herolevel 11`. Run
  `node tools/stat-vector-reachability.mjs`; the full retraction is at
  § "Next steps, in order" item 1.
  **This is the second copy of one instruction, and the retraction that fixed
  the first one is the one that teaches "retract AT THE INSTRUCTION, not only
  above it."** It reached the next-steps entry and not this one. See the
  standing rule at the top of this file.
► **All eight reachable fixtures over-pin `staminaleft`**, which nothing in the
  ATTACK-RESOLUTION chain reads. ~~Fixing it needs a matcher change.~~
  **CORRECTED 2026-08-31: that is the prescription § "READ THIS FIRST" calls
  DEAD, and this line was still stating it as the plan. Read that block before
  doing anything here.** The sound path recorded there is to fix the CAPTURE —
  pin the approach-step count so the value is deterministic — not the
  comparison. Two scopes were also being conflated, which is why this line and
  that block read as contradicting each other when they do not: `staminaleft` is
  read by nothing in the attack-resolution chain (inventoried by offset in
  § "The pairwise gate…" below), and it is NOT inert in the build at large — it
  gates which attack buttons exist, forces the rest phase, and steers the villain
  AI. Both are true; only the first licenses anything. **The sequencing
  advice that stood here — "which needs the dormant gate above landed first" —
  is superseded.** The gate is landed and has teeth, but on nonce-free evidence
  it is unreachable, so it backstops an exclusion for exactly nothing today.
  Whoever lands the exclusion cannot lean on it and must bring the adversarial
  pass named in § "The prescribed fix" below.
► **The stub is far weaker than the gate implies** — 7 of 15 hook slots have
  never wrapped in any gate run; `attack_chances`, the production arming point,
  is exercised 0 times there and ~209 times live.
- The wrong-side guard read an object the game never writes and was dead on
  every route. Fixed, and proved to fire in both directions. *(Closed.)*
- `scenario.attackerSide` is compared against the fixture's own declaration —
  a self-comparison — and the wrapper's real observation of who swung is
  discarded before ingest.
- The 81 divergence-report digests are unverified, and the obvious repair is
  itself an assertion that cannot fail.
- Hook attribution forgery. ~~*(Closed this session.)*~~ **NOT CLOSED —
  corrected 2026-08-31. This bare line was the only place claiming it was**, and
  two fuller statements disagree: § "Still open, with the evidence below the
  archive line" calls it "a third working forgery against the promotion gate,
  and it is open", and § "The pairwise gate…" says that gate "does not close the
  hook-attribution hole and must not be described as closing it". What was
  closed that session was narrower — the matcher now TRANSLATES `reason` rather
  than stripping it. Two records agreeing on the same false attribution still
  promote.
  ► **81 → 86 divergence reports, and the "unverified" half HOLDS PROVABLY.** Each
    carries the digest under key `observationDigest`, never `digest`.
    `test/ss2-divergence-corpus.test.js:355-359` DOES assert
    `record.digest === report.observationDigest`, but only inside a
    `fixtureId` match, and the same test asserts that match count is 0 with the
    comment "which is why the digest equality above has never once executed
    against the committed corpus". ► **Duplicate stale 81 further down this living
    head, under "Still open".**

  ► **FIRST HALF HOLDS EXACTLY; SECOND HALF IS THE SAME CATEGORY ERROR AS ABOVE.**
    "7 of 15 hook slots have never wrapped in any gate run" re-derives: `hookSlots`
    is 14 `registerSlot` + 1 `registerNativeSlot("gotoAndPlay")` = 15, the
    vehicle-check runs emit exactly 8 distinct `wrapped:` names, and no rufflelog
    anywhere carries more than one `wrapped:randomBetween`, so 7 slots never wrap
    — attack_chances, check_spells, destroy_armour, magic_damage_character,
    nextphase, remove_armour, and the second randomBetween slot. "0 times there"
    HOLDS. **"~209 times live" is a trace count, not an event count** (see the
    `dbg()` correction above); the `wrapped:` and `called:` file sets are
    identical. Give the command, not a number.

  ► **POINTER BROKEN — quote the target, do not renumber it.** § "Next steps, in
    order" contains TWO numbered lists, and "item 1" now selects the wrong one: a
    reader lands on "CAPTURE AN ARMOURED FIXTURE", which is itself the stale
    instruction corrected above, so the two failures compound. The champion
    retraction is intact and unambiguous — find it with
    `grep -n 'champion' HANDOFF.md` inside that section, or search for its own
    opening words. It is the first item of the SECOND list.


Three claims I recorded during the session were wrong and are corrected in
place: that the wrong-side defect was arena-specific; that `if (attacker ==
undefined) return false` was the fix; and that 105 was arithmetically
unreachable. Each correction sits with the block it belongs to.

**Correction to my own entry above, and the transcription charge is CONFIRMED
while my reasoning for it was wrong.**

I wrote that "105 is arithmetically unreachable from the fixture's own inputs"
and that two combatants sharing a non-derivable number was "the signature of a
transcribed observation". The conclusion is right and the premise is false: 105
IS arithmetically reachable, and the live data fixes the step size. Do not repeat
the unreachability argument.

The transcription is established by the repository's own record, not by
inference. The eight fixtures were created de novo in `6fd3884`
(2026-08-30 19:52), and their hero block is byte-identical to
`candidate-prisoner-normal-kill`'s except `hitpoints` 30 → 300. The decisive
artifact is committed:
`test/fixtures/ss2-1v1-divergences/provisional-prisoner-kill--obs-20260830-t1-6bf4f120.json`
records `/scenario/hero/staminaleft` **expected 110, actual 105**. The
map-derived prediction was 110 — a fresh bout at full stamina — the runtime
returned 105, and the fixture was re-authored to the runtime's number. The
authoring commit says so in the test it added: *"the one staged number that is a
function of the autopilot step count rather than of a formula"*, *"exactly as
observed in the promoted prisoner sessions"*. The "five walks from 110"
derivation the documents now carry first appears three hours AFTER the fixtures.

So this is a candidate fitted to an observation, it predates this session, and
the same hero block may have carried it into other fixtures. **Check the rest of
the corpus before trusting any staged scalar.**

### The pairwise gate: what the 2026-08-31 measurement settled

`promoteSs2CandidateToGolden` matched every observation against the candidate and
never against the other observation — so "two matching observations from two
independent sessions" has always meant two records that each resembled the same
prediction, never two that resembled each other. `ss2ObservationsMatch` existed,
was exercised by tests, and was never called from the promotion path.

That gate is now called, and **its dormancy is settled by a committed tool rather
than by a sentence: `node tools/pairwise-gate-dormancy.mjs`.** It takes a minute.
Three independent implementations agreed on every number below, and an
adversarial pass drove the real promotion entry point rather than the functions.
Do not quote these figures without re-running it — this measurement has now been
re-argued from memory three times and retracted twice.

**The gate HAS TEETH.** 751 of 11,121 single-leaf perturbations across the 67
records are free — valid, re-digested, still matching their candidate — and
**407 of them, every one at `/samples/*/callSite`, this gate alone refuses.**
The free count is exact, not a lower bound: a leaf the matcher compares cannot
be free, since every record matches its fixture at baseline.
► **ALL THREE NUMBERS STALE, VERDICT UNCHANGED: 777 of 11,403 single-leaf
  perturbations across 69 records are free; 421 of them, every one at
  `/samples/*/callSite`, the gate alone refuses.** Classification today:
  refused-by-validation 2,963 + caught-by-matcher 7,663 + free-caught-by-gate 421
  + free-caught-by-nothing 356. **The ranges quoted a few paragraphs above
  (full-record 101–184, matcher projection 86–157) still reproduce EXACTLY and
  need no change** — but only under the counting-empty-containers convention; the
  other convention gives 100–184 and 85–157. Live/tool kind: the correction is
  the command, `node tools/pairwise-gate-dormancy.mjs --json`.


**And on committed evidence it refuses nothing, for a reason nobody had looked
at.** ~~Zero of the observation ids the 22 goldens cite carries a `launchNonce`~~
— **FALSE since the 2026-08-31 re-promotion; corrected 2026-09-01 by
re-derivation.** All **9** nonce-bearing records ARE cited, across **4** goldens:
`dir5` (`obs-cachecold`+`obs-cachewarm`), `dir6` (`obs-par2`+`obs-par3`+`obs-pq1`
+`obs-pq2`), `dir8` (`obs-iso2`+`obs-par1`) and `golden-prisoner-normal-kill`
(`obs-pq3`). The other 18 goldens cite none. The rest of the sentence still
holds for those 18: each cited record is waived only by its exact digest in
`pre-nonce-observations.js`, and every forgery re-digests and so leaves the
waiver. The **nonce check** refuses those 18 goldens' forgeries about forty lines
before the pairwise loop runs. ~~It fires only on nonce-bearing evidence, of
which three promotable groups exist (`obs-cachecold`+`obs-cachewarm`,
`obs-iso2`+`obs-par1`, `obs-par2`+`obs-par3`) and no golden cites any.~~ **Also
false, and it names the three groups that ARE cited — they are exactly `dir5`,
`dir8` and `dir6` above.**
► **9 → 11 records, 4 → 5 goldens — AND "THE OTHER 18" NEEDS NO CHANGE. FLAG
  THAT LOUDLY.** All 11 nonce-bearing records are cited, across 5 goldens; the
  four named groups reproduce with the same record lists, and the fifth is
  `golden-armoured-deflection-threshold-cleared`, **the first golden whose
  evidence is entirely nonce-bearing**. Numerator and denominator both moved by
  one, so 23 − 5 = 18 exactly as 22 − 4 = 18 did: **a blanket edit of that 18
  would break a correct sentence.** The sweep did not flag this. Siblings still
  carrying the stale 9 are elsewhere in this living head.


**This paragraph contradicted line ~715 of this same file**, which has carried
the corrected "9 nonce-bearing records are now cited" since the re-promotion
landed. The 2026-08-31-2244 handoff says the correction was written "in the
gate's own comment, in `pairwise-gate-dormancy.mjs`, `docs/roadmap.md` and
`ss2-runtime-capture.md`" — four places, none of them here. **That is the
retract-at-the-instruction rule failing on the exact file that states it, for
the third time.** Found by an adversarial verifier aimed at a different claim
entirely, then re-derived directly: 4 goldens, 9 citations, 0 disagreement.
► **POINTER BROKEN, AND ITS TARGET IS NOW STALE TOO — do not repoint it, rewrite
  it.** "~line 715" was accurate when written (`4610132`, 2026-09-01: the text
  really was at line 716 of that revision); the file has since grown ~1,870
  lines under it. Worse, the sentence it points AT is wrong today: measured
  2026-09-07 over the corpus, **69 observation records, 11 nonce-bearing, cited
  by 5 goldens** — not "9 across 4". Repointing would hand the reader a number
  wrong by two. This is why an intra-file line pointer is never the right
  citation here.


**So the old "DORMANT TODAY" comment was wrong about the function and
accidentally right about the corpus.** Both halves are now pinned by tests in
`capture-campaign.test.js`, and both were demonstrated to fail when broken.

**Read the teeth narrowly.** All 407 committed samples carry ONE `callSite`
literal, because the wrapper has one roll emitter stamping one compile-time
constant — the same fact that makes a fixture-derived `callSite` comparison
something this file already refuses to add. These teeth cannot bite two honest
captures. **And the gate catches disagreement, never falsehood: two records
carrying the SAME fabricated `callSite` agree, match, and promote.** It does not
close the hook-attribution hole and must not be described as closing it — the
same structural reason a pairwise comparison could never have caught the copied
record, which had to go through the nonce instead.
► **407 → 421 committed samples; the load-bearing half is untouched** — every one
  carries `callSite`, and there is exactly ONE distinct literal, so the teeth
  still cannot bite two honest captures. ► **AND THE SAME STALE COUNTS ARE IN
  COMMITTED SOURCE, NOT ONLY IN THIS FILE.** `tools/pairwise-gate-dormancy.mjs`'s
  `doesNotProve` strings say "All 407 committed samples", "NINE of them
  nonce-bearing across four goldens", "the goldens now cite 60 distinct records",
  "all 67 records", "all 47 cited slots". Measured today: 421 · 11 · 5 goldens ·
  62 distinct cited records · 69 records. **A doc-only fix leaves the tool
  contradicting its own JSON output.**


It becomes load-bearing the moment any field stops being compared. With the
prescribed `staminaleft` exclusion patched in, an auditor promoted two records
differing by 99,992 stamina — one negative, one 10^13 above `staminamax`. That is
the debris forgery's second symptom exactly.

**Land any field exclusion only after this, never before — but the old reason
for that rule is dead.** It used to read as "the gate is a dormant precondition
that starts protecting the corpus once an exclusion lands." It will not: on
nonce-free evidence the gate is unreachable, so an exclusion landed today is
backstopped here by nothing. Free to keep, re-measured: all 29 cited observation
pairs across the 22 goldens agree under it, so it refuses no promotion that
already stands.
► **29 → 81 cited observation pairs, across 23 goldens, all agreeing, none
  unresolved; the substance HOLDS.** Re-derived independently of the tool as
  Σ C(n,2) over each golden's `provenance.observationIds` (23 goldens, 62
  distinct cited records, no record cited twice), and the tool's own `citedPairs`
  block returns the identical numbers. "It refuses no promotion that already
  stands" HOLDS. Worth a sentence rather than a number: the tool also reports
  `citedIdsNotResolvableByFileName: 1` — three records are filed under names
  other than the id they carry.


**ANSWERED FROM THE MAP, BLIND TO THE CAPTURES.** `staminaleft` is read by
**nothing** in the attack-resolution chain, and the pinned 105 is not derivable
from the fixtures' own inputs. The analysis was done by an agent forbidden from
opening `captures/`, the divergence reports, this file, or the staging runbook,
so its warrant is independent of anything the runs recorded.

Complete reference inventory — 42 `staminaleft` sites, 24 `staminamax`, every one
attributed by offset:

- `checkattackroll` (overlay `+0x2c30`–`+0x3192`): **zero** stamina references.
- `attack_chances`: **zero**. Reads `attack`, `defence`, `charisma`, `magicka`,
  `shield` only.
- Deflection (`+0x3030`–`+0x3095`): reads `helmet` and `greaves` only.
- `remove_armour` / `destroy_armour`: **zero**.
- `damagecharacter`: one touch, and it is a **write** —
  `game_defender.staminaleft += ceil(breastplate * damage / 100)` at `+0x1928`.
  Nothing downstream consumes it; the defeat gate reads `hitpoints`.
- `check_stats`: reads `staminamax` only to clamp `staminaleft`. Self-referential.

**It is path-determined, not scenario-determined.** In `normal_attack` the cost is
*set* at `+0x61a3`, `attack_direction` drawn at `+0x61f1`, `checkattackroll()` at
`+0x62ad`, and `staminaleft -= staminacost` only later in `nextphase` (`+0x32a7`).
So the value at the roll reflects history *before* the attack. Each prior turn
nets `-staminacost + (1 + round(stamina/3))`, and a walk costs
`round(movement_speed/2)` where `movement_speed = clamp(round(speed*1.5), 4, 60)`.
**The fixtures state neither `stamina` nor `speed` for either combatant.**

**And 105 is arithmetically unreachable from the fixture.** `staminamax = 100 +
stamina*10`, so 110 implies base `stamina` 1 and per-turn regen 1. A fresh bout
starts full at 110. Reaching 105 needs exactly one prior turn at net −5, i.e. one
walk at `movement_speed` 11–12, i.e. `speed` 7 or 8 — which the scenario does not
state. With the stated `strength: 10` a prior *attack* would have cost 20 and
landed on 91. The same 105/110 is pinned for the villain, whose block states no
`strength` and no `speed` at all. **Two independent combatants landing on the same
non-derivable number is the signature of a transcribed observation, not a
derivation** — which, if so, means this predates the session and is the exact
discipline failure the pipeline exists to prevent.

`staminamax: 110` is separately over-specified: `battlevalues` recomputes it
unconditionally from base `stamina` at `+0x37b6`, and `nextphase` runs
`battlevalues` for both combatants at every phase transition, so a staged
`staminamax` cannot survive one turn.

**And `expected.state.<side>.staminaleft` carries zero information today.** The
capture window deliberately closes before `nextphase`
(`ss2-capture-wrapper.as:2456-2459`), so `finalState.staminaleft` = staged value +
`staminaBonus`; with `breastplate: 0` in all five armoured fixtures,
`staminaBonus` is 0 and the field is a pure echo of the scenario value. The pin
costs six exact-equality constraints per fixture, none related to deflection
thresholds, armour removal, or the equality quirk these fixtures exist to test.

### What the re-promotion did and did not establish

Landed 2026-08-31. All four self-citing normal-band goldens were re-promoted
through `campaign.mjs settle`, from every other committed record that matches
them. **Read the limits before quoting this as an independence result** — a
write-nothing verifier aimed at exactly that claim returned BROKEN, and it was
right.

WHAT IS TRUE. Each golden has stopped citing the record its own candidate was
transcribed from, so each now rests only on records that COULD have refuted it.
Evidence went 2 -> 3, 2 -> 5, 2 -> 9 and 2 -> 4 records. Nine nonce-bearing
records are cited where zero were before, and the pairwise gate is now
REACHABLE from committed evidence for the first time. Scenario, samples and
expected are byte-identical: this changed provenance, not measurement.

**PARTLY ANSWERED FROM THE RAW TRACES 2026-08-31, and NOT re-derived here.**
The paragraph below said this question could not be settled from a WSL clone.
That is still true of THIS tree, but the Windows session ran it: a six-agent
probe over the raw `rufflelog` archive in `C:\ss2-capture\captures`, four probes
INDEPENDENT and both adversarial verifiers BROKEN. **Treat every figure in this
paragraph as unverified here — no one on this side has re-derived them~~, and the
archive is not reachable from Linux~~.** *(Struck 2026-09-01 evening: the archive
IS reachable from Linux at `/mnt/c/ss2-capture/captures`; see the correction in
§ "What to read, and what you may skip". The figures below are still unverified
here, but they are now CHECKABLE from this side — nothing stops the next WSL
session re-deriving them.)* What it reports: a 197-sample microsecond
timestamp series inside each log, 194-195 of 196 inter-line deltas differing,
RMS divergence 3.5-31.3 ms, chi-squared on microsecond last digits uniform
across all 25 logs (so not synthetically generated), frame cadence tracking the
declared fps across six independent 30 fps runs sharing no microsecond, and
obs-par1/2/3 starting within 14 µs of one another — GPU contention that a copy
does not produce. **A naive copy preserves in-file timestamps exactly, which is
what the probes tested for and did not find.**

One conflation to avoid, because a verifier made it: FILE metadata (mtime,
birthtime) was demonstrated forgeable in a second, unprivileged. That refutes
the mtime corroboration and NOT the in-file series, which is a different
artifact. Also destroyed, and it is worth knowing the evidence is gone: the
relocation in `c85b2ac` rewrote every file into `C:\ss2-capture` and reset NTFS
ChangeTime — the one field `SetFileTime` cannot write — so ctime can never
corroborate any of this again. Three copies of the archive exist (the live tree,
the retired OneDrive tree, and D:), each 1,589 files.

So the independence of these records now rests on ONE strong class of evidence
that this repository does not contain. That is better than nothing and worse
than a check, and it lives outside the pipeline entirely.

WHAT IS NOT. **The corpus cannot distinguish an honest repeat from a copy, and
this change does not alter that.** Measured with the project's own
`canonicalJsonStringify`: for each of the four candidates, EVERY matching
record — the refused source record included — collapses to ONE content group
once `observationId`, `digest`, `capture.sessionId`, `capture.observedAt` and
the attestation keys are stripped. `obs-camp3` differs from `obs-20260830-t1`
in exactly four leaves, and from `obs-fr1` in the same four. That is what a
deterministic outcome recorded twice looks like AND what a copy looks like;
nothing in the normalized record separates them. The one artifact that could —
the raw trace — is in `captures/`, which is gitignored and Windows-side, so
~~**this question is not adjudicable from a WSL clone at all.**~~
**CORRECTED 2026-09-01 (evening): it is adjudicable from this machine.** The
gitignored archive is readable from WSL at `/mnt/c/ss2-capture/captures`, so the
raw traces this paragraph calls out of reach can be opened, delogged and matched
without leaving Linux — this session delogged all 38 armed `adc` traces and ran
the repository's own matcher over them. What remains true is the narrower claim
the paragraph opens with: **the NORMALIZED record cannot separate an honest
repeat from a copy.** That is a property of the record, not of the operating
system, and this correction does not touch it.

Read the per-golden strength honestly. `golden-prisoner-normal-kill-dir6` is
the strong one: 9 records, 4 nonces, two separate launcher invocations, a
3h49m span. `golden-prisoner-normal-kill` is the weak one: 3 records, ONE
nonce, so zero comparable nonce pairs, and the other two are four-leaf twins of
the record the gate just refused.

**THE GATE COUNTS SESSIONS AND CANNOT SEE THAT TWO SESSIONS DIFFER IN THE
STRENGTH OF THEIR EVIDENCE.** Eight records carrying no launch token satisfy
"two independent sessions" exactly as well as eight carrying one. That is the
structural version of everything above, it is not fixed by this change, and it
is the reason the nonce residual outranks its billing. Found by the Windows
session's trace pass, 2026-08-31.

An ingest defect fell out of the same pass and is NOT verified here, because it
needs the raw archive: **`obs-fr1` is reported to carry a `launchNonce` in its
RAW trace that the ingest path never propagated to the committed record.** If
that holds, re-ingesting supplies a nonce with no new capture — and it also
means ingest can silently drop the one identity the operator does not choose.
`obs-fr1` is cited by `golden-prisoner-normal-kill`, the weakest of the four, so
this is the cheapest available strengthening. Confirm it against the archive on
the Windows tree before acting.

Two caveats a future reader should not have to rediscover:

- **`provenance.observedAt` gets LESS informative as evidence grows.** It is
  the max of the cited records' `capture.observedAt` (and that field is stamped
  by the launcher BEFORE Ruffle starts, so it is not when anything was
  observed). dir6's now summarises a 3h49m span in one scalar, with no span
  field anywhere on the golden.
- **`repetitions` counts RECORDS, not occasions.** dir6's 9 records come from 7
  wall-clock occasions: `obs-par2`/`obs-par3` share a timestamp and
  `obs-pq1`/`obs-pq2` share another, being concurrent arms of one
  `run-campaign.ps1 -Concurrency 3`. They carry distinct minted nonces, so they
  are distinct player launches; they are not distinct sittings.

**HOW THIS SECTION CAME TO BE WRITTEN, because it bears on how far to trust it.**
Two sessions ran in parallel on 2026-08-31 and BOTH stretched past their remit
without noticing at the time. The Windows session was scoped to migration setup
and ran an adversarial raw-trace investigation of the corpus; this session was
scoped to the re-promotion and edited this head five times, the last two
reactively in response to cross-session messages rather than as planned work.
Neither is wrong in what it produced — the trace pass answered a question
nothing else could, and the corrections here were real contradictions — but a
reader assessing this file should know that a large share of it was written in
one night, partly reactively, by two agents correcting each other. "Only this
machine holds the data" is not the same as "this session should run it", and
that distinction is the one both of us missed.

**One execution-surface fact, because it is easy to collapse.**
`.claude/workflows/question-fanout-audit.js` is still UNEXERCISED as a file: the
question-fanout SHAPE ran on 2026-08-31 — six question-diverse investigators,
six write-nothing verifiers on one named claim each, 12 briefed and 12 returned,
five BROKEN verdicts that changed the work — but the script was authored inline
and the committed file has never been invoked. The technique is validated; the
FILE's own correctness is not. Provisioned is not exercised, which is the same
distinction that once left three of four workflow components installed and
never fired.
► **FALSE SINCE 2026-09-01 — the committed file HAS been invoked, repeatedly.**
  `a9e690e` (2026-09-01) says in its own commit message that it was run for the
  first time that session and names the defect that run exposed, and a later
  2026-09-02 commit records another. **It was invoked again on 2026-09-07 for the
  wave that produced these very corrections**, with `started == returned` on both
  phases (6/6 questions, 6/6 verifiers).


Three defects were found by the verifiers and fixed in the same commit, each of
which would have made this change a net loss:

- **`settle` wrote the capture manifest BEFORE asking the gate**, and never
  rolled it back. A refused run therefore deposited a session-independence
  attestation for evidence the repository had just refused — and `git checkout
  -- .` does not remove an untracked file, so the wreckage survived the obvious
  cleanup with the suite fully green over it. It now promotes first and writes
  second.
- **Nothing walked manifest -> golden.** 26 manifests against 22 goldens passed
  the whole suite. `test/capture-campaign.test.js` now asserts every committed
  manifest is cited by a golden, and the four attesting the retired pairs were
  deleted with the promotions that cited them.
- **The self-citation test's own comment prescribed deleting it, and that was
  wrong.** Deleting it leaves `goldenPartition.eligible` as a silent filter in
  front of the reproduction loop: measured, re-planting a self-citing golden
  REMOVED a failure — nine with the plant, ten without, none naming it. The
  partition is gone instead, so the reproduction loop runs the gate over all 22
  goldens and a self-citing one fails by name.

**`captureManifestSha256` is a fact about when `settle` ran, not about the
evidence.** `buildSs2CaptureManifest` defaults `createdAt` to the wall clock and
the driver passes nothing, so two settle runs over identical records produce
different goldens. This is how all 22 committed manifests were made and was NOT
changed here; reproducibility runs through the committed manifest file, which
carries its own `createdAt`. Worth fixing, deliberately, as its own change.
► **22 → 23 committed manifests; the MECHANISM reproduces verbatim** —
  `tools/runtime-capture/build-manifest.mjs:157` is
  `createdAt: createdAt ?? new Date().toISOString()` and
  `tools/runtime-capture/campaign.mjs:1279` passes no `createdAt`. The escape
  hatch holds too: all 23 goldens' cited `captureManifestSha256` reproduce when
  the committed manifest's own `createdAt` is fed back in. ► **DO NOT SUBSTITUTE
  in the nearby sentence "26 manifests against 22 goldens passed the whole
  suite": that is a HISTORICAL description of a defect predating the fix — 22 was
  right then, and 23 would falsify it.**


### DECIDED 2026-09-01 (evening): two questions this file kept re-asking

Both were put to the owner, who delegated them. **Recorded as decisions with
their reasons so they stop consuming a session each time they surface** — which
is the documented pathology here: a true observation that gets re-ranked every
session and never acted on.

► **THE SCHEMA QUESTION IS DEFERRED, NOT OPEN. Do not re-litigate it without
  the trigger below.** Should `COMBATANT_KEYS` admit the derived stats
  (`stamina`, `speed`, `vitality`, `herolevel`) and inventory, so a scenario can
  declare what the game derives from? **Not now**, for three reasons:

  1. **It is not on the path to a playable mod.** It pays off only for verifying
     a SECOND opponent archetype to golden standard. The corpus already covers
     one archetype twenty-two ways and feeds nothing; use beats breadth until
     something consumes it.
  2. **The remedy may not work even with the schema change.** Byte-verified this
     session: `cast_swiftsandals` writes `speed = 10 + backup_speed*2`,
     `cast_colossus` `strength = backup_strength*3`, `cast_bloodlust`
     `+ round(backup_strength*1.5)`. All three are villain-selectable through
     `villain_cast_spells`, and they inflate the COST side of the stamina
     inequality while regeneration stays fixed. **No stat vector chosen before a
     fight is invariant during it** unless the villain is also sent in empty —
     which needs inventory declared too, i.e. a second schema addition and a
     staging question on top.
  3. **Better information is about to arrive.** Once `ss2-rules.js` exists and
     fights are played, which parity actually MATTERS becomes an observation
     rather than a guess. Deciding the schema first spends the decision before
     the evidence.
     ► **THE DEFERRAL'S PREMISE EXPIRED SIX DAYS AGO.** Reason 3 was "Once
       `ss2-rules.js` exists and fights are played". `src/team/ss2-rules.js` was
       added by `831bcdc` (2026-09-01 22:58), is **1,794 lines**, and was edited five
       times on 2026-09-07; `tools/hotseat.mjs:58` imports it and `d7ff634` is titled
       "Let a person's gladiator fight under SS2's own rules". **Reason 1 is
       falsified too** — the corpus no longer "covers one archetype twenty-two ways
       and feeds nothing"; it covers two archetypes 23 ways and feeds `ss2-rules.js`,
       the hotseat and the campaign circuit. Only reason 2 survives untouched.
       Whether the reopen trigger has FIRED is not determinable from the tree.
       ► **And the recommendation below has silently flipped without anyone
       noticing**: it reads "(b) until `ss2-rules.js` lands, then (a)", and it has
       landed — so this file now recommends (a), merge wholesale. **That is an
       owner's decision and it should be made deliberately, not inherited from an
       expired conditional.** The branch figures beside it are stale by the usual
       mechanism; measure with `git rev-list --count main..HEAD` and
       `git diff --shortstat main...HEAD`, never with a fourth written number.


  **The trigger to reopen it:** a played fight shows behaviour that needs the
  second archetype, OR someone states a concrete reason to need it at golden
  standard. Absent either, this is closed.

► **NO 98-COMMIT PR WAS OPENED, DELIBERATELY — and the divergence that would
  have blocked one is now gone.** The branch is 98 commits / 95 files /
  +17,190 −2,398 ahead. **A PR that size is not reviewable, and opening one
  creates the APPEARANCE of a review gate while providing none** — which is
  worse than no PR, because the rubber stamp is then on the record.
  ► **STALE, AND IT CONTRADICTS ANOTHER FIGURE IN THIS SAME DOCUMENT.** Measured
    2026-09-07: **172 commits / 140 files / +33,337 −1,227**, with `main` a clean
    ancestor of HEAD, so the clean-superset claim HOLDS. ► **This is exactly the
    live-moving kind that should never be a written number.** Use
    `git rev-list --count main..HEAD` and `git diff --shortstat main...HEAD`.


  What was actually blocking a clean merge was fixed instead: `main` had
  diverged, and merging it in surfaced content this branch was silently missing
  (`.mailmap`, two design docs, README improvements, and a HANDOFF section that
  reached `main` through PR #2). **The branch is now a clean superset of `main`
  and merges without conflict whenever the owner wants it.**

  **The owner's live options, and this is a decision for them, not an agent:**
  (a) merge the branch wholesale as one foundation merge, accepting it is
  unreviewable and saying so in the merge message; (b) keep working on the
  branch and merge later, which costs nothing now that the divergence is gone;
  (c) split it into reviewable PRs, which is real work and buys review of code
  that is already green and already in use. **Recommended: (b) until
  `ss2-rules.js` lands, then (a).** There is no third party to review this, so
  a PR's only real function here is a changelog.

### Nothing states when a branch should reach `main`

Found 2026-09-01 while correcting the two stale `main` SHAs above. The only
written rule about `main` is a PROHIBITION — `AGENTS.md`: "Do not push to
`main`. Work happens on feature branches. Ask before pushing anything." No
document in this repository says when a branch becomes ELIGIBLE to merge: not
`AGENTS.md`, not this file, not `docs/handoffs/README.md`, not the roadmap, and
there is no CONTRIBUTING.
► **NARROWLY TRUE, MISLEADING AS WRITTEN.** `AGENTS.md` now names a thirteen-rule
  document that explicitly covers "merge eligibility" and says those rules are
  ENFORCED. The rules live in `claude-harness`, a different repository — which is
  the only sense in which "no document in THIS repository" survives, and that is
  a distinction worth stating rather than a gap worth recording.

► **THAT SENTENCE IS NO LONGER IN `AGENTS.md`.** What it says today is that git
  and GitHub follow `claude-harness/docs/git-hygiene.md` — thirteen rules
  covering branches, commits, pushing, PRs and merge eligibility — that those
  rules are ENFORCED through `.claude/settings.json`, that this project TIGHTENS
  the push rule to ask before every push, and that `main` is denied outright.
  Quote `AGENTS.md` as it reads now, not as it read on 2026-09-01.


The de facto practice, read off the history rather than from any document: a
branch becomes a GitHub PR and a HUMAN merges it in the web UI. Both merges to
`main` are PR merges (`e3f14aa`, `4409ec7`), and the only commit in this
repository not authored by `Codex Local <codex-local@invalid>` was one of those
web merges. The gate is the owner, exercised through GitHub, not anything an
agent runs.
► **WRONG ON BOTH HALVES, INCLUDING THE SHAPE.** There are **two** web-merge
  commits authored by the owner, not one, so even "the only … one" is wrong. And
  by the date this was written, **24 further commits were already authored
  otherwise** — so the sweeping claim about authorship was false when it was
  made, not merely stale.


That is a real gap on a project this careful about writing rules down, and it
has a cost right now: `arena/champion-capture` is 61 commits ahead of `main`
with no PR, so every promoted golden, the capture pipeline and the whole
2026-08-31 corpus repair are unmerged. `gh` is installed and authenticated in
WSL as of 2026-08-31, so opening one is newly cheap — **but that is a decision
for the owner, not a cleanup an agent should perform.**
► **STALE, AND IT CONTRADICTS THE "98 COMMITS" FIGURE a few dozen lines above in
  this same document.** Measured 2026-09-07: 172 commits ahead. "With no PR"
  still HOLDS — the open PR is for a different branch. Use
  `git rev-list --count main..HEAD`, not a number.


### Still open, with the evidence below the archive line

Hoisted 2026-08-31 when the file was split, because these were live instructions
sitting in what became frozen evidence. Each is a one-line statement of the work;
the analysis that established it is below the line. **Correct these HERE.**

- **A third working forgery against the promotion gate, and it is open.** Hook
  attribution: a record carrying deliberately wrong hook labels, `callSite` or
  `injected` passes ingest, verify and promotion. Partly narrowed since — the
  matcher now TRANSLATES `reason` rather than stripping it, and the pairwise gate
  sees `callSite` — but the gate catches only DISAGREEMENT, so two records
  agreeing on the same false attribution still promote. **Do NOT "fix" it by
  adding a fixture-derived `callSite` comparison**: it is a compile-time constant
  and that would compare one constant to another.
- **The eight reachable fixtures over-pin `staminaleft`/`staminamax`**, and the
  prescribed exclusion ~~must not be written before the audit named below~~
  **is DEAD, not merely deferred — corrected 2026-08-31.** This line read as
  "write it after an audit"; § "READ THIS FIRST" says the comparison-side fix is
  the wrong fix and the capture is what to pin. If an exclusion is ever landed
  anyway it still needs the audit named below AND cannot lean on the pairwise
  gate, which is unreachable on nonce-free evidence.
- **The 81 divergence-report digests are unverified**, and the obvious repair is
  an assertion that cannot fail. A second code path produces them; until it is
  traced there is nothing to compare against.
- ~~**`src/adapter/battle-host.js:155` collapses an array `aiFill` to one
  object**, reproduced end to end, pinned by NO test. Source edit and test
  rewrite must land together in one owner's hands.~~
  ► **CLOSED — BOTH CLAUSES ARE STALE, re-derived 2026-09-02.** The defect is
  gone and the "pinned by NO test" clause is now false, which is the more
  dangerous half: it invites a session to spend a window writing a test that
  exists. Line 155 is no longer `{ ...declared, resources: first }`; the site
  is `declaredFillResources(declared, index)` (`:150-156`), which returns
  `declared.resources` for an object and `declared[index].resources` for an
  array, so no array is spread into an object literal at all. Two tests pin
  it through the REAL host — `test/ss2-adapter-integration.test.js:584` ("a
  per-slot array aiFill's own resources outrank the template bag, per slot")
  and `:631` ("a per-slot aiFill array reaches the roster whole") — plus
  `test/team-resolver.test.js:708` on the resolver entry point. Verified by
  MUTATION, not by reading: restoring the collapse (`const entry = {
  ...declared }`) fails 2 tests. The workaround retirement the item was found
  under is also done — `aiFillWithResources` appears nowhere in `src/`.
  **This is the third open item in this list to decay the same way; an open
  list is a claim, and it needs re-deriving before it is actioned.** The
  frozen copy at ~line 2745 is wrong too and stays there as history.
- **One `isNum` site survives at `ss2-capture-wrapper.as:1407`**, with a
  demonstrably NaN operand. Fail-closed, so diagnosability rather than
  corruption — but the claim that the guard is used everywhere is false.
  ► **THE WORDING IS BACKWARDS AND SENDS A READER TO THE WRONG THING.
    Corrected 2026-09-01 (evening), re-derived directly from the file.** Line
    1407 contains **NO `isNum` call**. It reads
    `if (currentTournament >= 19 && ranking <= 2) {` — a bare doubly-negated
    comparison on two possibly-undefined game fields, which is precisely the
    shape the `isNum` comment block forbids: with either field undefined,
    `NaN >= 19` and `NaN <= 2` are BOTH true and the run takes
    `arenaAbort("final-victory-arm")`. It is the surviving UNGUARDED NaN site,
    not a surviving isNum site. `isNum` appears on 12 lines — 625 (the
    definition), 634, 735, 755, 877, 951, 1296, 1496, 1597, 2029, 2065, 2129 —
    and none of them is 1407. The severity assessment is unchanged and correct:
    fail-closed, a spurious abort rather than a false capture. The same wording
    appears again below the archive line at ~2042 and is wrong there too.
- **`-StageGold` re-stages on every `-Attempts` retry.** Scope any fix to make
  the SHOP TRIP idempotent, not the gold write; the obvious fix is worse than the
  bug.
- ~~**`validate-vehicle.ps1` launches Ruffle at the REAL save** with no
  `--save-directory` and no process guard. Its save tripwire also hashes only
  the FIRST `ss2_data.sol` of three.~~ **CLOSED — all three clauses are stale,
  corrected 2026-09-01.** The script gives Ruffle its own empty
  `--save-directory` under `captures\vehicle-check\`, throws if any Ruffle
  process is already running, and hashes EVERY `.sol` under the shared root.
  Confirmed twice: in the script's own header, and in a live run this session
  that printed all three `.sol` hashes before and after and used a private store
  `save-20260901005702`. Read the tripwire for what it is, though — the stub
  writes no SharedObject, so a PASS is the absence of a counterexample, not
  evidence of isolation. **This item is what an open item looks like after the
  code moved and nobody re-read it; an open list is a claim that decays.**
- ~~**`run-arena.ps1` kills every Ruffle process rather than its own pid**,
  which sabotages any concurrent isolated session.~~
  ► **CLOSED — re-derived 2026-09-02 from the script.** It closes its OWN
  window by pid: `Get-SessionRuffle` (`:229-241`) reads
  `captures\<SessionId>\ruffle.pid`, refuses a recycled pid whose process is
  not named `ruffle`, and `:371-379` does `CloseMainWindow()` then a 5-second
  `WaitForExit` before forcing. The blanket kill survives only as a warned
  fallback when the pid file is missing (`:386-387`), and the script refuses to
  start at all while another Ruffle window is open (`:203-205`). The file's own
  comment block at `:206-225` records the fix and both harms it closed —
  including that the name-keyed wait accepted ANY Ruffle, so a foreign process
  both satisfied the wait and masked this window's death.
  **Fourth item in this list to decay. The list needs re-deriving as a unit,
  not item by item as each one happens to be read.**
- **The spell family (8) cannot arm**; `spell_id` does not exist in the build.
  The byte-backed candidate arming point is `cast_spell_icon`.
- **Fifteen fixtures assert a hero the build cannot produce**, and the
  contradiction is FORCED, not a failed search. Re-derive from the map; never
  edit them to fit.
- **Docs known stale, not yet reconciled**: the staging runbook's
  `parseStageList` mechanism and its "weapon table unmapped" premise;
  `ss2-arena-route.md` §12 on `armourclass`; `ss2-champion-dna.md` §7 on
  `fightMode`.
  ► **ALL THREE WERE RECONCILED 2026-08-31 by `dc334f2`** ("Reconcile three
    integration documents with what the bytes say", +1340/−207, touching exactly
    those three files). Verify: the runbook's `parseStageList` mechanism at
    `:1218`; its weapon-table premise retracted at §5.1 `:1068`;
    `ss2-arena-route.md` §12 `armourclass` at `:1985-1987`; `ss2-champion-dna.md`
    §7 `fightMode` at `:764`. **This entry was correct for 2 h 16 min** (written
    `2d70738` 2026-08-30 23:34, reconciled 01:50 the next morning) and has stood
    wrong for seven days. `docs/integration/ss2-arena-route.md:1821` has been
    telling this file so the whole time — "is correct and is now acted on; the
    entry can be struck" — and nobody read it. **Struck.** (The duplicate below
    the archive line is frozen; leave it.)

    ► **TWO ANCHORS WERE WRONG THE DAY THEY WERE WRITTEN, TWO HOLD.** The script is
      byte-identical to the commit that wrote this sentence, so neither is drift.
      The comment block runs one line longer than stated, and the blanket-kill
      fallback is one line further down than the range given — that range names the
      comment tail and the WARNING line, not the kill. **Holding exactly:**
      `Get-SessionRuffle`'s span, the start-refusal, and the close block.

    ► **SELF-REFERENCE INTO A GROWING FILE — replaced by a search.** Find the
      duplicate with `grep -n 'isNum. site survives' HANDOFF.md` and take the hit
      below the archive line. The substance is verified: the wrapper line reads
      `if (currentTournament >= 19 && ranking <= 2) {` with no `isNum` call.
      ► **DO NOT "FIX" THE COUNT.** `grep -n isNum` on the wrapper returns 15 lines,
      but three of them merely MENTION `isNum` in comments. The twelve this document
      lists are exactly the twelve lines carrying an `isNum` CALL. **The sentence is
      correct as written; a blanket 12→15 would falsify it.**

    ► **SELF-REFERENCE INTO A GROWING FILE — AND IT WILL BE WRONG AGAIN NEXT COMMIT,
      SO IT IS REPLACED BY A SEARCH RATHER THAN A NUMBER.** Find the frozen copy with
      `grep -n 'resources: first' HANDOFF.md` and take the hit BELOW the archive
      line. ► **AND THE SWEEP'S OWN ROW IS BROKEN HERE, not merely stale**: it claims
      `declaredFillResources(declared, index)` spans `battle-host.js:150-156`, and
      that was ALREADY wrong when the sweep measured it. Locate it with
      `grep -n 'declaredFillResources' src/adapter/battle-host.js`. The two named
      integration tests have also moved by two lines each; `aiFillWithResources`
      appearing nowhere in `src/` still HOLDS.


---

## THE ARCHIVE LINE

**Everything below is FROZEN EVIDENCE AND HISTORY. Do not append here, and do not
correct an instruction here — hoist it into the living head above and correct it
there.** What is below is the analysis that established the items above: it is
kept because this project's discipline is that a reader must be able to check a
claim, not because it is current.

---

### The prescribed fix, and why I did not apply it

Dropping `staminaleft`/`staminamax` from `scenario` is a clean deletion —
`assertAllowedKeys` is an allow-list. But `expected.state.<side>.staminaleft`
cannot simply follow: `assertExactKeys` makes it mandatory on both sides, and the
resolver's defaults would then pin `staminamax`, or `0` — **a different wrong
number rather than none.** So the field has to be excluded from the `/finalState`
comparison, with `expected.mutation.staminaBonus` carrying the derivable claim
instead. That split is right in principle: the delta
`ceil(breastplate * damage / 100)` is a pure function of the scenario; the
absolute level is not.

**STOP AND AUDIT BEFORE IMPLEMENTING THAT.** Excluding a field from
`matchSs2ObservationToFixture` repeats the structural shape of one of the two
forgeries closed in `cc42503`: cosmetic opcode rolls were excluded from sample
matching by label regex on both sides, and a record carrying 120 fabricated
debris rolls matched a 7-sample fixture. The analysis cites
`isCosmeticDebrisSample` as the precedent to follow — but that mechanism *was*
the vulnerability. An exclusion that is "obviously harmless because the chain
never reads the field" is exactly the argument that was made for debris rolls.

The next session should implement it, but only behind an adversarial pass whose
single named claim is **"a record carrying an arbitrary `staminaleft` cannot be
promoted"**, and it must check the 22 existing goldens, whose `breastplate` is
not always 0.

Undocumented behaviour found on the way, for the battle map: the `taunt` branch
carries the rest branch's restoration inline — `+0x684c`
`hitpoints += 3 + ceil(stamina)` and `+0x6894` `staminaleft += stamina` — guarded
only by `attacker.struck != null`, i.e. on every completed taunt.

**All eight currently reachable fixtures pin the identical
`staminaleft: 105 / staminamax: 110` for BOTH combatants** — the five
`candidate-armoured-*` and the three `candidate-tournament-*`. It reads as one
derived constant applied uniformly rather than eight independent derivations.

Five independent live direction-5 hero captures disagree with it, and with each
other: villain `staminaleft` came back 90, 92, 93, 95, 100 and hero 104, 106,
106, 108. Nothing else observable diverged, except one run where the villain
landed a blow first and cost the hero 12 hitpoints — which is the predicted
consequence of the repaired side guard re-arming rather than a surprise.

Be precise about what "nothing else diverged" covers, because the compared
projection is narrower than it looks. `matchSs2ObservationToFixture` compares
the scenario, the ordered samples, the ordered mutations with each reason
translated to a hook, the semantic events, the result event and the final state.
**`expected.calculation` and `expected.mutation` are candidate-derived and are
NOT compared at all** — so the hit chance, roll needed, deflection roll and
threshold, and critical determination were never checked against the runtime.
And `/samples` is close to a self-comparison on an injected-tape capture,
because the wrapper emits the fixture's own tape entry rather than the game's
call arguments.

What genuinely matched five times over is the mutation trace and the final
state — the damage write, the armour absorption, and the resulting
`armourclass`. Those are real game outputs.

So the blocker for all eight is one field, and the question is whether it belongs
in these fixtures at all. **Do not resolve it by editing the fixtures to the
observed values.** That is the one move this pipeline exists to refuse. It is a
map question: does `staminaleft` enter the resolution chain, and is its value at
the first `checkattackroll` determined by the scenario or by the number of
approach steps the scenario does not specify?

**The 81 divergence-report digests are unverified, and the obvious fix is
another assertion that cannot fail.** `ss2-divergence-corpus.test.js` compares
`record.digest` to `report.observationDigest` only inside
`if (record.target.fixtureId === report.fixtureId)`, a branch dead by
construction — a report exists *because* the observation did not match that
fixture — and the file already asserts `sameTarget === 0` and says so.

Measured while looking for a repair, and the measurement is the finding: for all
six reports that resolve to a committed record, `computeSs2ObservationDigest`
reproduces the record's **stored** digest exactly (6/6), and the **report's**
`observationDigest` is a different value in every case. So the report digest is
not the observation record's digest, despite `promote-1v1-golden.js:207` reading
`observationDigest: observation.digest` — a second code path produces the ones in
the corpus. Until that is traced, there is nothing in the repository to compare
them against.

Do NOT "fix" this by adding
`assert.equal(record.digest, computeSs2ObservationDigest(record))`.
`ss2-capture-attestation.test.js:92-104` already establishes that this
assertion **cannot fail**: `validateSs2Observation` recomputes and compares the
digest internally and `ingestSs2CaptureTrace` returns through it, so the equality
holds by construction on any ingested record. That file solves the real problem
the right way — it adds and removes each attestation and requires the digest to
MOVE — and any repair here should follow that shape rather than compare a value
to itself.

Three genuinely redundant assertions also survive in the divergence corpus file:
the duplicate-pair check at :259 (implied by the filename check above it, since
a directory cannot hold two files of the same name), and the two closing
equalities of the archive test, each arithmetically implied by the
`assert.deepEqual(missing, [])` five lines above. They are noise rather than
cover for a bug, but they should be given independent derivations or deleted.

**The wrong-side guard does not protect the arena route, and 9 of 20 armed
captures were mislabelled. CRITICAL, and found live.**

Twenty-two `run-arena.ps1` rounds were run against
`candidate-armoured-deflection-threshold-cleared` on 2026-08-31 (sessions
`session-adc1` … `session-adc22`; twenty armed, one aborted, one produced no
direction). Splitting them by which combatant the first `damagecharacter` write
landed on:

| Who actually swung | n | `attack_direction` values observed |
| --- | ---: | --- |
| hero | 11 | 8, 8, 7, 8, 7, 6, 8, 8, 6, 7, 7 |
| **villain** | **9** | 4, 10, 11, 20, 3, 2, **5**, 20, 10 |

**Every one of the twenty carries `"attackerSide":"hero"` in its meta line, and
`capture-refused-wrong-side` was logged exactly zero times.**

This is the failure `captureAllowedNow`'s own comment calls out by name — "arming
on the villain's swing would file a trace labelled 'hero' that ingest has no way
to contradict: a false observation, which is worse than no observation." The
guard is written correctly but is skipped wholesale on this route:

```
var attacker = gameRoot().game_attacker;
if (attacker != undefined) {          // <-- on the arena route it IS undefined
    ...
    dbg("capture-refused-wrong-side");
```

`game_attacker` is evidently not set at the moment `captureAllowedNow` runs here.
**Correction, 2026-08-31.** Both sentences that stood here were wrong, and they
were mine. I wrote that the guard "is not dead everywhere — six
`capture-refused-wrong-side` lines exist in older prisoner-route captures — so
this is arena-specific." Those six matches are in compiled wrapper SOURCE copies
under `captures/wrapper-cache/` and `captures/vehicle-check/`, not in any trace.
Across 268 archived rufflelogs the refusal appears **zero** times, and the defect
was **universal**, not arena-specific.

The cause was one word in one expression: the guard read
`gameRoot().game_attacker` — `_level1.game_attacker` — and the game never writes
that path. All 296 `game_attacker` references live inside `sprite:862[overlay]`
frames 1 and 52, and the only two writes are bare `SetVariable` instructions
inside `changeCombatants`, which in AVM1 resolve up the scope chain to the clip
that defined the function. The value lives on the **overlay clip** — the same
object the wrapper already reads `attack_direction` from at arming time.

I also proposed `if (attacker == undefined) return false;` as the fix. Applied to
the path as it stood, that would have blocked **every** capture on every route —
21 of 21 armed rounds and all 193 archive captures — because the read never
resolves. Fixing the object had to come first.

**Both are now fixed and the guard is proved to fire in both directions**
(commit `2b483a8`). `stub-game.as` had omitted `game_attacker` entirely, so
`validate-vehicle.ps1` could not exercise the side guard at all — the gate this
project mandates after every wrapper edit never noticed the guard was dead,
because a stub that omits the field a guard reads cannot test that guard, and
its silence reads exactly like a pass. With the stub binding the attacker:

| stub binds | launcher claims | marker | outcome |
| --- | --- | --- | --- |
| hero | hero | `attacker-resolved-hero` | 32 trace lines, MATCH, gate PASSES |
| villain | hero | `capture-refused-wrong-side` | 2 lines, nothing arms, ingest refuses |

The second row is the first observed refusal in the project's history. A run
whose log carries no `attacker-resolved-<side>` line has a dead guard again.

**Two things follow, and the second is the dangerous one.**

1. *The battle map's `randomBetween(5, 8)` for `normal_attack` is confirmed,
   sharply.* All eleven hero swings landed in 6–8 and none outside. The
   out-of-range directions in the archive (2, 3, 4, 10, 11, 20) are the villain's
   attacks, not a wider hero range. Direction 20 in particular belongs to no
   documented hero band.

2. *Direction does NOT discriminate, and must not be used as if it did.*
   `session-adc18` is a villain swing at **direction 5** — inside the hero's own
   range. Its mutation path is `/hero/hitpoints` and its method is `critical`.
   Had the target fixture expected a hero-side mutation, that trace could have
   MATCHED while being attributed to the wrong combatant, and the promotion gate
   needs only two such.

Every one of the nine was in fact caught, by `/mutationTrace/0/path` diverging
(`/villain/armourclass` expected, `/hero/hitpoints` observed). **That is
incidental, not a designed defence.** It holds only because every currently
reachable fixture happens to expect a villain-side mutation.

The fix belongs in `ss2-capture-wrapper.as` and so needs the vehicle gate re-run;
the wrapper was frozen for this session's supervised captures, so this is
reported rather than fixed. The shape it should take is a REFUSAL when the
attacker cannot be identified, not a skip — `if (attacker == undefined) return
false;` — because "I could not tell who swung" and "the right combatant swung"
are the two cases the current code merges, and it merges them in the unsafe
direction. Note that this is the same defect class as the `isNum` trap: an
undefined read taking the permissive branch.

**A third working forgery against the promotion gate. CRITICAL.** Hook
attribution is not merely unverified — `reason` is stripped from BOTH sides
before comparison (`src/golden/observation.js:753-760` and `:803-808`,
`src/golden/promote-1v1-golden.js:373`), so a record carrying deliberately WRONG
hook labels, `callSite` or `injected` passes ingest, verify AND the promotion
gate, and yields a golden the committed suite accepts. The mutation trace is the
documentation's own "substantive evidence", and its attribution to a game
function is the only thing separating "`damagecharacter` subtracted these
hitpoints" from "some unnamed code did". This is the same class as the two
forgeries closed in `cc42503`, and it is open.

The fix is to translate rather than strip — map each fixture entry's static
reason through the hook table and compare — and it costs no re-capture. **Do
NOT instead add a fixture-derived `callSite` comparison:** `callSite` is a
compile-time constant in the wrapper's single roll emitter, so comparing it
would manufacture the appearance of verification while comparing one hard-coded
constant to another, which is the defect class this project has now found six
times.

**`validate-vehicle.ps1`'s new save tripwire hashes only the FIRST file named
`ss2_data.sol`.** This machine's save root holds three `.sol` files. The gate is
isolated by `--save-directory` regardless, and the tripwire is documented as
currently unarmed, but it is narrower than it reads.

**`src/adapter/battle-host.js:155` returns `{ ...declared, resources: first }`,
and `declared` may legally be an array since `193e54d`.** An array `aiFill`
collapses to a single object — reproduced end to end against the real modules.
Pinned by no test. The workaround retirement this was found under is NOT done:
removing it reddens three assertion sites in `test/ss2-adapter-integration.test.js`,
one of which pins the defect being removed, so the source edit and its test
rewrite have to land together in one owner's hands.

*(My error on that track: I briefed the agent with the path `src/team/battle-host.js`.
The file is `src/adapter/battle-host.js`. The agent correctly stopped and
reported rather than guessing.)*

**`-StageGold` re-staging on retry: the obvious fix is worse than the bug.**
Gold gates WHICH weapon the shop scanner accepts, and `hero.weapon` is a
`battlevalues` input. Making the gold write once-only while leaving the shop
re-entry in place would let attempt 2 buy a DIFFERENT, cheaper weapon and fight
with different damage rolls — a real evidence defect, where the current bug only
fabricates a gold figure no artefact carries. Scope any fix to make the SHOP TRIP
idempotent, not the gold write.

**One `isNum` site survives, at `ss2-capture-wrapper.as:1407`** — two raw hero
reads compared with BOTH negated forms, and one operand is demonstrably NaN in a
committed live trace. Fail-closed (`arenaAbort` only sets flags and logs), so it
is a correctness and diagnosability defect rather than a corruption path, but the
claim that the guard is used everywhere it is needed is false.

**The fifteen impossible-hero fixtures: the contradiction is FORCED, not a failed
search.** The `max_damage - min_damage` spread is strength-free, and exactly one
row in ninety has spread 8 — so the weapon is uniquely determined before strength
is considered, and only then does strength turn out to be wrong. And the escape
hatch is closed: `nextphase` recomputes `battlevalues` for BOTH combatants at
every phase transition (`ss2-capture-wrapper.as:2078`), so `-StageHero
"strength:5,min_damage:12,max_damage:20"` cannot reproduce them live either.
Still deliberately NOT fixed — they must be re-derived from the map, not edited
to fit — but the reasoning is now a proof rather than an absence.


**Evidence chain**
- Two-session independence still rests on operator strings for every promoted
  golden: 9 of 67 records carry a nonce and **none of the 9 is cited by a
  golden**.
- **Hook attribution is never verified anywhere.** `reason` is stripped from
  both sides before comparison, so hook labels, `callSite` and `injected` are
  unfalsifiable in all 22 committed observations.

**Fifteen fixtures assert a hero the build cannot produce.** Groups C–F stage
`strength 5` with `min_damage 12 / max_damage 20`, which under the verified
`round(strength*2) + weapon_min_damage` implies a weapon row `[3]=2 [4]=10`. All
90 rows were dumped; no such row exists. The closest is `weapon41` (4/12), which
works at strength **4** or **8** — one point off each fixture. **Deliberately not
fixed**: candidates are derived from the map, never edited to fit, so these
should be re-derived properly rather than patched.

**The spell ingress cannot arm.** The hook label and `magic-damage` event are
fixed, but all 13 `checkattackroll` sites were enumerated and none falls inside a
spell arm; `attack_chances` is not reachable on a hero cast turn. And **`spell_id`
does not exist anywhere in the build** — both branches of that code are dead. The
byte-backed candidate for an arming point is `cast_spell_icon`, which carries the
inventory id as a literal argument; wiring it changes the capture window's
boundary (a cast's impact lands many frames later) and needs the gate re-run.

**GATE A freezes a game mechanic, deliberately.** The route writes
`time_of_day = 24` on every town-square entry; no button does that. It suppresses
the day counter, the lighting and the 200-point special event, and frame 150
persists the frozen value. Kept — the event it prevents permanently mutates
charisma, magicka or gold and saves *that* — but it is an alteration,
owner-approved, and must not be described as a button replication.

**Save-safety items not yet closed**
- `run-arena.ps1` still kills every Ruffle process rather than its own pid,
  which sabotages any concurrent isolated session.
- `validate-vehicle.ps1` launches Ruffle at the REAL save with no
  `--save-directory` and no process guard, while this file mandates running it
  after every wrapper edit.
- Two unguarded arithmetic writes to DNA fields: `experience = experienceneeded
  + 1` and `vitality++`. Neither operand was shown to be undefined, so this is
  argued rather than demonstrated — but it breaks the file's own isNum rule.
- `-StageGold` re-stages on every `-Attempts` retry, discarding gold the
  previous attempt earned.

**Adapter**
- No per-action animation acknowledgement, so nothing sequences action N+1's
  rebind against action N's running timeline. Documented as a gap, not designed.
- `roster.js` now supports per-slot AI fill; `battle-host.js` can drop its
  `aiFillWithResources` workaround and retire `diagnostics.aiFillResourceGaps`.

**Docs known stale** (flagged by agents, not yet reconciled): the staging
runbook's `parseStageList` mechanism (it guards with `isNum`; it does not write
NaN) and its "weapon table unmapped" premise (it is decoded);
`ss2-arena-route.md` §12 on `armourclass` being re-derived mid-battle (it is
not — that is the whole basis of the armoured family); `ss2-champion-dna.md` §7
on `fightMode` (the fixtures carry it now).

---
