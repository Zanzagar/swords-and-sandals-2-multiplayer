# The team battle UI: HUD, action dock and targeting across ranks

**Status:** designed 2026-09-24 at the owner's request ("fighter UI elements … design/space for
additional buttons due to the ability to attack others/other lanes … design this visually and
technically well"). Nothing below is built yet. The visual design is the Artifact canvas
**Team Battle UI** (https://claude.ai/artifact/GCRMqD9qVoqWazVTqgWDVa; private until shared). It has
five artboards: the battle screen (interactive), targeting across ranks, HUD parts, phone, and how
it is built.

## The rule the design carries

**The engine decides what is possible; the interface only arranges it.** Every enabled control is an
action `host.legalActions()` offered this turn, and every number shown comes from the functions the
engine resolves with. Nothing is enabled that the engine did not offer.

## What exists today (measured 2026-09-24)

- `tools/arena/main.js renderControls` draws one HTML button per legal action, labelled with the raw
  engine token and the target baked in (`cast-lightning-bolt -> Nym`). A 3v3 turn offers up to 23
  options: for example, with the tricks kit, seed 3, after 14 actions, red-2's 23. They form a flat
  wall.
- The HUD is a DOM roster with an HP number and bar. Stamina, armour, the crowd and the turn order are
  invisible, and raw status tokens such as `facing-left` are shown.
- The build's own HUD (`combat_panel`, sprite 751) is hard-wired to one hero and one villain. Per side
  it shows a health vial (`hp / max`), an energy vial and an armour gauge, plus one crowd bar with ten
  mood words (`crowd: <mood>`, index `ceil(interest / 10)`), mapped by wave `wf_e90ae76e-4af` (q4).

## Targeting: three cases, all from the engine's own offer

| Case | Who can be targeted (engine rule) | UI behaviour |
| --- | --- | --- |
| Melee (quick, normal, power), shove, bash | a foe in the actor's OWN rank and in reach (`ss2SameLane` plus reach) | one foe: auto-selected, no target step |
| Taunt | any foe in the actor's own rank (owner rule, 2026-09-23) | as above |
| Spells, bombard, snipe | any living foe, any rank (snipe can be body-blocked) | numbered gold rings, pick 1–3 |
| Walk, rank change, rest, win the crowd, swap, teleport, potion | self | no target step; rank changes preview the destination |

Unreachable foes stay visible, dimmed, with a reason. Unavailable actions keep their slot, dashed,
with a reason, so buttons never move between turns.

## Components

- **Action dock**: four fixed groups of up to six slots: Fight (melee or bow verbs), Spells & items
  (exactly the six inventory slots), Move (walk ←/→, rank ↑/↓; charge and jump reserved), Tactics
  (taunt, win the crowd, psyche up, swap weapon, rest). Each button shows its label, a one-line
  preview (to hit · damage · energy) and a hotkey.
- **Preview panel**: the chosen action and target with to-hit, damage and energy; Confirm (Enter) and
  Back (Esc).
- **Team panels**: one row per fighter with health, energy, armour, rank, weapon and condition chips.
  States: acting, waiting, valid target, not a target, hurt, tired, conditions, down.
- **Turn-order strip** and **crowd meter**: the build's ten moods, with the 20 / 70 thresholds where
  boos and chants become possible.
- **Stage overlay**, painted on the canvas from the same model: a bronze ring on the actor; dashed
  gold numbered rings on valid targets; dimmed foes with a reason tag.
- **Phone**: HUD compressed to two bars over each head; the dock becomes a bottom sheet with four
  tabs; tap a fighter to target.

## Architecture

```
engine legalActions()  ──►  actionMenuModel (NEW, pure, src/render/action-menu.js)  ──►  dock + HUD (DOM)
engine previewAction() ─┘        groups, stable slots, target sets, reasons, hotkeys   └─► stage overlay (canvas)
engine unavailableActions() ┘                                                            host.submit(...)
```

- `actionMenuModel(legal, previews, unavailable, view)` is pure and tested. It is fed the legal
  actions of real seeded bouts: every offered action appears exactly once and enabled, and nothing
  else is enabled.
- **Engine additions (small, pure, not hashed, no RNG):**
  - `previewAction(action)`: hit chance (`calculateSs2AttackChances`), damage band
    (`ss2ActiveDamagePair` and the band rule: quick = min, normal = min–max, power = max), energy
    (`ss2SwingCost`, `round(magicka)` for casts, `round(strength × 1.5)` for shove), and the effect
    kind.
  - ~~`unavailableActions(actor)`: the verbs `legalActions` withheld, with a reason code (`other-rank`,
    `out-of-reach`, `body-blocks`, `in-reach` for taunt, `level`, `slot-empty`, `no-ammo`, `wall`).~~
    **`unavailableActions(actor, target)`** — who-first: the build's ring for the stance measured to
    the SELECTED foe, every verb on it, and one reason on each the engine does not offer. The codes,
    re-derived from the offer, are in `SS2_UNAVAILABLE_REASONS` with their hide/grey split;
    `out-of-reach` and `wall` are not offer gates (a far foe puts the ring on the long frame, which
    has no melee buttons; a walk into the wall is offered and goes nowhere), and `in-reach` covers
    every long-range verb a close TURN withholds, not only the taunt.
  - A test pins that the preview equals what resolution uses.
  - **Built 2026-09-24:** `ss2PreviewAction`/`ss2UnavailableActions` in `src/team/ss2-rules.js`,
    `previewAction`/`unavailableActions` in `src/team/resolver.js` and on the host;
    `test/ss2-action-preview.test.js`. The damage band comes from the attacker record resolution
    builds (`vanillaRecordOf`), not `ss2ActiveDamagePair` alone, and no spell shows a `magicka`
    chance: none can miss.
- **Targeting state machine**: Idle → Action chosen → (Choosing target) → Ready → Sent. Esc steps back
  one state. The existing per-action animation gate keeps the dock read-only while the arena plays
  the last action.
- **Accessibility**: real buttons; the keyboard map (Q W E R fight, 1–6 slots, A D walk, ↑ ↓ rank;
  while targeting, 1–3, Tab, Enter, Esc); every state change announced in an aria-live region.

## From the build, or authored for team play

- **From the build:** which verbs a stance offers (the eight controller slots per frame; battle map
  "Buttons wired per controller frame"), hit chances, damage, energy costs, the three HUD readings,
  the crowd's ten moods and its 20 / 70 thresholds, and the damage pop-ups (built, 62b9cdd).
- **From the build, the buttons themselves** (`src/render/action-buttons.js`, 2026-09-24): the icon
  frame of every verb per facing on the overlay's eight slots, their up/over background, the swap slot
  and the six-button items-and-spells row (`inventory_buttons` by item or spell id), and where the
  overlay stands — on the acting fighter, 180 above his feet, scaled to cancel the camera, and at the
  midpoint with a close-up copy of the hero once the two stand 1,600 or more apart. The art is the
  player's own icon pack (`node tools/extract-icons.mjs`); the slot positions are relayed until a pack
  carries `buttons.layout`.
- **Authored:** the four groups, the target step and reason codes, a row per fighter, rank lanes, the
  turn-order strip, the keyboard map and the phone layout — and, for the buttons, a disabled look (the
  build hides what it will not offer), the rank ↑/↓ verbs (no build art), and a round fallback button
  for a clone without a pack.

## The in-battle actions: DECIDED by the owner, 2026-09-24 (a grilling round, 3 rounds, 8 questions)

This supersedes the dock-first design above wherever they differ. The build's own layout was mapped
first (ab5feb5, `src/render/action-buttons.js`).

1. **The ring is the original's**, adapted for team play: its eight buttons around the acting fighter
   with the build's slot assignments and icons per stance (close/long range × warrior/archer), the
   build's ninth button (weapon swap) and its six-slot items row above the head for spells and potions.
2. **WHO FIRST** (Q4): a foe is always selected (gold ring); it stays selected between turns while valid,
   else the nearest foe in your own rank. Click another foe or Tab to switch. The ring's stance, hit
   chances and availability follow the SELECTED foe.
3. **Movement is spatial** (Q5): walk left/right in the original's slots on the side they move toward;
   authored rank arrows — step back above the head, step forward below the feet.
4. **One click acts** (Q2), as in the original; hovering shows the verb and its hit chance; an optional
   "confirm every move" setting adds Confirm.
5. **Unavailable buttons** (Q6): HIDDEN where the original hides them (stance, level); GREYED with a
   hover reason where the team rules forbid them (other rank, out of reach, blocked).
6. **No resting while a foe is in reach** (Q7), matching the original's close-range layouts — an ENGINE
   change, measured for its AI effect in its own commit.
7. **Jump and charge stay hidden** (Q8) and get their own design pass.
8. **AI turns** (Q3): normal speed, a hold-to-speed-up key and "skip to my turn".
9. **The strip under the stage** carries the same actions for the keyboard (1–8 slots, Tab targets,
   arrows move) and screen readers, shows the selected target's odds, and hosts Confirm when that
   setting is on.

### Slices (vertical, each playable; tracked on the board)

- **S1** no rest in reach (engine) · **E** `previewAction` + `unavailableActions` (engine)
- **S2** the ring's core: the who-first selection model, eight slots per stance, one-click, Tab, the
  keyboard strip — drawn with the authored fallback buttons (the tracer bullet)
- **S3** the build's own button art and placement on the ring · **S4** movement (walk slots, rank arrows)
- **S5** the items row · **S6** the weapon swap button · **S7** hover previews and the confirm setting
- **S8** AI pacing (speed-up, skip) · **S9** greyed-button reasons (needs E)

### S2, built 2026-09-24: what it does, and what it decided that the owner did not

`tools/arena/ring.js` (the model: who is selected, the stance, the eight slots, the list off the
ring, what a click or key sends), `tools/arena/ring-layout.js` (where the buttons are drawn, what a
click hits), wired in `tools/arena/main.js` and `tools/arena/index.html`. Tests:
`test/arena-ring.test.js`, `test/arena-ring-layout.test.js`, `test/arena-ring-bouts.test.js`,
`test/arena-ring-wiring.test.js`.

- **The stance is the engine's**, not re-derived: `host.unavailableActions(actor, selectedFoe)`
  measures it to the selected foe (the build's controller selector, overlay frame 4, in
  `ss2UnavailableActions`). ~~"the build's own rule as `action-buttons.js` records it"~~ —
  `action-buttons.js` records the four stances' LAYOUTS, not the rule that picks one. The layouts
  the engine returns are checked against `action-buttons.js`'s independently transcribed
  `SS2_BUTTON_WIRING` on every turn of 20 seeded bouts, every foe selected in turn.
- **A slot shows its verb only when the engine offers the action** (S2; hidden-vs-greyed is S9),
  and sends the offered option itself. Everything else offered against the selected foe or the
  actor — rank changes, the swap, spells, potions, a rest beside a taunt — is listed under the stage
  until S4-S6 give it a place on the ring. An action at ANOTHER foe is reached by selecting him. The
  suite proves the coverage: over whole bouts, the union over every selection is exactly the offer,
  and no selection lists an action twice.
- **Who first** is the owner's Q4, **per fighter** (authored): each fighter keeps his own last
  target, because one person playing three fighters in three ranks fights three foes. "Nearest" is
  the engine's fight distance, ties by id, as the engine's own `nearestFoe` breaks them.
- **Keys (authored):** 1-4 down the ring's left column, 5-8 down its right, computed from the slot
  positions. Tab / Shift+Tab switch the target left to right across the stage, wrapping — from the
  stage only (the page or the canvas, which now takes focus), and only with a second foe; inside a
  button or the volume slider Tab stays the browser's, so nothing traps the focus. Esc moves the
  focus from the stage into the strip. A held digit acts once; Ctrl/Alt/Meta are the browser's.
- **The look (authored, S3 replaces it):** `actionButtonFallbackOpsFor`'s round bronze buttons with
  the key and a short label on the ring's outer side; a gold ellipse on the sand under the selected
  foe. The ring stands where the build's does, 180 above the actor's feet, at the relayed slot
  positions, drawn at `RING_STAGE_SCALE` 1.2 stage pixels per overlay pixel — inside the build's own
  0.9-1.4 (`flipoverlay × maxscale`, computed in the test). No close-up at 1,600 apart: that is S3.
- **The strip** is a fixed 132 px under the stage (so the stage does not resize between turns),
  hidden when spectating: the target (one pressed button per foe), the ring's actions with their
  keys, the rest of the offer, a status line, and a polite live region announcing each person's turn
  and each change of target. A button that had the keyboard focus when the strip was rebuilt hands
  it back to the strip on the person's next ready turn (DOM glue, not under the suite).
- **Unchanged:** an AI seat's turn never builds the ring, and a spectated bout's state-hash sequence
  is the same with the ring built for every fighter against every foe on every turn (tested). The
  raw one-button-per-action list survives only as the fallback for a rule set with no menu to ask.
- **Not seen:** no agent may open a browser, so the page was never looked at. Screenshot
  `?play=red&teams=3&items=tricks` (and a 1v1) before trusting the layout.

## Delivery order

1. **Seats**: choose which fighters a human plays, with the rest AI (~~e.g. `?red=human&blue=ai`~~
   **`?play=red`, or `?play=red-1,blue-2` for single fighters** — `red=`/`blue=` already name the
   tournament champions, and `?red=human` is refused there as "not a which_boss number"), using
   the existing ControllerRegistry. This is the first time anyone can play against the AI. **Built
   2026-09-24:** `tools/arena/seats.js`, `test/arena-seats.test.js`; `?spectate=1` now declares every
   seat AI through the same registry.
2. **Action dock**: the model and the four groups replace the raw buttons.
3. **Targeting overlay**: rings, numbers, dimming, and the one-target shortcut.
4. **Team HUD**: fighter rows, the turn strip and the crowd meter.
5. **Previews and reasons**: the two engine additions.
6. **Phone**: once the desktop version has been played.

No slice may change combat state, a hash or a random draw. The golden census proves it on every merge.
