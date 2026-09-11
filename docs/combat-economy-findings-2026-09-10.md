# Combat economy: two defects that outrank the 3v3 design

**Measured 2026-09-10 by the main session, in the shipped engine at `e365acf`.**
Both are 1v1 properties that 3v3 inherits and multiplies. Neither is caused by
position, and neither is fixed by any positional rule. **They were found while
designing 3v3 positional combat, and they are the reason that design is not
worth tuning yet.**

Every number below is reproducible from this repository with no capture, no
Windows and no Ruffle. Commands are given so the next reader re-derives rather
than believes.

---

## D1 — A BOUT NEED NOT TERMINATE

**4,000 consecutive mutual `rest` actions leave `battle.result === null`.**

```
actions applied: 4000 | battle.result: null | turnNumber: 2001 | events: 4000
```

`checkResult` decides only on elimination (`battleStanding`) and `advanceTurn`
has no cap, so two combatants who both decline to attack are a fixpoint the
resolver will walk for ever. Nothing in the engine makes a stalled bout end,
and nothing makes one *converge*: `rest` is stamina-positive and heals, so both
sides strictly improve.

**This is not a hypothetical griefing scenario.** It is the terminal state any
anti-kiting rule has to argue against, and three of four independent 3v3
designs built a positional layer on top of it without noticing.

**Re-derive it:**
```js
// drive 1v1 with both sides choosing `rest` every turn; assert battle.result
```
Construct a 1v1 under `ss2TeamRules`, take `legalActions(...).find(o => o.type === "rest")`
each turn, apply 4,000 of them, print `battle.result`.

**The fix is a DECISION, not a repair**, which is why nothing here pins it:
vanilla ends a stalled fight through the crowd and a `taunttimer` watchdog
(`+0x67e4`, 60 ticks), and which of those this engine adopts is a balance
choice the owner has not made. **Do not pin the current behaviour with a
test** — that would freeze the defect.

---

## D2 — STRENGTH IS A TRAP; STAMINA IS THE ONLY STAT

**Measured, real engine, 39 actions:**

```
b1 (strength  7, stamina 60): stamina 400 -> 400   health 400 -> 400   WINS
r1 (strength 30, stamina  5): stamina 400 ->   0   health 400 ->   0   dead
```

The weak gladiator beat the strong one **without losing a single point of
stamina or health.** Three pieces of map arithmetic combine:

| term | value | offset |
| --- | --- | --- |
| `power_attack` stamina cost | `round(strength * 3)` | `+0x603c` |
| per-phase stamina regen | `1 + round(stamina / 3)` | `+0x32c9` |
| per-phase heal | `1 + ceil(stamina / 2)` | `+0x3305` |
| attack damage | `round(strength * 2) + weapon_max_damage` | `+0x3386` |

So **an attack is free for ever whenever `round(strength * 3) <= 1 + round(stamina / 3)`**
— true at strength 7 / stamina 60 (21 vs 21), strength 5 / stamina 45 (15 vs
16) — while the 31 HP/phase heal outpaces most incoming damage.

**Strength buys 2-15% of damage and 100% of the cost of attacking**, because
`weapon_max_damage` swamps the `round(strength * 2)` term:

| strength | damage with weapon 20 | power cost | strength's share of damage |
| ---: | ---: | ---: | ---: |
| 7 | 690 | 21 (free at stamina 60) | 2.0% |
| 30 | 736 | 90 | 8.2% |
| 60 | 796 | 180 | 15.1% |

### The shop gate mitigates this and does NOT close it

The build gates weapon PURCHASE on a stat, byte-verified at
`docs/integration/ss2-item-tables.md:530-552` (`onRelease` `+0x0929`-`+0x0941`):

> `3 * band_position <= hero.speed` for slashing (1-20) and ranged (61-80),
> `3 * band_position <= hero.strength` for hacking (21-40) and bashing (41-60).

Importing that into the roster builder is a **measured** constraint, not an
authored balance patch, and it does kill the pure dump build: at strength 7 /
agility 0 only 4 of 80 weapons are buyable and the best does 34 damage.

**But it moves the requirement rather than restoring the trade.** Slashing and
ranged gate on *speed*, so **strength 7 / agility 60 buys weapon 20 (676 max
damage) and still attacks for free.** Measured: 44 of 80 weapons buyable, 690
damage, cost 21 against regen 21.

*(An independent design panel judged that the shop gate "restores the trade".
Re-derived here: it does not, and the reason is that the weapon term dominates
the strength term. Recorded because the claim is attractive and wrong.)*

### Why vanilla does not have this problem, and why we do

Vanilla never hands a player a free stat allocation. Stats are earned over a
campaign against a budget (`speed = (13 + 4 * herolevel) - (pinned stats + stamina + vitality)`,
map ~:2265) and weapons are bought with gold as that budget grows, so the
degenerate corner is reached slowly if at all. **This engine lets a blueprint
declare any stats it likes**, which is correct for a multiplayer foundation and
is exactly what exposes the corner.

So the fix is NOT a fidelity question and must not be argued as one. It is a
balance decision about what a *constructed* gladiator may declare.

---

## What this means for 3v3

**3v3 multiplies both.** D1 gets worse with six combatants (more ways to
stall, and a team need only have one staller). D2 gets worse because a team of
three free-attacking dump builds out-damages and out-heals three invested ones
while spending nothing.

**Ranked consequence: the 3v3 positional design is specified but not worth
tuning until D1 and D2 have owner decisions.** A positional rule set tuned
against a broken economy is tuned against the wrong game.

---

## Provenance

Found by a 13-agent design panel (4 designs, 8 adversaries, 1 judge; 0 dead)
whose brief was 3v3 positional combat. **Every number above was re-derived by
the main session before it was believed**, and two of the panel's claims did
not survive that: "the shop gate restores the trade" (it does not, above) and
the framing of D2 as a design problem rather than a shipped-engine property.
The panel's merged 3v3 design is in the run journal and is NOT recorded as a
result here, because it rests on D1 and D2.
