# Mutation audit, 2026-09-07 — which of the 816 tests actually kill mutants

**RESULT: 48 single-line mutations run in isolated copies. 11 KILLED, 37
SURVIVED. Eight survivors were handed to write-nothing adversarial verifiers
aimed at breaking the report, and all eight came back CONFIRMED-SURVIVOR** —
each with its own baseline, its own two mutated runs, and its own
*instrumented reachability proof* rather than a reading. `started == returned`
on every phase: 6/6 targeters, 48/48 mutations, 8/8 verifiers, zero deaths.

**Nobody had done this systematically before.** Earlier sessions found three
survivors by hand — a stamina floor that was dead code, a clamp whose deletion
changed nothing, a refused attack that consumed RNG. This is the first pass
that asked the question across the whole engine.

## Why a survivor matters MORE here than in an ordinary codebase

This repository's entire value is that its numbers were MEASURED. A test that
passes while the code is wrong does not merely miss a bug — it converts
measured evidence into self-confirming data. That is the failure mode every
rule in `AGENTS.md` exists to prevent, and 37 of 48 mutations reached it.

## READ THIS BEFORE REPEATING THE WORK

**A scratch copy built without `.git` is NOT a valid baseline.** It measures
813 / 811 / 1 / 1, because `test/ss2-fixture-transcription.test.js` reads the
git history and fails at file level, swallowing its own four tests. Copy with
`.git` included; the correct baseline is **816 / 815 / 0 / 1**, and every agent
here measured it in its own copy before mutating.

**Two lines in `src/golden/capture-ingest.js` are byte-identical to each
other** (the injected-tape guards at :158 and :199, one for overdraw and one
for launchNonce). Mutate BY LINE NUMBER; a text replace hits both and conflates
two independent gates.

## The good news first: the corpus-integrity gates have teeth

**Six of the eleven kills are in `src/golden/`** — the promotion and
attestation path. Every one of these was refused by a test that names the harm:

| mutation | killed by |
| --- | --- |
| `src/golden/promote-1v1-golden.js:489` → `if (sessionIds.size < 1) {` | test/capture-campaign.test.js:1089 "promotable is false when both matching observations come from the same session"; test/ss2-observation.test.js:1052 "promotion requires two observations from indepen |
| `src/golden/observation.js:680` → `const expectedDigest = record.digest;` | test/ss2-observation.test.js:210 — "observation validation rejects tampered digests and unverified sessions" (failing assertion at test/ss2-observation.test.js:216) |
| `src/golden/promote-1v1-golden.js:289` → `observation.observationId === candidate.fixtureId` | test/ss2-capture-attestation.test.js:800 — "a candidate's own source record is refused as evidence, however well it matches"; test/capture-campaign.test.js:666 — "coverage accounts for every matching  |
| `src/golden/observation.js:333` → `build.steamBuildId !== SS2_STEAM_BUILD_ID &&` | test/ss2-observation.test.js:261 — "observation records reject asset-like payloads and foreign builds" (1 test failed; 815 -> 814 pass, 0 -> 1 fail) |
| `src/golden/promote-1v1-golden.js:427` → `const owner = nonceOwners.get(observation.observationId);` | promotion refuses two observations minted by the same player launch (test/ss2-capture-attestation.test.js:530) |
| `src/golden/capture-ingest.js:158` → `if (meta.method === ObservationCaptureMethod.SIMULATED && !allowsMissingAttestations(options)) {` | test/ss2-capture-attestation.test.js:332 "the mandatory rule is scoped to injected-tape captures, and nothing else"; test/ss2-capture-attestation.test.js:250 "an injected-tape trace with no over-draw  |
| `src/campaign/store.js:636` → `if (false) assertNoVanillaFieldNames(record, "record");` | the screen has teeth: a record reaching for a vanilla field name is refused at every gate (test/campaign-persistence.test.js:1067, assertion at :1084) |

So the >=2-observations-from->=2-independent-sessions rule, the self-citation
refusal, the digest check, the `SS2_STEAM_BUILD_ID` gate, the launch-nonce
owner check, the injected-tape scoping and the vanilla-field screen are all
genuinely guarded. **The gates that protect the corpus are the best-tested
code in the repository.** Only 2 of the 37 survivors are in `src/golden/`.

## The bad news: the ENGINE is largely unpinned

| area | survivors |
| --- | ---: |
| settlement-and-elimination | 8 |
| adapter-boundary | 8 |
| ss2-arithmetic | 7 |
| campaign-persistence | 7 |
| rng-and-hash | 5 |
| golden-gates | 2 |

## The eight CONFIRMED survivors, in the verifiers' own terms

Each was independently re-run and proved REACHABLE by instrumentation — none
is a dead-code finding. **Three of the verifiers reported that the original
finding UNDERSTATED the cost**, which is the opposite of the usual direction.

### 1. `src/team/ss2-rules.js:780` — CONFIRMED-SURVIVOR

```
- if (derive === true && STATED.length > 0 && !battleStarted) {
+ if (derive === true && STATED.length > 1 && !battleStarted) {
```

**What it attacks.** ATTACKS THE CORPUS'S CORE GUARANTEE: this is the only thing stopping ss2BattleValues from overwriting a runtime-verified number with a computed one. The file's own comment records a verifier measuring 21/23/30/110 become 20/20/10/100. With `> 1`, a record that states exactly ONE of min_damage/max_damage/hitpointsmax/staminamax is silently re-derived — measured evidence converted into self-confirming data, in silence, with no throw. SHOULD BE CAUGHT BY test/ss2-team-rules.test.js:426 "deriving over a record that already states a measured number is refused", but that test hands in a record stating ALL FOUR (line 431), so 4 > 1 still throws and the assertion cannot discriminate the boundary it exists to defend. I found no test anywhere that builds a combatant stating exactly one of the four with derive defaulted. Note the goldens' villains state hitpointsmax+staminamax (2 fields), so they will not catch it either.

**Cost, as the verifier put it.** The guard on line 780 is the only thing standing between a measured golden and `ss2BattleValues`, which overwrites min_damage/max_damage/hitpointsmax/staminamax unconditionally. The suite cannot distinguish `> 0` from `> 3`: both are fully green. So the guard can be silently degraded from "refuse if the record states ANY measured field" to "refuse only if it states ALL FOUR" with no test failing.

At `> 3` the damage is concrete and I measured it. test/fixtures/ss2-1v1-golden/golden-armoured-deflection-threshold-cleared.json's villain states exactly two guarded fields (hitpointsmax 80, staminamax 110) and is loaded by test/ss2-golden-resolver-replay.test.js:245 via combatantFromScenarioSide, which relies on an explicitly-passed `derive: false` — a keyword nothing else enforces. Drop or forget that keyword at `> 3` and the villain's measured hitpointsmax 80 silently becomes 10 (an 8x error in max health), no throw, no failing test. My census says 40 fixture sides sit in that window: 1 golden side plus 39 in test/fixtures/ss2-1v1/. That is a measured 80 HP, captured against ss2Sha256 77CB545C2061AB41246251467A4EDF5926AB6FD1DDD95DC9527D7BA9C45BB8CA / steamBuildId 24807725, being replaced by a number computed from herolevel and vitality the fixture schema does not even carry.

Player-visible: the armoured-deflection golden is the fixture that pins SS2's armour-absorption threshold. A villain re-derived from 80 HP to 10 dies to a single hit instead of surviving the deflection sequence, so the replay's whole action trace and the resulting battle hash diverge from the licensed build — the exact "measured evidence turns into self-confirming data" failure this repo exists to prevent. Worse, it fails SILENTLY: the corpus would keep reporting green while describing a fight the build never had.

Suggested kill (I did not write it — write-nothing verifier): a loop over all four field names, each stating exactly ONE with derive defaulted, asserting TeamRuleSetError and that the message names that field; plus a case stating exactly two (the real golden villain shape) — the two-field case is what actually kills `> 3` and defends the 40 corpus sides. Add a battleStarted:true case on the same line to close the second untested conjunct I found.

### 2. `src/team/ss2-rules.js:1694` — CONFIRMED-SURVIVOR

```
- armourLost: defenderBefore.armourclass - scenario.villain.armourclass,
+ armourLost: mutation.armourDamage,
```

**What it attacks.** REINTRODUCES A DEFECT AN INDEPENDENT REVIEW ALREADY MEASURED. The comment directly above it (lines 1689-1692) says these are two different quantities and that reporting one as the other was measurable: "a verifier measured 49 lost, 9 reported", because mutation.armourDamage is taken AFTER armour removal so a destroyed piece's rating is not in it. `grep -rn armourLost` over the whole repo (js, json, md) returns EXACTLY ONE hit: this source line. No test, no doc, no consumer. SHOULD BE CAUGHT BY an assertion on `battle.lastResolution.events[0].armourLost` in test/ss2-team-rules.test.js's armour block (around :690-732, which already stages an armoured villain) or in test/ss2-golden-resolver-replay.test.js against golden-armoured-deflection-threshold-cleared, the one golden with armour. Neither exists. If this survives, the fix that a review paid for is unpinned and can be undone by anyone.

**Cost, as the verifier put it.** A real bug of this shape costs no golden and no hash — and that is the finding, not the mitigation.

WHICH GOLDEN: none. Zero of the 23 promoted goldens, zero observation records and zero manifests carry `armourLost` (1 grep hit repo-wide, and lastResolution is excluded from combatStateHash and toTeamWireState by design). WHICH HASH: none — no digest moves, so no replay test, no desync check and no manifest comparison can ever notice. PLAYER-VISIBLE: nothing today either — hotseat's renderResolution and renderDerivation (tools/hotseat.mjs:288-350) print effects, direction, chance and roll, never armourLost.

So the entire cost lands on the one layer this project exists to protect: the evidence layer. `armourLost` is the engine's ONLY report of the defender's actual `armourclass` delta — which is exactly the quantity a capture session measures off the licensed build, and exactly what `mutation.armourDamage` is NOT (it is the arithmetic's register, taken after armour removal, so a destroyed piece's rating is missing). Under the mutation the engine reports 21 where 121 was lost (55 executions per suite run), 21 where 341 was lost (32x), and 0 where 456 was lost. It is a silent, self-consistent lie about a measured number.

The concrete failure this enables: an agent later compares engine output against a capture, sees the engine say 21 and the runtime say 121, and reaches for the fix AGENTS.md names as "the single most tempting wrong move here" — editing the fixture to the observed value, or re-deriving the wrong side. Nothing in the suite tells them which side is wrong, because the suite is green at 816/815/0/1 with either expression. An independent review already paid for this exact fix once (the four-line comment at src/team/ss2-rules.js:1689-1692 records a measured 49-lost / 9-reported defect); today that comment is the only thing defending it, and a comment is not a guard.

CHEAPEST REAL GUARD, verified reachable by my own probe: test/ss2-team-rules.test.js already has the scenario staged. The test at :715-737 ("a destroyed armour piece is written to zero...") sweeps seeds until it finds a removal, already reads `battle.lastResolution.events[0].armourDestroyed`, and my probe shows that file hits the divergent path 4 times per run. Adding, inside that same `if (destroyed.length)` block, an assertion that `events[0].armourLost === defenderBefore.armourclass - villain.resources.armourclass.value` and that it is STRICTLY GREATER than `events[0].armourAbsorbed` whenever a piece was destroyed, kills this mutant with no new fixture and no new scenario. The strict-inequality half matters: my measurement shows 29 destroyed-piece executions per run where the two agree anyway, so an equality-only assertion on an arbitrary destroyed-piece seed can pass under the mutation.

### 3. `src/team/ss2-rules.js:1688` — CONFIRMED-SURVIVOR

```
- damage: mutation.hitpointDamage,
+ damage: mutation.armourDamage,
```

**What it attacks.** THE HEADLINE NUMBER OF EVERY PHYSICAL BLOW. This is the damage a UI, a narration line or a replay reads for an attack. I grepped every `event.damage` / `events[0].damage` assertion in test/: all eight hits (ss2-team-rules.test.js:1218, :1317, :1333, :1368, :1369, :1562, :1583, :1609) are inside the STATUS-PHASE block and assert the enchantment tick, which is emitted from a different construction site (line 1280). Nothing pins the attack path's `damage`. The golden replay only compares events to themselves (`JSON.stringify(first.battle.events)` vs `second`, :583-584) or across an invariance sweep (:666), so it is structurally incapable of catching a wrong constant. SHOULD BE CAUGHT BY an attack-path assertion tying `events[0].damage` to the health actually lost by the target. With armour staged the two quantities differ outright; with no armour, armourDamage is 0 while hitpointDamage is not, so every hit would report zero damage.

**Cost, as the verifier put it.** A real bug of this shape is a silent multiplayer desync plus a corpus-integrity failure, not the cosmetic reporting gap the original report describes.

WHICH HASH: `combatStateHash` (fnv1a over `toTeamWireState`, src/team/resolver.js:543 and :560), which carries `battle.events`. Measured: 20 of 23 golden replay hashes move under this one-line change — e.g. golden-armoured-deflection-threshold-cleared 6a3e5fd7 -> a8da3f2b, golden-prisoner-normal-kill 09a6c786 -> 781cb497. The suite stays 816/815/0/1 green throughout.

WHICH GOLDEN: all 20 non-miss goldens replay to a different wire hash while every assertion still passes, because the only pinned literal ("58240ee3", test/ss2-team-rules.test.js:960) is taken on a battle with no action applied. This repeats, exactly, the defect the repo already documented at test/ss2-team-rules.test.js:815-826, where 23 golden hashes moved and the commit truthfully reported "no pinned hash moved" — true of the assertions, false of the hashes. The guard added after that incident does not cover the post-action projection, so the same class of miss is still open.

PLAYER-VISIBLE BEHAVIOUR: (a) two peers on either side of such a change disagree on `combatStateHash` for identical battles — it presents as state divergence when the cause is a projection difference, exactly the diagnosis loss the resolver's own comment warns about; (b) `battleDiscriminator` in a completion token is a `combatStateHash` (src/team/settlement.js:93, `battleDiscriminatorOf` at :104), so tokens minted before the change name battles this build hashes differently — stored completions stop validating; (c) once any UI, replay or narration reads `event.damage`, it shows the armour figure as the headline blow: 1,971 of 2,070 damaging hits in one suite run would display "0 damage" while hitpoints visibly drop, and 1,389 whiffs against armour would display 21. Those numbers would carry no evidentiary backing while the corpus still claims every number was measured.

WHAT THE PROJECT LOSES: this is the projection step — the copy of a measured quantity into the record the rest of the system reads and hashes. The arithmetic is pinned hard at the candidate/fixture layer, so the corpus looks healthy; the handoff of that measurement to consumers is asserted by nothing. That is precisely the "a test that passes when the code is wrong" case this audit exists to find.

SUGGESTED KILL (two, both cheap): (1) an attack-path assertion tying `events[0].damage` to the target's actual hitpoint delta across the action, run once armoured and once bare — either arrangement kills this mutant outright; (2) more valuable structurally, pin ONE post-action `combatStateHash` literal for a canonical seeded SS2 attack, the missing twin of the t=0 tripwire at :960. Fix (2) would have caught this mutant and the 2026-09-07 incident the file already records.

### 4. `src/team/ss2-rules.js:1093` — CONFIRMED-SURVIVOR

```
- const after = clamp(before - staminaCost + branchGain + 1 + Math.round(stamina / 3), 0, maximum);
+ const after = clamp(before - staminaCost + branchGain + 1 + Math.round(stamina / 3), -1000, maximum);
```

**What it attacks.** DROPS THE BUILD'S OWN MEASURED FLOOR. `legalActions`' docstring cites `check_stats` flooring stamina at zero at `+0x114b` as the reason there is deliberately no "cannot afford this attack" gate — so the floor is load-bearing for action legality, not decoration. A negative staminaleft is reachable (power attack costs round(strength*3); a high-strength, low-stamina gladiator overspends). SHOULD BE CAUGHT BY test/ss2-team-rules.test.js:568 "an attack spends round(strength * factor) and regenerates", whose oracle at :587-590 mirrors `Math.max(0, Math.min(staminamax, ...))` — but it runs strength 6 / stamina 4 from a full 140 stamina, so the floor never binds and the `Math.max(0, ...)` in the oracle asserts nothing. The upper bound of the same clamp IS pinned (:560 "rest clamps at staminamax"); the lower bound is not. CAVEAT FOR THE NEXT PHASE: the brief says a prior session already found "a stamina floor that was dead code" by hand — this may be that same finding rediscovered mechanically. Check before counting it as new.

**Cost, as the verifier put it.** CONFIRMED SURVIVOR ON LIVE CODE, and the cost is larger than the report claims — it is a record-identity and multiplayer-desync bug, not a diagnostic-field bug.

WHICH HASH: `combatStateHash` (src/team/resolver.js:560) — measured 2114550a → c45b5421 on the :609 scenario. It moves because `toTeamWireState` carries `events: clone(battle.events)` and every resolver event carries `staminaGained`.

WHICH RECORD: that hash is the `battleDiscriminator` (resolver.js:316) folded into `completionToken` (settlement.js:93), which is the idempotency key; `recordId = SHA-256({battleId, completionToken})` (record.js:244); the campaign store keys rows `ss2TeamArena:battle:<recordId>` (store.js:42); and the sealed record `digest` covers the lot (record.js:348), with `provenance.battle.combatStateHash` written at from-battle.js:200. I measured 3 of 103 settlement tokens changing in campaign-read-back.test.js alone, with that file still 15/15 green.

WHICH PLAYER-VISIBLE BEHAVIOUR: stamina itself is unaffected — `writeResource` re-clamps, so the gladiator's `staminaleft` is 0 either way and no bar, no damage number and no golden fixture moves. What breaks is agreement. Two peers running builds that differ on this floor produce different wire projections and different `combatStateHash` values for the same bout, which is exactly the desync detector the wire projection exists to be; and the same bout resolved twice yields different `recordId`s, so the idempotency key stops being idempotent — a campaign gets a duplicate stored record under a second key instead of a re-write of the first, and a record can no longer be tied back to its replay. The corpus-integrity edge is sharper still: `completionToken` is the field record.js's tamper check reasons about, so a floor bug of this shape silently re-keys sealed, digested history.

WHICH GOLDEN: none — and that is the coverage hole, not a mitigation. The golden/observation pipeline uses a separate event vocabulary (`deriveExpectedEventsFromSs2Fixture`, observation.js:846-877, exact-key-validated), so no golden fixture, manifest or promotion hash constrains this line at all. The 23 promoted goldens cannot defend it even in principle; the only two suite-side guards are the three `staminaGained` assertions, all on non-binding cases, and no test anywhere pins a `combatStateHash` or a completion token over a bout where the stamina floor binds — which is what the 3 changed tokens prove.

### 5. `src/team/ss2-rules.js:1665` — CONFIRMED-SURVIVOR

```
- const eliminated = scenario.villain.hitpoints <= 0;
+ const eliminated = scenario.villain.hitpoints <= 1;
```

**What it attacks.** OFF-BY-ONE ON THE DEFEAT BOUNDARY THAT GATES THE WHOLE PHASE TRANSITION. `eliminated` decides whether the attacker pays staminacost and regenerates at all (the death()-deletes-nextphase rule that nineteen goldens back) and what `staminaSpent` reports. With `<= 1`, a defender left on exactly 1 hp is treated as dead by the arithmetic while the resolver keeps them alive (`battleStanding` decides on `health > 0`) — the two disagree in silence, which is precisely the failure mode the first-blood refusal exists to prevent. I verified every one of the 23 goldens ends at villain hitpoints EXACTLY 0 or 10 (never 1): the spell/attack candidates clamp hitpoints to 0 at ss2-spell-candidate.js:166, so `<= 1` stays true for all 19 kills and the golden assertions at ss2-golden-resolver-replay.test.js:493-494 still pass. SHOULD BE CAUGHT BY test/ss2-team-rules.test.js:1076 "a killing blow costs the attacker nothing" plus its non-lethal counterpart at :1097 — but the latter stages vitality 40 (maxHealth 830), so the boundary is never approached from above. Nothing lands a defender on 1 hp deliberately.

**Cost, as the verifier put it.** A real bug of this shape is a SILENT PEER-DESYNC BUG that the corpus cannot see, because it moves the battle discriminator without moving any pinned number.

WHICH HASH. `combatStateHash` is not a test convenience — it is the identity of a battle in production code: `src/team/resolver.js:316` mints `battleDiscriminator: combatStateHash(battle)`; `src/team/settlement.js:38,68` pins the settlement token as "combatStateHash(battle), taken at the moment the settlement is armed. Without it two bouts between [the same pair are indistinguishable]"; `src/campaign/from-battle.js:200` writes `combatStateHash: combatStateHash(battle)` into the campaign provenance; `src/campaign/record.js:650-651` validates `provenance.battle.combatStateHash` as an 8-hex fnv1a and throws otherwise. The pin at test/ss2-team-rules.test.js:960 spells out the stake in its own failure message: "every peer running the previous build now disagrees with this one about identical battles, and every stored completion token minted before the change names a battle this build would hash differently."

WHAT IT COSTS. I measured 6 of 24 seeded battles reaching a different settled hash (e4b6e573->fcf0a528, ecd7843c->0ef62715, d5d42da9->06da155f, 3f585f18->abf128d4, e0209687->71d08def, 5dea140d->92064a91) with the suite fully green. Two peers whose builds differ by this one character play the same seeded battle to the SAME winner over the SAME number of actions — so nothing looks wrong at the table — and then disagree about the completion token and the campaign record. The failure surfaces at settlement, or worse does not surface and persists a record the other build would reject.

PLAYER-VISIBLE BEHAVIOUR. The mutant skips both the attacker's stamina payment and the phase regeneration heal whenever a defender is left on exactly 1 hp. The surviving fighter walks out of the arena with staminaleft off by +7 (or +5) — 83->90, 65->72, 52->59, 112->117, 40->47, 64->71 in my six diverging battles. Stamina is carried into the campaign record, so the error compounds across a circuit rather than washing out: a gladiator ends the next bout with stamina he never earned, changing which actions are legal for him.

WHICH GOLDEN. None — and that is the finding, not a reprieve. The 23 promoted goldens replay through test/ss2-golden-resolver-replay.test.js, which executes this exact line 348 times but only ever at hp=0 (x289), hp=10 (x42) and hp=80 (x17). The measured corpus never lands a defender on 1 hp, so the goldens do not constrain this boundary at all. The only two absolute hash pins in the whole suite (ss2-team-rules.test.js:960 "58240ee3" and team-resolver.test.js:702) both hash a freshly created battle with no action applied, so neither ever runs the line.

THE GENERAL HOLE, worth more than this one mutant. 24 of the suite's 26 combatStateHash assertions compare two hashes both computed by the mutated code, so they are green under ANY rules change by construction. There is no absolute pinned hash on a played-out battle anywhere. The cheap fix is one test pinning the literal settled hash of a handful of seeded ss2 battles — my six seeds above are ready-made — which converts this entire class of silent trajectory drift from invisible to a named failure. The deeper fix is a golden or fixture that actually exercises the hp==1 boundary, since the measured corpus currently never reaches it.

### 6. `src/team/ss2-rules.js:925` — CONFIRMED-SURVIVOR

```
- armourclass_max: read("armourclass_max", read("armourclass")),
+ armourclass_max: read("armourclass_max", 0),
```

**What it attacks.** ATTACKS THE ARMOUR/DEFLECTION PATH'S POOL SIZE. `armourclass_max` is the denominator the deflection threshold and the armour-removal gate work against; a wrong one changes which blows deflect and which pieces are destroyed. The file's own comment at 793-796 states the invariant this breaks: `vanillaRecordOf` falls back to `armourclass` precisely so that a combatant built by a different builder does not feed the arithmetic a different pool, and `ss2Combatant` mirrors it at line 797-799. Making the fallback a flat 0 desynchronises the two builders again. SHOULD BE CAUGHT BY a test that feeds the rule set a combatant declaring `armourclass` but not `armourclass_max` and asserts the pool matches — but SS2_RESOURCE_DEFAULTS declares armourclass_max: 0 for every ss2Combatant-built fighter, so every existing test supplies the key explicitly and the fallback branch is never taken. Only the adapter's `compareMaximumHealth`/blueprint path can reach it.

**Cost, as the verifier put it.** Bounded precisely, and the bound matters: this would NOT corrupt a promoted golden. All 23 goldens and every observation record under test/observations/ss2-1v1/ declare `armourclass_max` explicitly, and my probe confirms every golden-path execution has it declared, so the fallback never fires for measured evidence.

Where it costs is the LIVE multiplayer path. The damage is to `combatStateHash`. On the production adapter route I exercised, the hash diverges at the third action (`029d95d5` vs `a2b0bb36`) and stays divergent. state-bridge.js:620-628 says why that is unrecoverable rather than merely wrong: the owner's 2026-09-07 decision was to pin the projected bag's shape rather than carry a version id, precisely so the hash is stable across peers — "an old peer cannot tell 'different code' from state divergence". A defect of this shape therefore presents as an unattributable desync: two clients on the same seed and the same action list produce different hashes, and the protocol has no way to say whether that is a version skew or state corruption.

Player-visible, from my own measured run: the defender's armour pool reads 0 instead of 420, so armour that should absorb the blow absorbs nothing. The villain ended at armourclass 330 / hp 300 under the real code and armourclass 0 / hp 237 under the mutant — 63 hitpoints of damage that should have been stopped by armour, plus the armour pool itself wrongly destroyed. In the `ss2Combatant` route the same effect ran 1240 -> 1194 (correct) against 1240 -> 0 (broken). Concretely that means: who deflects, which armour pieces are destroyed, how long a bout lasts, and who wins.

The exposure is real rather than theoretical because the trigger is a documented, one-day-old API. The `resources` override exists specifically because `ss2TeamRules` needs 32 names while `CANONICAL_RESOURCE_SOURCES` carries 20, so a supplied (licensed) gladiator driven by the map-derived rule set MUST have its bag hand-written by the caller — and `assertSuppliedResources` will not tell that caller they left `armourclass_max` out. The guard at line 925 is the only thing standing between that omission and a silent desync, and nothing in the suite pins it.

The cheap fix is a test, not a code change: one case that builds a combatant with `armourclass` declared and `armourclass_max` absent and asserts the pool equals `armourclass`. The suite already owns the idiom (`without()` in test/ss2-team-rules.test.js:285-289). Worth noting a second, adjacent gap this exposes and that the mutation does not cover: `canonicalResourcesFrom` materialises an absent `armourclass_max` to 0 rather than to `armourclass`, so on the DEFAULT adapter path a vanilla record carrying `armourclass` but no `armourclass_max` field would get a declared 0 — and line 925's guard would never fire to save it.

### 7. `src/team/ss2-rules.js:975` — CONFIRMED-SURVIVOR

```
- if (!declared.has(name) || before[name] === after[name]) return;
+ if (!declared.has(name) && before[name] === after[name]) return;
```

**What it attacks.** WEAKENS && / || ON THE GUARD THAT KEEPS AN ACTION FROM BECOMING A PARTIAL WRITE. The docstring above (966-970) says an undeclared name must be SKIPPED because the resolver refuses one mid-list and leaves earlier effects applied — an unrollbackable partial action. With `&&`, an undeclared-but-CHANGED resource is written (the resolver throws mid-action, exactly the hazard named) and a declared-but-UNCHANGED one emits a redundant no-op effect that pollutes the effect list the build's first-touch order claim rests on. SHOULD BE CAUGHT BY test/ss2-team-rules.test.js:~700 ("resource effects come out in the build's own first-touch order", the block using `const rank = { armourclass: 0, armourclass_max: 1, damage: 3, staminaleft: 4 }`) if that test asserts the effect list EXACTLY rather than only its relative order, and by team-resolver.test.js's undeclared-resource refusal if any combatant leaves a written name undeclared. Both are plausible kills — this is the one proposal I expect to DIE, and a kill here is worth recording as evidence the effect list is genuinely pinned.

**Cost, as the verifier put it.** REAL SURVIVOR, REAL COVERAGE GAP, BUT NARROWER THAN THE REPORT CLAIMS — and the narrowing is itself the more useful finding.

WHAT IS GENUINELY UNPINNED. Nothing in 816 tests asserts the length or membership of defenderEffects' output for the real SS2 rule set. I inflated that list 2 -> 13 on every resolution and the entire suite stayed green. The only assertion touching it (ss2-team-rules.test.js:703) checks relative rank order, and the file's own comment at line 700 says it was added precisely because "Nothing pinned it, so reversing the two armour writes passed the whole suite" — it fixed ordering and left membership open. That comment is now half-true in a way a reader will misread as full coverage.

WHAT IT WOULD NOT COST, contrary to the report. No golden, no hash, no player-visible behaviour. I measured the adapter's vanilla write stream byte-identical under the mutation (md5 5cfe4d01..., 105 lines both sides), including in the one process that actually diverged. Resource effects are absolute, state-bridge's emitResource re-filters no-ops, and the golden replay validates settled state — so a bug of this exact shape is absorbed twice over. The report's "the build's first-touch-order claim rests on an effect list that is NOT pinned" is a fair coverage statement; its implied consequence for the corpus is not supported, and I could not make any golden, hash or trace move.

WHERE THE ACTUAL COST LIVES — THE HALF NOBODY EXERCISES. undeclChanged == 0 across all 54,824 calls. The `!declared.has(name)` clause exists to stop an undeclared name reaching src/team/resources.js `writeResource`, which THROWS BattleError ("the resolver will not create one mid-battle"). Because effects are applied in list order with no rollback, that throw lands mid-list: the armour writes already applied, hitpoints not, the action half-resolved — exactly the partial-write hazard the docstring at ss2-rules.js:967-969 names. The suite reaches undeclared names 400 times but ALWAYS with before === after, so it never once tests the refusal it documents. That is the guard clause with real teeth and zero coverage, and this mutation's green result is what exposes it.

THE FIX THIS ARGUES FOR. Not "pin the effect list exactly" — that would freeze incidental structure. Pin membership where it carries meaning (assert the emitted resources are exactly the fields that changed) and, more importantly, add the missing negative test: a target whose blueprint omits a resource the rule set then changes, asserting BattleError and that no partial writes landed. The second test is the one that would have died here; the first is the one that would have killed this mutant.

PROCESS NOTE FOR THE AUDIT. This mutant is a true survivor but a LOW-severity one, and the report's own evidence could not distinguish that from a high-severity one because it stopped at the effect list and never followed the effects downstream. A survivor's severity is a separate measurement from its survival, and only the downstream diff settles it.

### 8. `src/team/rng.js:242` — CONFIRMED-SURVIVOR

```
- : Math.min(max, min + Math.floor(advanced.unit * (max - min + 1)));
+ : Math.min(max, min + Math.floor(advanced.unit * (max - min)));
```

**What it attacks.** Classic off-by-one on the only seeded integer derivation in the project: the top of every randomBetween range becomes unreachable and every drawn value shifts. Attacks 'same seed + same ordered requests => same values', which is what local 1v1/2v2/3v3 play and every stored seeded replay rest on. I expect NOTHING to catch it: the pinned hashes are all at cursor 0 so no seeded draw feeds them; test/team-resolver.test.js:108 and :1492 compare a replay against a live run of the same mutated code; and test/ss2-team-rules.test.js:633-665 (`bothPaths`) takes its tape FROM a seeded probe, so both sides move together. The test that SHOULD catch it does not exist — a pinned seeded draw sequence, or a hash pinned after N actions.

**Cost, as the verifier put it.** A real bug of this shape silently DELETES GAME MECHANICS while every test stays green. I measured it end to end, not by reading: 30 seeded hot-seat fights (`node tools/hotseat.mjs --seed 1..30 --hp 60 --rules ss2`, identical scripted input), run once with the pristine rng.js and once with the mutation.

  ORIGINAL: 12 HIT (critical), 315 HIT (normal); directions drawn 1:136 2:126 3:132 4:115
  MUTATED:   0 HIT (critical), 330 HIT (normal); directions drawn 1:198 2:159 3:165, direction 4 NEVER

Critical hits stop existing, and one of the four strike directions in every attack band stops existing. The mechanism is that top-of-range becomes unreachable, and the SS2 rules read that top value as a discrete branch, not as a magnitude:
- Criticals: `dispatchedMethod` is "critical" only when `criticalSample === 20`, and the critical rolls are randomBetween(1,20) / (5,20) / (-20,20). 20 is unreachable => the critical branch is dead. Confirmed in play above: 12 criticals become 0.
- Knockback: `knockbackRoll = randomBetween(1,4)` fires only when `knockbackRoll > 3`. 4 is unreachable => knockback is impossible for directions 5..12 (only direction 30 grievous still knocks back).
- Attack direction: bands are quick 1..4, normal 5..8, power 9..12, so directions 4, 8 and 12 never occur — a strike location the player can see is gone, and armourGroup(direction) targeting skews with it.
- Armour removal: `randomBetween('armour-selection-N', 1, group.length)` can never select the LAST piece of a group, so one armour slot becomes permanently immune to removal.
- Damage: `randomBetween('normal-damage-roll', min_damage, max_damage)` can never roll a weapon's maximum, so every weapon in the game is quietly capped one point below its stated top damage.

What it does NOT touch is the part that would have screamed: the 23 promoted goldens and the 1v1 golden harness replay in TAPE mode through src/golden/ordered-rolls.js, which has no generator, so no golden and no capture-manifest digest moves. That is exactly what makes this the expensive shape for this project — the measured corpus stays green and silent while the seeded path that actually runs local 1v1/2v2/3v3 play drifts. rng.js's own docstring promises "Same seed + same ordered requests => same values", and nothing in 816 tests asserts it.

Concretely for this repo: any seeded-play regression here ships undetected; a version-skewed peer (one side patched, one not) desyncs on the first draw with no test to catch the skew; and every future "seeded battle" fixture would bake the wrong distribution in as if it were measured. The cheap guard the suite is missing is one pinned seeded draw sequence (or a hash after N seeded actions) checked against a literal, plus replacing the bounds-only `attackDirection >= low && <= high` assertion at test/ss2-team-rules.test.js:508 with one that requires the band's endpoints to be reachable.

## The other 29 survivors

Not individually verified — the verifier budget was 8, and **a capped wave is
complete-as-run, never complete-as-asked.** Treat each as a REPORTED survivor,
not a confirmed one, and re-run before acting:

| file:line | mutation | area |
| --- | --- | --- |
| `src/team/rng.js:96` | `} else if (!Number.isSafeInteger(sample.value) || sample.value < sampl` | rng-and-hash |
| `src/team/rng.js:230` | `if (sample.label !== label || sample.source !== source || sample.max !` | rng-and-hash |
| `src/team/resolver.js:510` | `rngCursor: 0,` | rng-and-hash |
| `src/team/resolver.js:540` | `turnCursor: 0,` | rng-and-hash |
| `src/team/settlement.js:229` | `false ||` | settlement-and-elimination |
| `src/team/settlement.js:182` | `if (this.#pending.completionToken === record.completionToken) {` | settlement-and-elimination |
| `src/team/controllers.js:92` | `if (false) {` | settlement-and-elimination |
| `src/team/settlement.js:250` | `if (this.#onSettle) this.#onSettle(this.#settled);` | settlement-and-elimination |
| `src/team/settlement.js:124` | `return true;` | settlement-and-elimination |
| `src/team/controllers.js:60` | `if (false) {` | settlement-and-elimination |
| `src/team/controllers.js:63` | `const resolvedId = id || kind;` | settlement-and-elimination |
| `src/team/elimination.js:44` | `down: alive - total,` | settlement-and-elimination |
| `src/golden/run-1v1-fixture.js:256` | `// assertAllowedKeys(combatant, COMBATANT_KEYS, path);` | golden-gates |
| `src/golden/promote-1v1-golden.js:451` | `if (!session) {` | golden-gates |
| `src/campaign/store.js:405` | `return this.#backend.flush() !== false;` | campaign-persistence |
| `src/campaign/to-battle.js:151` | `if (false) next.maxHealth = outcome.maxHealth;` | campaign-persistence |
| `src/campaign/record.js:490` | `if (!Number.isFinite(outcome.health) || outcome.health < 0) {` | campaign-persistence |
| `src/campaign/circuit.js:212` | `void endValue;` | campaign-persistence |
| `src/campaign/store.js:571` | `migrated: migration.applied.length >= 0` | campaign-persistence |
| `src/campaign/vanilla-boundary.js:231` | `if (false) {` | campaign-persistence |
| `src/campaign/vanilla-boundary.js:217` | `return typeof key === "string" && key.startsWith(KEY_PREFIX) && key.le` | campaign-persistence |
| `src/adapter/state-bridge.js:937` | `if (false) {` | adapter-boundary |
| `src/adapter/state-bridge.js:786` | `if (false) continue;` | adapter-boundary |
| `src/adapter/state-bridge.js:483` | `return value;` | adapter-boundary |
| `src/adapter/state-bridge.js:943` | `if (false) {` | adapter-boundary |
| `src/adapter/slot-layout.js:214` | `if (combatants.length > MAX_SLOTS_PER_SIDE + 1) {` | adapter-boundary |
| `src/adapter/slot-layout.js:264` | `if (seen.depth.has(placement.shadowDepth) && placement.depth === place` | adapter-boundary |
| `src/adapter/slot-layout.js:118` | `return fighterDepth(side, slotIndex) - 1;` | adapter-boundary |
| `src/adapter/presentation.js:193` | `if (!Number.isFinite(direction)) return label("attack5", LabelProvenan` | adapter-boundary |

## Three structural findings the targeting agents returned, outranking their tasks

1. **`src/team/controllers.js` has ZERO negative tests.** `ControllerError`
   appears nowhere under `test/`, and neither does its message text — so every
   throw in that file is a candidate survivor, and three of them are confirmed
   survivors above.
2. **The pinned literal combat-state hashes are all taken on battles with NO
   action applied** — cursor 0, turnCursor 0, result null, events []. They pin
   field PRESENCE and any value that varies at construction, and pin NOTHING
   whose value is 0/null/[] before the first action. That asymmetry is what most
   of the confirmed survivors exploit. Every other hash assertion in the suite is
   RELATIVE (rebuilt vs live, forced vs baseline), so it moves with the mutation
   on both sides and cannot catch a change to a derivation both sides share.
3. **Dead API surface**: `OrderedRngChannel.snapshot()` and `remainingCount`
   have zero callers in `src/` or `test/`; `teamStanding`'s `total` and `down`
   have no consumer anywhere; and `CampaignSettlement.arm`'s `#pending` branch
   is unreachable in production because the resolver returns early on
   `battle.result`.

## What this does NOT say

- It does not say the engine is wrong. Every mutation was DELIBERATE; the
  question was only whether a test would notice.
- It does not say the corpus is unsound. The promotion gates killed their
  mutants, and the goldens themselves are evidence files, not code.
- It does not rank the survivors by real-world likelihood. A survivor is a
  COVERAGE fact; whether the bug it models would ever be written is a separate
  judgement, and the verifiers made it only for the eight above.
- **It measured 48 mutations, not the whole space.** The targeting agents
  deliberately EXCLUDED mutations they could show were already killed, so the
  11/48 kill rate is a floor on the suite's quality, not an estimate of it.
