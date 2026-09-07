# Stage 7 host-authoritative transport — what a design panel found, 2026-09-07

**The designs are not the deliverable. What the panel measured about the
ENGINE AS IT STANDS is.** Five independent designs, three judges on distinct
axes, an adversarial risk auditor and a completeness critic — 13 agents,
`started == returned` 13/13, zero deaths, all write-nothing.

**The headline is that the exercise's own framing was false, and the critic
that said so outranks everything the five designers produced.** That is
recorded first, because it is the finding.

## THE FRAMING WAS WRONG, TWICE, AND IT WAS MINE

I briefed the panel that host-authoritative transport is "the last unstarted
engineering item on the roadmap that is not an owner-owned balance or
progression decision." Both halves are false.

1. **It is not the last.** `docs/roadmap.md`'s own not-started column still
   names the RENDERED ARENA — six-slot geometry is derived and emitted as
   inert JSON presentation commands, and *nothing draws them* — and CAPTURE
   BREADTH: 37 of the 60 committed candidates have no golden, and the spell
   family has never been captured. Neither is a balance decision.
2. **Stage 7 is itself partly OWNER-OWNED.** EP-D07 was accepted by the owner
   on 2026-09-03 and lives on the unmerged
   `design/endless-progression-owner-packet` branch — **so it is invisible to
   a grep of the checked-out tree, which is exactly why five agents and I all
   missed it.** It names session topology, presence mechanism, timer duration,
   durable timer representation and reconnect-versus-abandon serialisation as
   unresolved readiness blockers.

**And EP-D07 forbids, in as many words, the one behaviour all five designs
made their headline reconnect story: "The AI never assumes control."** It
requires a durable mid-battle pause and reconnect instead, plus authenticated
liveness detection — which every design explicitly declined to build. Five
designs, one excluded behaviour, five times.

**The lesson generalises past this exercise: an accepted owner decision that
lives on an unmerged branch is invisible to every agent that greps the tree.**
Read the decision record with `git show`, do not check that branch out (its
`AGENTS.md` is ~156 commits stale), and do not assume a clean grep means no
decision exists.

## WHAT THE PANEL MEASURED ABOUT THE ENGINE — the durable part

Each of these was re-derived by the main session before being written here.

### 1. Settlement can be armed on a battle that was never fought

Re-derived by hand, not relayed. On a freshly constructed battle —
`result: null`, `events: []`, every combatant alive — this is ACCEPTED:

```js
battle.settlement.arm({
  winnerTeamId: "red", loserTeamIds: ["blue"], reason: "elimination",
  completionToken: `team-arena:red:blue:elimination:${combatStateHash(battle)}`,
  battleDiscriminator: combatStateHash(battle),
});
// => armed:true, pending winner "red", battle.result still null, nobody dead
```

**Today this is not an exploit**, because the only production caller is the
resolver, on a real result, and a hot-seat player cannot reach it. **It is a
statement about whether the seam is ready for an untrusted caller, and it is
not.** Any transport that lets a peer's message reach `arm()` hands that peer
the power to declare itself the winner of a battle nobody played.

### 2. Three different hashes name ONE bout, and settlement is inside the hash

`toTeamWireState` carries `settlement: battle.settlement.toJSON()`, so
acknowledging a settlement MOVES `combatStateHash`. One bout therefore has an
arm-time discriminator, a post-final-action hash and a post-acknowledgement
hash — three distinct values. **Four of the five designs used "compare the
hash" as their central consistency check without knowing this**, so all four
would have broken on their first completed bout.

### 3. `applyAction` is non-atomic in the RESOLVER, not only inside a rule set

All five designs asserted the resolver's three refusals are its only failure
modes and ordered their validation around that. The auditor reproduced a
resolver-internal throw AFTER the RNG draw, and — in the `applyEffects` case —
after combatant health had already been mutated, leaving the host
**unreproducible from its own log**. A transport that retries or resyncs on a
throw must know which of the three throw classes it is in.

### 4. `toTeamWireState` has no inverse

`grep` for any `fromTeamWireState` / `hydrate` / `rehydrate` / `restoreBattle`
returns nothing. The projection is one-way, so a design whose recovery path is
"send the full state and rehydrate" is proposing a function that does not
exist and is not trivial to write.

### 5. Controller ids are not unique per seat

Three designs authorise a message by `identityFor(seatId).id === peerId`.
Controller identity does not guarantee one id per seat, so that check is
bypassable as stated. Authorisation needs a seat-scoped credential the engine
does not currently mint.

### 6. The rule set cannot cross the wire

There is no id → rule-set registry in `src/`. A blueprint carrying a
JSON-round-tripped rule set **silently falls back to placeholder rules** — two
peers can believe they agreed on SS2 arithmetic while one of them is running
the placeholder. And the wire projects only four of the eight rule-set
descriptor fields: **`buildSha256` is not among them, so two peers deriving
their arithmetic from DIFFERENT licensed builds hash identically.** The at-rest
campaign record is stricter than the wire here.

### 7. `src/adapter/` is reached almost entirely by tests

Measured by the main session, because the critic's figure was wrong. The
directory is **4,052 lines** (not the 2,192 reported). Of its nine modules,
**exactly one — `vanilla-fields.js` — has a real consumer outside
`src/adapter/` and `test/`** (`src/campaign/vanilla-boundary.js`).
`battle-host.js`, `state-bridge.js`, `slot-layout.js` and `presentation.js`
each have ZERO. Four of the five designs proposed `VanillaBattleHost` as their
engine port. **The critic's shape was right and its number was wrong, which is
this project's most common finding about its own agents' output.**

## The judges disagreed, and the disagreement is informative

| axis | first choice |
| --- | --- |
| correctness and silent-desync risk | the staged 7a–7c design (fake link, desync report) |
| cost to build and to live with | the controllers.js seam — smallest change to tested code |
| fit with this repository's rules | the action-log-as-wire design |

No design won two axes. The cost judge and the correctness judge inverted each
other's top and third picks. **Treat that as evidence the decision is genuinely
open, not as a tie to be broken by averaging.**

## The recommendation

**Do not start Stage 7.** Not because the designs are bad, but because
EP-D07 is the owner's and unresolved, and because the ranked alternatives —
the rendered arena, and capture breadth at 37 of 60 candidates without a
golden — deliver more player-visible value per line and are not blocked on a
decision.

**What IS worth doing from this exercise, and is not blocked**: close finding 1
(refuse `arm()` on a battle with no result), and mint a seat-scoped credential
(finding 5). Both are small, both are the engine's own correctness rather than
a transport, and both must exist before any Stage 7 design can be safe.

## What this document does NOT claim

- It does not claim the five designs are wrong. Three of the seven findings
  above came out of writing them; the exercise paid for itself in what it
  falsified, not in what it proposed.
- It does not claim finding 1 is a live vulnerability. It is a readiness fact.
- The panel did not read the campaign layer a co-op transport must survive, and
  did not ask whose campaign a shared battle belongs to. That gap is unclosed.
