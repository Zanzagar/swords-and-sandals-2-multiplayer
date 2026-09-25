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

<a id="decided-ring-2026-09-24"></a>

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
8. **AI turns** (Q3): normal speed, a hold-to-speed-up key and "skip to my turn" (built: S8, below —
   the key is Shift).
9. **The strip under the stage** carries the same actions for the keyboard (1–8 slots, Tab targets,
   arrows move) and screen readers, shows the selected target's odds, and hosts Confirm when that
   setting is on.

### Slices (vertical, each playable; tracked on the board)

- **S1** no rest in reach (engine) · **E** `previewAction` + `unavailableActions` (engine)
- **S2** the ring's core: the who-first selection model, eight slots per stance, one-click, Tab, the
  keyboard strip — drawn with the authored fallback buttons (the tracer bullet)
- **S3** the build's own button art and placement on the ring · **S4** movement (walk slots, rank arrows)
- **S5** the items row (built, below) · **S6** the weapon swap button (built, below) · **S7** hover previews and the confirm setting (built, below)
- **S8** AI pacing (speed-up, skip; built, below) · **S9** greyed-button reasons (needs E; built, below)

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
  and sends the offered option itself. **S9 (below):** ~~only when the engine offers the action~~ — a
  slot the engine withholds for a TEAM rule shows its verb too, greyed, sends nothing and says why; one
  it withholds for a reason the build hides is still empty. A slot still SENDS only what is offered. Everything else offered against the selected foe or the
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
  0.9-1.4 (`flipoverlay × maxscale`, computed in the test). ~~No close-up at 1,600 apart: that is
  S3.~~ **S3 replaced the buttons and the size, and did NOT draw the close-up** — see "S3, built"
  below; the authored buttons and `RING_STAGE_SCALE` remain only as the fallbacks named there.
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

### S3, built 2026-09-24: the build's own buttons, where the build puts them

`tools/arena/ring-art.js` (what each button paints), `ringPlacementFor` and the pack layout in
`tools/arena/ring-layout.js` (where the ring and each button stand), the word and glow on the build's
buttons in `src/render/action-buttons.js`, wired in `tools/arena/main.js`. Tests:
`test/arena-ring-art.test.js`, and the word test in `test/render-action-buttons.test.js`.

- **The art is the build's**, from the player's icons pack: each slot draws character 860 at the
  frame its controller sends that slot to for that verb and facing (power 2 facing right, 13 facing
  left; the psyche slot 26/27/28 from the actor's own counter), over its `battlebutton` background
  (826) — frame 1, or frame 2 under the pointer, the overlay's own rollover. Proven through the
  drawing API for every slot of all four stances in both facings, and over 20 seeded bouts for
  every button drawn for whoever was due. The attack and bow frames' own word (POWER, NORMAL, QUICK,
  SNIPE, BASH, BOMBARD, static runs 829-852) is drawn in the build's glyphs with the placement's own
  dark-red glow, and the bow frames' `ammo_left` shows the actor's arrows, both when a text pack is
  there. **Without the icons pack** (a fresh clone, or a pack from before the buttons section) every
  button is S2's authored one; a pack that cannot draw one verb WHOLE draws that button authored
  alone — a blank frame, or a frame whose icon or background clip or shape the pack lacks, or a
  placement the painter cannot draw (`actionButtonOps`). A word with no text pack is not a missing
  part. ~~A frame missing its icon was drawn as the bare background and called the build's~~ —
  the first S3 build did that; Codex review pass 2 caught it, and it is now under test.
- **The placement is the build's** (`gladiators.onEnterFrame`, sprite 2249 frame 1 body 0x6e4221,
  re-read from an action dump for this slice): the overlay on the acting fighter, 180 above his
  feet, drawn at `view.scale × flipoverlay / 100` canvas pixels per overlay pixel — the zoom the
  fighters are drawn at times the build's table keyed on the TARGET zoom, so while the camera eases
  the ring eases with it as the build's does. `flipoverlay` flips nothing: both facing arms write the
  same positive scale, so the ring is never mirrored; the facing lives only in each slot's frame.
  Each slot stands at the matrix the pack MEASURED at the frame its controller rests on
  (`buttons.layout`), else at the relayed table (on the real pack the two agree within 0.05 px on
  each axis at every resting frame; the test's tolerance is 0.06).
- **Authored, the owner did not decide these:**
  - **A team camera's in-between zoom.** A pair's target zoom always has an arm in the build's table
    (swept over every separation 0-8,000: the fit binds only at 2,991-3,000 apart, at 19, inside the
    `< 20` arm). A team camera targets the fit, any integer, where the build would keep a stale
    `flipoverlay`; the ring takes the on-screen size of the band at or below instead, which stays
    inside the build's own 0.9-1.4.
  - **No close-up.** At 1,600 or more apart the build moves the overlay to the midpoint, grows it to
    600% and shows its own large copy of the hero inside it (`overlay.hero`, sprite 711). No pack holds
    that copy, and a ring at the midpoint around nobody would mark no fighter — so the ring stays on
    the actor at the table's size. `ringPlacementFor` reports `buildClosesUp` for when it would.
  - **The psyche slot's stray.** `closerange_warrior` facing right sends the third psyche frame to
    `optionHG`, so the build's button keeps its old frame at a counter of 3; here it shows 28, as every
    other controller does.
  - Kept from S2: the key and short label beside each button (the build's buttons carry no key), the
    gold ellipse, the hit radius (18 × the slot scale; the build's background is 18.5), and — in the
    FITTED view only, which has no build camera — the authored 1.2 stage pixels per overlay pixel.
- **Owner decisions:** draw the close-up (extract sprite 711's `overlay` frame, or author a stand-in),
  and whether the S2 labels stay now that the build's own art and words are drawn.
- **Not seen:** no agent may open a browser. Screenshot `?play=red` (1v1: the long and close warrior
  frames), `?play=red&teams=3&items=tricks` (team zooms, the archer frames, the bow words and ammo) and
  hover a button before trusting the look.

### S4, built 2026-09-24: movement on the ring

`moves` in the model (`tools/arena/ring.js`), `ringMoveButtonsAt` (`tools/arena/ring-layout.js`), the
arrow keys in `ringKeyCommand`, wired in `tools/arena/main.js`. Tests: `test/arena-ring-movement.test.js`;
S2's `test/arena-ring.test.js` and `test/arena-ring-bouts.test.js` were updated where S4 moved an action
out of the list.

- **Every walk and rank change the engine offers is on the ring, whatever foe is selected, and none it
  withholds is ~~drawn,~~ clicked or keyed** to any effect. ~~A move is on the ring only when
  `legalActions` holds it~~ — **S9 (below) draws one withheld for a team rule, greyed, where it stands
  (the rank reasons `duel`, `no-rank`, `rank-full`, a slotted walk's `in-reach`), and its click and its
  arrow only say why; one withheld for a hide is not drawn.** A move still ACTS only when
  `legalActions` holds it (as a slot does, S2). Proven
  over 30 seeded bouts (1v1, 2v2, 3v3; plain and `tricks`), every foe selected in turn, under the
  arena's own settled camera (a team camera in 4,379 of the 4,740 selections): each offered move drawn
  exactly once, wholly on the stage, and sent by its click and its arrow; each withheld one on no
  button, sent by nothing, and its arrow swallowed; no two buttons overlapping.
- **Walks stay in the build's own slots** — `walkleft` at optionB, left of the fighter, and `walkright`
  at optionE, right of him, in every stance that wires them (`SS2_BUTTON_WIRING`; a test pins it), with
  the build's own icons, their digits (S2) and now their arrows.
- **A walk the stance does NOT wire stands BESIDE its side's walk slot, one pitch in toward the
  fighter (AUTHORED).** The close frames wire only the retreat, but the team engine offers the walk
  toward a foe in reach when he is in another rank, or when there is a foe on each side (the retreat is
  from the nearest). That slot holds a swing, which the engine may offer too (33 selections in 75
  bouts measured) and S9 greys where it does not (built, below), so the walk cannot take it. It stands one pitch
  (31.5 overlay px, the ring's tightest) in from optionB or optionE, at the same height, in the build's
  walk icon — 203 of 16,407 offered walk-selections (1.2%) in those 75 bouts. Rejected: the jump slot (Q8
  keeps it for jumps, and the close warrior frame has no free slot on the walk's side); outboard of the
  column (under the S2 labels).
- **The rank arrows (the owner's): step BACK above the head, step FORWARD below the feet** — on the
  fighter's own line, off his DRAWN head and the bottom of his name, standing off them by the gap the
  ring leaves between two buttons, at the ring's button size, kept on the canvas. They follow the body,
  not the ring, because the ring keeps one size on screen while the fighter shrinks as the camera pulls
  back (the feet are 30-112 overlay px below the ring's centre across the build's zoom table). The
  authored chevrons (`actionButtonFallbackOpsFor`'s `rank_back`/`rank_front`; the build has no rank art).
  Measured under the arena's own settled camera over 30 bouts, every foe selected: the forward arrow's
  lowest edge 353.96 stage px (the UI bar's origin is 401), the back arrow's highest 70.36.
  ~~350.6 and 70.4~~ — my first measurement fed the camera bare x values instead of the `{x, side}`
  the arena feeds it, which is a different camera; corrected by the S4 implementer.
- **The whole ring is kept on the stage (AUTHORED; Codex review pass 2).** The build puts its overlay
  on the hero whatever the camera shows, and a team camera frames the fighters, not the ring around one
  of them: under the arena's own camera 1,708 of 4,740 rings had a button at least partly off the
  stage's side, a slotted walk wholly off it among them (3v3 plain seed 1, red-3 at x -510: walk-left
  centred at stage x -22.3). `ringButtonsInside` moves the whole set — the eight, a walk beside, the
  rank arrows — back onto the stage by the least that does it, ~~every button by the same amount~~
  every button but a walk that move would carry across the fighter (below), so the ring keeps its shape
  and nothing overlaps. This changes S3's placement at the stage's edges only.
  - **~~Every button by the same amount~~ broke Q5 at the edges (ring2 "edge", 2026-09-24; AUTHORED).**
    Whatever stuck out furthest — the swap, outboard of optionG, most often — set the move, and it
    carried the walk on that side across the fighter it moves: a write-nothing verifier found a
    walk-left at canvas x 116.2 for a fighter drawn at 53 (3v3 tricks seed 1 turn 9, red-2, 1280x840).
    Now `ringButtonsInside` takes the fighter's DRAWN centre (`fighterX`, the ring's own `placement.x`);
    a walk the sideways move carries toward him goes only as far as keeps its whole disc on its side,
    else — no room for that on the stage — flush with the stage's edge on its side; the rest of the
    ring moves on past it by the least that clears it. Measured against the two alternatives on the
    same matrix (below; the arena's camera, 1280x840): clamping each button onto the stage on its own
    overlapped two buttons in 1,780 of 6,984 rings (optionB and the step-back arrow in 906, optionG
    and the swap in 655); capping the whole ring's move so no walk crosses left a button off the stage
    in 962 (optionB in 587, optionC 417, the swap 298).
  - **Measured** (a scratch matrix in the edge slice's report: the verifier's 39 bouts and policy,
    every foe selected, two canvases, under the verifier's camera and under `main.js`'s own
    `stepFramedCamera`; counts per canvas, the same on both): a walk's centre on the wrong side of him
    where the stage had room for it 62 → 0 (verifier's camera) and 21 → 0 (the arena's); its disc
    crossing him where there was room for the whole disc 348 → 0 and 230 → 0. Every button on the
    stage and no two overlapping, before and after.
  - **Not fixable on the stage, and left so — an owner call:** where the fighter is drawn within one
    button radius of the stage's edge, or past it, no place on the stage is on his side. Under the
    arena's camera 346 of 11,291 walk placements (99 with him at the arena wall; 247 not, as far in as
    |arena x| 1,267; 8 with his centre off the stage). The walk stands flush with the edge there, its
    centre on the far side of his. The alternative is a walk partly off the stage, still clickable on
    the part that shows.
  - **Its key label stays on the stage too (Codex review of this slice, pass 1; reproduced as a
    failing test, then fixed).** A slotted walk held flush with the edge had its "2 Walk" drawn on the
    ring's outer side — wholly past the edge (2v2 tricks seed 3, 18 AI submissions in: right-aligned
    at x -3; S4's rule had drawn it at 11.07, its digit already cut). `ringLabelAt` now takes
    `{stage, taken}`: a place past the stage's edge is passed over like one across a button, a
    centred place (under, over) slides sideways onto the stage as the hover's caption does, and a
    place on a label drawn before it this frame (`taken`, `ringLabelBoxOf`) is passed over too —
    without that, labels brought onto the stage landed on their neighbours'. With no place on the
    stage, clear and free, the first clear and free one (past the edge), then the outer side, as
    before. Measured on the same matrix (arena's camera, 1280x840; label widths approximated, 0.55 em
    a character over 7, a letter 0.6 em, as node has no canvas): labels past the stage's edge 9,903 →
    2,935 of 32,232; a slotted walk's 3,713 → 0; labels across a button 0 → 0; labels on labels 0 →
    0. The 2,935 left have no free place on the stage — a column within a label's width of the edge
    whose places under and over are taken (3v3 tricks seed 1, 104 AI submissions in, red-2's optionE,
    in an unmoved ring).
  - Tests: `test/arena-ring-edge.test.js` (the verifier's case worked by hand, the arena's own case,
    the labels, and an acceptance sweep under `stepFramedCamera`). Not seen in a browser: screenshot a walk-left
    at the stage's left edge with the swap on offer (`?play=red&teams=2&items=tricks`, walking a red
    fighter toward the left wall; the test's own turn is the AI's path, which a person's choices leave)
    before trusting the look.
- **Keys (authored):** ← → walk, ↑ steps back a rank (up the stage), ↓ forward — from the stage or a
  strip button, never from a field that types or a control whose own arrows change it (the volume
  slider; `ringFocusKind` now calls it `"adjust"`), never with a modifier. A held arrow moves once, and
  its repeats stay the ring's until it is let go — also after the turn it moved has passed to the AI,
  where the first build let them scroll the page (Codex review pass 1; reproduced as a failing test,
  then fixed). An arrow whose move is withheld does nothing, is kept from the page (which would
  otherwise scroll under the fight) and is said in the live region ("Step forward a rank is not on
  offer now.").
- **The strip:** the ring row lists the eight, then the moves no slot holds, each with its arrow; a walk
  in its slot shows its digit and its arrow. The moves no longer appear under "Also".
- **The look (authored):** a move no slot holds carries no label on the stage — its glyph is its arrow
  and its key is that arrow. A walk in its slot keeps S2's "2 Walk".
- **Owner decisions:** the beside-walk placement; moving the ring onto the stage at its edges (the
  build does not), and — ring2 "edge" — keeping a walk on its side there while the rest moves on, and
  letting the stage win where the fighter is drawn at its very edge; ~~whether withheld rank arrows
  should be greyed now rather than in S9~~ (S9 greys them); the rank arrows' look (a disc with a chevron,
  like the authored buttons).
- **Not seen:** no agent may open a browser. Screenshot `?play=red&teams=3` (the rank arrows on a
  mid-rank fighter; the forward arrow over the front rank's heads) before trusting the look.

### S5, built 2026-09-24: the items row, the build's spells and potions over the ring

`items` in the model and the keys Q-Y (`tools/arena/ring.js`), `ringItemButtonsAt` and the row's
labels (`tools/arena/ring-layout.js`), the item's frame in `tools/arena/ring-art.js`, the row's resting
positions in `src/render/action-buttons.js` (`SS2_STRIP.items`), wired in `tools/arena/main.js` and
`tools/arena/index.html`. Tests: `test/arena-ring-items.test.js`; the real pack's row in
`test/render-action-buttons.test.js`; S2's `test/arena-ring.test.js` and `test/arena-ring-bouts.test.js`
updated where the spells left the list.

- **Every spell and potion the engine offers is on the row, for its target.** The engine's own menu
  names each of the six inventory slots' item, verb and target for the selected foe
  (`ss2UnavailableActions`, group `inventory`): a spell that strikes a foe is aimed at the SELECTED foe,
  the caster's own spells and every potion at the caster. A place holds its item only when the offer
  holds the action (S2's rule) and sends the offered option itself — a potion's with its `itemId`,
  which must be the slot's own. A foe spell at ANOTHER foe is reached by selecting him, as a swing is.
  Proven over 24 seeded bouts (1v1 and 3v3; the `tricks`, `crowd`, `buffs` and `blasts` kits), every foe
  selected in turn, under the arena's own settled camera: every offered spell and potion at the
  selected foe or the caster on the row, none listed, each drawn once, inside the stage, clear of every
  other button, sent by its click and its letter, and above the step-back arrow wherever that is drawn;
  and on every turn the union of the rows over the selections is exactly the offer's spells and
  potions. The strip's "Also" row now holds only what has no place (a rest beside a taunt, a forced
  phase).
- **Where the build puts it:** `inventory_overlay` (492) at (0, -80) of the overlay, scaled 60 (overlay
  frame 1 body 0x2378d2, `+0x02fe`..`+0x0365`), over the eight (its depth, 199999, is the overlay's
  highest). 492 is a five-frame clip whose six `inventory_buttons` start stacked and slide out to frame
  5, where it stops (492 frame 5 body 0x514b8, `Stop`); the row is drawn at rest, in one line 42 px
  apart — and NOT in slot order: left to right the slots are 5, 4, 1, 2, 3, 6 (measured in the
  player's pack, `buttons.inventory.layout`, compared in the suite). Each is a 116, so its disc and its
  click stand at (18.25, 18.25) of its own pixels, as the swap's do (S6). At rest it clears the eight:
  optionA's and optionD's discs are 32.3 overlay px from the nearest place, against 25.2 of radii.
- **What each place shows is the build's own:** 116 at the frame the slot's item id names
  (`inventory_buttonN.gotoAndStop(hero.inventoryN)`, 492 frame 1 body 0x50e55, `+0x0132`), over the up
  background, the over frame under the pointer (the row's own rollover, `+0x03bd`/`+0x04e3`). Without
  the pack, the authored disc with a potion or spell glyph. An empty slot draws nothing, as the build
  hides it (`+0x02c4`). The strip says each in the build's own NAME for it — the row's rollover text,
  `_root["inventory" + id][1]` (`+0x0954`..`+0x0aaf`), from the item table root frame 35 builds (body
  0x3fa9e2, `+0x4d27`..`+0x50b8`) — then the foe it is aimed at: "Gale at Nym", "Maximum health potion".
- **The owner's layout: the row sits ABOVE the step-back arrow, moved up to clear it** — as relayed by
  this slice's brief; the DECIDED list above says only "above the head". The row keeps the build's
  place wherever that already clears the step-back arrow's place (offered or not, so the row does not
  jump between turns and S9's greyed arrow keeps its room) by the gap the ring leaves between two of
  its buttons; otherwise the whole row rises just that far. At the build's own sizes it never has to:
  over 60 bouts in both of the page's views, no row of a fighter at his built size moved. A COLOSSUS
  (drawn at 150) is the case — his head, and the arrow over it, stand high over the ring: 605 of the
  arena view's rows and 530 of the fitted view's rose, by up to 70 and 75 overlay px, every button still
  on the stage and clear of every other (a scratch measurement, in the S5 implementer's report; the
  suite's acceptance draws the colossus at 150 and asserts the row over the arrow).
- **Authored, the owner did not decide these:**
  - **Keys Q W E R T Y, one per place, left to right across the row as drawn** — the keyboard's row
    under the digits, in the order the eye reads the row. So a two-spell kit (slots 1 and 2) is on E and
    R. From the stage or a strip button, whatever case Shift or Caps Lock gives, once per press, never
    while typing or with Ctrl/Alt/Meta. The stage label is the letter alone, ABOVE its place (the row's
    neighbours are 3.6 overlay px apart, no room beside), else under it; the name is the strip's.
  - **The letters are kept on the stage with the ring.** S4 moves the whole ring onto the stage by its
    discs; the row is the ring's top, so its letters over it ran off the top of the stage — 2,169 letter
    placements under the arena's camera and 7,627 in the fitted view, over 60 bouts, in the first S5
    build. Each place now carries its letter's room (`labelRoom`, from S2's label size, now
    `ringLabelSizeFor`), which the stage fit keeps above it: 0 after, every button still on the stage.
  - **The strip** gains an "Items" row between the ring's row and "Also", each button with its letter.
    The strip keeps S2's fixed 132 px and scrolls when full.
  - **The row is drawn at rest**, not sliding out over 492's first four frames as the build's does.
- **Two slots of one item are two places, as in the build, sending the one action the engine offers —
  and the engine spends the FIRST slot holding it, whichever was pressed** (`ss2InventorySlotHolding`,
  `check_inventory`'s order), where the build's own button empties the slot pressed (`+0x0626` for slot
  1). An action names no slot, so the ring cannot say which; pinned in the suite as it stands. **Owner
  decision:** leave it, or give the engine's item actions a slot (a protocol change, with its own
  census).
- **Not seen:** no agent may open a browser. Screenshot `?play=red&teams=3&items=tricks` (six spells over
  the ring, their letters above them, a foe spell re-aimed by Tab), `?play=red&items=crowd` (the potions)
  and `?play=red&items=buffs` after a colossus (the row risen over the step-back arrow).

### S6, built 2026-09-24: the weapon swap, the build's ninth button

`swap` in the model and key 9 (`tools/arena/ring.js`), `ringSwapButtonAt` and `ringLabelAt`
(`tools/arena/ring-layout.js`), the swap's frame and disc centre in `src/render/action-buttons.js`,
wired in `tools/arena/main.js` and `tools/arena/index.html`. Tests: `test/arena-ring-swap.test.js`; the
frame pins in `test/render-action-buttons.test.js`; S2's and S4's tests updated where the swap left the
list (`test/arena-ring.test.js`, `test/arena-ring-movement.test.js`, `test/arena-ring-bouts.test.js`).

- **Shown exactly when the engine offers `swap-weapons`, hidden otherwise.** The engine withholds it with
  no second weapon (`no-secondary`) and under a forced phase (`no-stamina`, `condition`) — every one a
  "hide" in `SS2_UNAVAILABLE_REASONS`, so hiding is the owner's Q6 as well as S2's rule. Proven over 30
  seeded bouts (1v1, 2v2, 3v3; plain and `tricks`), every foe selected in turn, under the arena's own
  settled camera: 1,982 selections with the swap offered, each drawn once, inside the stage, clear of
  every other button, and sent by its click and by 9; 2,758 without, each drawn, clicked and keyed by
  nothing, and the engine's reason a hide every time (no-secondary 2,743, no-stamina 9, condition 6).
  A person's 9 in whole `?play=red` bouts changes the weapon in hand, both ways (78 presses in 10 bouts).
- **Where the build puts it:** `swap_inventory`, depth 101 of the overlay's frame 1 (over the eight), at
  its slot — (-93.4, 40.4) at scale 0.6, the ring's lower left, outboard of optionG. Its clip is
  `inventory_buttons` (116), which — unlike 860, centred on its origin — places its round background at
  (18.25, 18.25) of its own pixels on all 49 frames (365 twips; measured in the player's pack), so the
  disc, and the click, stand that far in from the slot (`SS2_STRIP.backgroundAt`, compared with a real
  pack in the suite). The hit radius is the ring's own rule, 18 at the slot's scale (the build's
  background is 19.25); its nearest neighbour, optionG, is 29.0 overlay px away against 25.2 of radii.
- **What it shows is the weapon it swaps TO:** 116 frame 10 — a bow and an arrow — with the sword in
  hand, frame 11 — a sword — with the bow drawn (overlay frame 1 body 0x2378d2: `using_bow == true`
  branches to `+0x0ee4`, `gotoAndStop(11)`; the fall-through `+0x0ec8` is `gotoAndStop(10)`). The
  rollover's own words agree, and the strip uses them: "Switch to ranged weapon" / "Switch to melee
  weapon" (`+0x0f7f` / `+0x0f5e`). The weapon in hand is the engine's (its bow mode, the stance's
  `weapon`). ~~`SS2_STRIP.swap`: frame 10 with the bow, 11 without~~ — **inverted from ab5feb5 until
  S6**; corrected in `src/render/action-buttons.js` and its test, and the real pack's art agrees (frame
  10 holds the only multi-frame child of the two, a bow and its string).
- **Authored, the owner did not decide these:**
  - **Key 9** (the build has no keyboard; 9 follows the eight), from the stage or a strip button, once
    per press, never while typing or with Ctrl/Alt/Meta. The stage label is "9 Swap".
  - **A key label gives way (`ringLabelAt`).** Every label still goes on the ring's outer side unless
    that would run across another drawn button; then under its button, then above. The swap stands
    exactly where optionG's label ran, so with the swap on offer optionG's label goes under optionG
    (925 of 925 such selections in the 30 bouts); with no swap nothing moves. Measured with an
    approximate text width over the same bouts: no label crosses a button.
  - **The forced swap is a press.** Out of arrows with the bow drawn, the swap is the engine's WHOLE
    offer (the build's first forced phase); the build does it by itself and hides its button, while
    here it is the ring's only button (62 selections in the 30 bouts), as every forced action was a
    list entry in S2.
- **Owner decision — THE BUILD HIDES THE SWAP AT NO ARROWS LEFT, AND THE ENGINE OFFERS IT.** The
  button's hide is `(ammo_left <= 0 && secondary_weapon != 0) || secondary_weapon == 0` (`+0x0e0a`..
  `+0x0e9d`; its tooltip: "Only work if you have any ammunition left"), so the build never lets a
  gladiator swap to an empty bow. The engine's offer gates only on the second weapon, so with the sword
  in hand and no arrows it offers the swap — and the ring shows what the engine offers: 1,047 of the
  1,982 shown selections are that state. The rule set's AI never takes it (0 of 3,280 offers, 120 AI
  bouts), so only a person can, and the next turn's forced phase swaps him straight back. Withholding
  it with a hide reason is an ENGINE change in `src/team/ss2-rules.js` (the offer's length moves
  `options[turnNumber % length]` drivers, so it needs its own census); until then the ring shows it.
- **Not seen:** no agent may open a browser. Screenshot `?play=red&teams=3` on red-2 (the archer):
  the bow icon with the sword in hand, the sword after a swap, the swap's hover frame, optionG's label
  under it, and a ring at the left edge — the swap's label, like S2's labels, can run off the stage
  there (582 of 1,982 swap selections, measured with an approximate width).

### S7, built 2026-09-24: hover previews, the target's odds, and "confirm every move"

`ringPreviewFor`, `ringOddsFor` and the setting's storage (`tools/arena/ring-preview.js`, new);
`ringEntries`, `ringPressCommand`, `ringConfirmCommand`, `ringPendingFor`, `ringPendingKept` and
Enter/Esc in `ringKeyCommand` (`tools/arena/ring.js`); `ringCaptionAt` and `ringCaptionLines`
(`tools/arena/ring-layout.js`); wired in
`tools/arena/main.js` and `tools/arena/index.html`. Tests: `test/arena-ring-preview.test.js` and
`test/arena-ring-preview-bouts.test.js`; the S2, S4, S5 and S6 shell pins on the click and key routes
were updated where S7 put a gate in front of `actFromRing`.

- **Every preview is the engine's.** Hovering a button on the stage, or pointing at or focusing one in
  the strip, shows what `host.previewAction(action)` says for THAT button's action: the hit chance, the
  damage band before armour, what a potion or rejuvenate restores, and the stamina it costs or gives
  ("Power attack at Cidra: 40% to hit · 17 damage · costs 10 stamina"; a bolt "cannot miss"; a whirlwind
  out of range "out of range: wasted"; "from behind" when the back-attack bonus applies; a rest "gains
  75 stamina"). The words before the colon are the strip's own for the button (the build's item names,
  S5; the swap's rollover text, S6). Proven over 16 seeded bouts (1v1 and 3v3; plain, `tricks`,
  `blasts`, `crowd`), every turn, every foe selected: ~~19,397~~ **20,902** hovers found the way the
  shell finds them (`ringSlotAt` on the drawn button) and ~~20,325~~ **21,903** strip buttons, each
  preview's numbers read back out of its words by an independent parser and compared with
  `host.previewAction` — ~~6,362~~ **6,724** with a hit chance, 168 that cannot miss, ~~364~~ **482**
  wasted out of range. **(Corrected by the S9 implementer: the struck figures are not what this test
  prints at 2ba96c3, where S7 was committed — re-run there, and on the ring2 "edge" tree, both print
  the bold ones. S9 adds 5,290 hovers on GREYED buttons, each showing its reason, not a preview.)** The Preview row follows the pointer (in the strip, else
  on the stage), else the focused strip button, else the choice waiting for Confirm — the focus and the
  pointer tracked apart, so the pointer leaving gives the row back to the focused button
  (`ringStripPreviewAfter`, `ringPreviewShown`; Codex review of S7, pass 3: the first build kept one
  shared slot and blanked it). Each strip button carries its OWN preview as its accessible description,
  not the shared row, which another button under the pointer rewrites (Codex pass 3).
- **The hit chance is the build's own number, the one its rollover prints** — `"Power (" +
  hero.power_percentage + " % chance)"` (overlay frame 13, `closerange_warrior`, body 0x23a11c,
  `+0x096a`), which `ss2PreviewAction` returns as `chance`. It is not quite the odds: the dispatcher hits
  on `diceroll >= 100 - chance` over 1-100, `chance + 1` in 100, and the taunt's first roll lands on
  `roll < chance`, `chance - 1` in 100 (`ss2PreviewAction`'s own note). **Owner decision:** keep the
  build's number (as built), or show the true odds.
- **Where the words stand (AUTHORED).** The build writes the hovered button's `optiontext` into the
  overlay's own text field (edit text 861, `variable: "optiontext"`; e.g. the items row's rollover,
  overlay frame 1 body 0x2378d2, `+0x03f5`); no pack says where that field stands. So on the stage the
  preview is a caption under the hovered button (over it at the stage's foot, slid onto the stage at its
  sides — `ringCaptionAt`), in the label's size, while the pointer is on it, never wider than the stage:
  a caption too long for it wraps at its " · " seams, then between words (`ringCaptionLines`; Codex
  review of S7, pass 2 — the first build drew one line, which a narrow stage cut off, cost and all). In
  the strip it is a new first row, "Preview", so its fixed 132 px never scrolls it away.
- **The selected target's odds (the owner's decision 9).** The strip's Target row ends with every roll
  at the selected foe on screen and the engine's chance for each — "Odds on Cidra: Power 40% · Normal
  61% · Quick 80%" — the taunt, the swings, the shots, the bash, a ghost strike, a whirlwind in range;
  once per action (two places of one spell are one roll). What takes no roll, or cannot miss, is not
  odds. Proven over the same 16 bouts: in each of 2,710 selections the odds are exactly the OFFER's
  actions at that foe that roll to hit him (3,181 in all). The turn's announcement ends with them.
  AUTHORED: the build shows no odds line, only each button's rollover.
- **"Confirm every move" (the owner's decision 4), OFF by default.** A checkbox at the end of the
  Preview row, remembered per browser (`localStorage` key `arena.ring.confirm`, "1"/"0"; storage that
  throws or is empty means off, and a save it refuses is logged while the setting still applies). With it
  ON, every press — a click on the stage, a strip button, 1-9, Q-Y, the arrows — only CHOOSES: the chosen
  button is ringed in gold, the Preview row says "Chosen — …", and the live region says it. **Enter** from
  the stage, or the strip's **Confirm**, sends it; **Esc** (from the stage or a strip button) or **Back**
  drops it. Chosen anywhere but the stage — a strip button, or a key pressed while one had the focus —
  the focus moves to Confirm, so the next Enter confirms (found on self-review: a digit pressed with a
  strip button focused chose, and Enter then pressed that button instead); on a button,
  Enter stays the browser's and presses that button — but a HELD Enter's repeats are the ring's and do
  nothing, wherever the focus is, so the press that chose cannot also confirm by being held (Codex review
  of S7, pass 1: the first build left the repeats to the browser, which would press the Confirm the
  focus had just moved to). A choice stands while its turn does and the ring on screen shows it — a
  potion outlasts a change of target; a swing at the old target is DROPPED, and switching back does not
  bring it back (Codex pass 1: the first build only hid it) — and every send clears it. Proven over 18 `?play=red` bouts (1v1 and 3v3; plain, `tricks`, `crowd`; seeds 1-3):
  ~~1,758 presses (667 digits, 80 letters, 644 arrows, 353 clicks on drawn buttons, 14 listed)~~ **1,525
  presses (591 digits, 80 letters, 538 arrows, 309 clicks on drawn buttons, 7 listed — re-run at 2ba96c3
  by the S9 implementer; the struck figures are not what the committed test prints, and neither are the
  struck ones below)**, every one only a choice, and the state hash unmoved until Enter (~~640~~ **555**)
  or Confirm (~~632~~ **547**) sent the choice, which was on offer every time; ~~422~~ **366** taken
  back by Esc (and Enter then sent nothing), ~~277 re-targeted by Tab (213
  choices kept, 64 dropped)~~ **235 re-targeted by Tab (178 choices kept, 57 dropped)**.
- **One road to the engine.** Every press goes through `ringPressCommand` (the shell's `pressRing`;
  since S9 a click on the stage through `ringClickCommand`, which wraps it and answers a greyed button),
  every key through `ringKeyCommand`, Confirm through `ringConfirmCommand`, and only an "act" command
  reaches `actFromRing` (`runRingCommand`), which still re-asks whose turn it is. The plain list S2 kept
  for a rule set with no menu (or a menu that throws) honours the setting too: a click there is a press,
  and with the setting on it only marks the button and the list's own Confirm sends it (Codex review of
  S7, pass 4, the last pass allowed: the first build let that list submit on one click; fixed and pinned
  after the pass, NOT re-reviewed).
- **Asking changes nothing.** `previewAction` is pure: over those 16 bouts the state hash and the record
  of random draws were the same after every turn's previews and odds as before them, and five spectated
  bouts take the same hash sequence and the same draws with every preview asked for every fighter
  against every foe on every turn. The golden census is identical.
- **Authored, the owner did not decide these:** the preview's words and their order; the caption under
  the button and the Preview row; the odds in the Target row; the gold ring on a chosen button; Enter only
  from the stage; Esc and Back; the focus moving to Confirm; a choice outliving a change of target when
  its button is still there; the hit chance shown as the build's number rather than the true odds.
- **Not seen:** no agent may open a browser. Screenshot `?play=red` hovering the power attack (the
  caption under it, the Preview row), `?play=red&teams=3&items=tricks` with the setting on (a spell
  chosen and ringed, Confirm live), and tab through the strip with a screen reader (the preview as each
  button's description).

### S8, built 2026-09-24: the AI's pace — Shift held, and "skip to my turn"

`ringPaceApplies`, `ringPaceFrame`, `ringPaceNow`, `ringPaceKeyed`, `ringPaceSubmitted`,
`ringPaceSkipPressed` and `ringPaceView` (`tools/arena/ring-pacing.js`, new); wired in
`tools/arena/main.js` (`pacedNow`, `arenaNow`, `ringPaceState`, `renderRingPace`) and
`tools/arena/index.html` (the strip's AI row). Tests: `test/arena-ring-pacing.test.js` (new).

- **Pacing is the arena's CLOCK, and nothing else.** Every animation, arrow, fireball, boulder, bolt,
  pop-up, blood drop and crowd change is drawn on one clock, and the animation gate opens when the
  drawing on it is done (`animationCursor`); an AI seat moves only through that gate (`aiTurnStep`). The
  shell's clock is now `arenaNow()`: the page's own plus an offset that only the pace moves. Running it
  faster draws the AI's turns faster and changes nothing else — no engine step is skipped, reordered or
  taken early, and the gate is given the same reports in the same order. "Skip to my turn" is the
  fastest clock, never a jump: every AI step is still submitted through the gate and drawn at least one
  frame.
- **Normal speed by default.** With nothing asked the offset stays 0 and the arena's clock IS the page's
  clock, to the bit; a bout nobody paces is drawn exactly as before S8.
- **Shift, held: the AI's turns at 4×** (`RING_PACE_HELD_RATE`). The brief offered Space or Shift;
  **Shift, because Space presses things**: the strip's buttons and the "confirm every move" box take
  Space, and the strip hands the focus back to a ring button on the person's next turn
  (`ringFocusWanted`), so a Space still held when that turn arrived would press it on release — an
  action sent by accident. Shift alone presses nothing anywhere on the page, and none of the ring's keys
  reads it alone. Let go, or the window loses the focus, and the pace is the page's again.
- **"Skip to my turn": a toggle button in the strip** (`aria-pressed`): the AI's turns at 64× the page's
  pace (`RING_PACE_SKIP_RATE`) — at 60 frames a second, one second of the arena per drawn frame — until
  the person's next turn: it is spent when a frame begins on his ready turn, ~~and only then~~ **or when
  he acts, whichever comes first** (Codex review of S8, pass 1: the drain opens his turn in the middle of
  a frame, and a person who acted before the next frame began never let one see it — the skip stood, and
  every AI turn after his was drawn at 64×). The AI's turns after his are drawn at their own pace unless
  it is pressed again. Pressed again before then, it stops. Shift held as well changes nothing: the skip
  is the faster.
- **Only an AI seat's drawing is paced.** The person's own action is drawn at his pace whatever is held
  or pressed (the shell tells the pace whose step it submitted: `beginStep(step, true)` from
  `aiTurnStep` only), and so is his turn once it is ready — the idle stance, the ring, the pop-ups still
  landing.
- **No frame draws more than one second of the arena beyond its own length**
  (`RING_PACE_MAX_FRAME_MS`). The gate gives up on an animation seen 4 s past its end
  (`ANIMATION_TIMEOUT_MS`, `abandonReasonFor`), and an end can be overrun only by one frame's advance;
  capping what the pace ADDS keeps a frame at max(its own length, 1 s)~~, so the pace can never ABANDON an
  action the page's own pace would have reported~~ — **not enough on its own (Codex review of S8, pass 1):
  a stall after the pace had drawn ahead still overran by that lead.** The real 1,200 ms sidestep with
  frames at 0, 200 and 4,700 ms is reported at the page's pace (3,500 past its end) and was ABANDONED
  with Shift held (the arena at 800, then 5,300: 4,100 past). **So a frame longer than the cap — a
  stalled or hidden tab — advances the arena by its length less what the pace drew ahead since the step
  on screen began,** ~~and never backwards~~ **but never by less than a second** (Codex review of S8,
  pass 2: pass 1's "never below nothing" was a step down at the cap that the clock BETWEEN frames did
  not follow — it kept the whole lead, so a resize's render during a stall read 4,999 and the frame after
  it 3,000, and the arena went back from cues fired and blood stamped): the arena then stands where
  the page's own pace would have it, or a second on from where it was. The clock between frames
  (`ringPaceNow`) is the same rule at the page's pace, so it is never later than the frame after it nor
  earlier than the one before, and a step stamped between frames starts its lead from what it was
  stamped with. A stall can abandon under the pace only what it abandons at the page's own pace from
  the same wall-clock start. Uncapped, a slow page (96 ms frames) skipping would draw 6.1 s in one frame.
- **Where:** `?play=` with at least one AI seat (`ringPaceApplies`). `?spectate=1` and every seat by hand
  are drawn exactly as they were: no row, and Shift does nothing. The AI row is the strip's last, under
  the status line, and shows only between his turns — including while the AI's last action is still drawn
  on his turn, and hiding when it is ready without moving anything of his; it names the
  key ("Hold **Shift** to draw the AI's turns at 4×") and says what the pace is doing ("Shift held: …",
  "Skipping to your turn…"). The stage's accessible name says it too. Pressing Skip, on or off, is
  announced in the strip's live region; if Skip still has the focus when his turn comes, the focus goes to
  the stage, where the ring's keys are — never onto one of his actions in the strip, which the next Enter
  or Space would press.
- **Proven** (`test/arena-ring-pacing.test.js`): the clock by worked frames (1× to the bit, 4×, the skip,
  the cap at 250, 400 and 2,000 ms frames); the skip's life and the key; and **whole bouts on the page's
  own frame loop through the ENFORCING gate** — the pace stepped first each frame from the turn and the
  gate as the frame finds them, the drain on the arena's clock (queued links handed on, a timed-out one
  abandoned), an AI seat through `seatFrameFor` and `suggestAction`, the person through the ring by a
  fixed policy. Six bouts (1v1, 2v2, 3v3; plain and `tricks`; `play=red`, `play=red-1`, `play=blue`;
  464 steps, 174 of them the person's), each under six hands — nothing touched, Shift held throughout,
  Shift flicked and the focus lost, skip whenever offered, skip toggled on and off, skip and Shift — take
  **the same state-hash sequence, the same steps, the same result and the same gate record (every token
  reported, none abandoned)**; the person's own actions take the same ~~9,558~~ **9,651** frames under every
  hand (his click now lands 5 ms after the frame that opened his turn, as a click lands between frames:
  Codex pass 2); a
  person's ready turn is never drawn fast and no skip outlives one. The AI's drawing took 18,542 frames
  with nothing touched, 4,749 with Shift held and 350 skipping (290 AI steps). Two more bouts on a slow
  page (96 ms frames) and an uneven one (a 250 ms hitch among 16s) give the 62.5 fps page's hashes at
  every pace, with nothing abandoned. **Added after Codex's pass 1:** a seventh hand presses Skip once
  (18,159 AI frames: only the AI's turns before his first are skipped), and every run counts frames at
  the skip's rate with no press since the person's last step (0 in all);
  two bouts where the person waits three frames on his ready turn before acting, so frames begin on it
  (the first loop never let one: he acted the moment the drain opened it); and three bouts on a page that
  stalls 4.6 s after every sixty frames, under six hands — the same hashes and steps, and every one of
  the 7 to 27 abandons per run (19, 19 and 8 with nothing touched; a paced run meets the stalls at other
  points of other steps, and can meet more) checked against its clip's own wall-clock start: each is one
  the stall makes at the page's own pace. **Added after Codex's pass 2:** every frame of every run also
  reads the clock between frames 1 ms before it, and the clock is never earlier than the frame before
  nor later than the frame after (0 backwards in all). The golden census is identical.
- **What it does not pace, measured or read, not changed here:**
  - **The camera** eases once a DRAWN frame (a fifth of the zoom, a sixteenth of the pan: `render`), not
    on the arena's clock, so at 4× and while skipping it trails the fighters and catches up on the
    person's turn. The camera is not this slice's to change; stepping it by the pace is a follow-up.
  - **Sounds:** a clip's cues fire when the drawn pose reaches them, so at 4× they come four times as
    often (each still whole, at its own pitch); skipping, a cue more than 200 ms (`SOUND_STALE_MS`)
    behind the drawing is dropped, so a frame that draws a second of the arena sounds only the cues of
    its last 200 ms. The crowd's seeded chance of a cheer
    rolls once per build frame of the arena's clock, so at 4× it rolls four times as often per second.
  - **One line still reads the page's clock:** `beginStep` settles the sounds of a clip a new step
    replaces with `performance.now()`, a line `test/arena-sound-wiring.test.js` pins as text. Once the
    pace has added an offset that settle sees an earlier time than the clip's, and the replaced clip's
    last cues are not sounded. Only a clip still running at a submit is replaced, and the gate waits for
    every clip that carries a token: over 27 spectated bouts (1-3 a side; plain, `tricks`, `buffs`; seeds
    1-3; 1,987 steps, on the page's own drain) no submit replaced a running clip at all (a scratch probe
    in the S8 report). Changing the line needs that test file.
- **AUTHORED, the owner did not decide these:** Shift (and why not Space); 4×; the skip's 64× and the 1 s
  cap; the skip as a toggle, spent at the next person's turn rather than standing for the bout; the
  person's own action at 1× with Shift held; the row's place, words and look; no pace while spectating.
- **Owner decisions:** Shift or Space; the two rates; whether Shift should also speed up `?spectate=1`
  (one line: `ringPaceApplies`); whether the camera should follow the pace; whether skipping should mute
  the arena's sounds rather than drop them as they fall behind.
- **Not seen:** no agent may open a browser. Screenshot `?play=red&teams=3` during the AI's turns (the AI
  row under the stage, "Skipping to your turn…" with the button pressed), hold Shift through a 3v3's AI
  turns and watch the camera trail, and tab to Skip with a screen reader (the row's name, the toggle's
  state, the announcement, the focus landing on the stage at your turn). On Windows, holding the RIGHT
  Shift for eight seconds can raise the Filter Keys prompt where that shortcut is on; the left Shift
  does not.

### S9, built 2026-09-24: why a button is greyed

`ringGreyReasonOf`, `RING_HIDDEN_VERBS`, each slot's, move's and place's `reason` and `withheld`,
`ringEntries(model, {greyed: true})`, `ringGreyFor`, `ringClickCommand` and `ringShownFor`
(`tools/arena/ring.js`); `ringGreyTextFor`, `ringGreyLabelFor` and `ringShownText`
(`tools/arena/ring-preview.js`); the reason carried to each drawn button (`tools/arena/ring-layout.js`)
and the disabled look (`tools/arena/ring-art.js`); wired in `tools/arena/main.js` and
`tools/arena/index.html`. Tests: `test/arena-ring-reasons.test.js` (new); the S2-S7 tests updated where
a withheld button used to be nowhere (`test/arena-ring-movement.test.js`, `-preview-bouts`, `-art`,
`-edge`, `-items`, `-bouts`, `arena-ring.test.js`) and where S9 rewrote a shell line they pin (`-wiring`,
`-swap`, `-preview`).

- **Which, from the engine, never re-derived here.** `host.unavailableActions(actor, selectedFoe)` gives
  every button of the ring one reason code when it is not on offer, and `SS2_UNAVAILABLE_REASONS` its
  flag: a **hide** code (the build hides the button: stance, level, an empty or locked slot, no second
  weapon, a forced phase) draws nothing; a **grey** code draws the button where it stands, dimmed, and
  it can never act. The owner's Q6 names the team rules (other rank, out of reach, blocked); the bouts
  reach all but one of them — `other-rank`, `in-reach`, `body-blocks`, `duel`, `no-rank` — and
  `rank-full`, the offer's own gate that no bout reaches (the engine's docblock), is staged.
- **Jump and charge stay HIDDEN whatever the engine flags them** (the owner's Q8): the engine flags them
  `not-built`, a grey code, and on the long warrior frames they are three of the eight slots on every
  turn (`RING_HIDDEN_VERBS`).
- **AUTHORED, the owner did not decide these:**
  - **The engine's own grey codes are greyed as it flags them**, with its words: `not-built` on an item
    the engine has no verb for (`?items=10` puts `inventory_buttons` frame 10, the swap's bow, in a slot:
    "Item #10 — not now: Not built yet."), `undeclared` and `not-offered` (neither reached in the bouts;
    staged). Q6 says only "the team rules".
  - **The look:** the build has no disabled button (it hides); a greyed button is its own build art through
    the build's greyscale at 0.55 alpha (`SS2_GREYSCALE_MATRIX`, the grey of `inventory_buttons` frames 10
    and 11), or the authored disabled disc without a pack, and never takes the rollover background. The
    stage's cursor over it is `not-allowed`.
  - **No key label on the stage for a greyed button.** Its key only says why, and the pointer and the strip
    say that too. Measured: labelled, a greyed swing's label had no free place beside a walk the stance
    does not wire and ran across it (2v2 tricks seed 2, 14 AI submissions in, blue-2's optionB). It is
    still drawn before any label is placed, so no label crosses it — which moves one: the S4 edge case's
    held walk (2v2 tricks seed 3, 18 in) now has the greyed taunt under it, and its "2 Walk" goes over it.
  - **The words:** the strip's own name for the button — the verb, the build's name for an item, the foe
    it would be aimed at — then " — not now: " and the engine's `says` for the code ("Taunt at Cidra —
    not now: That foe is in another rank; you can only reach your own."). The `says` sentences are the E
    slice's, not the build's (the build has none). They are the caption under the hovered button, the
    Preview row while the pointer or the focus is on it, the strip button's accessible description, and
    what the live region says when it is pressed.
  - **The strip lists every greyed button in its place** — the ring row's slots in key order, then the
    moves, the items row — as a real button with `aria-disabled="true"`, NOT `disabled`, so the keyboard
    still reaches it and a screen reader says it is unavailable and why; dimmed and dashed. The turn's
    announcement counts them ("…, 3 greyed").
- **It can never act.** A click on it, its digit, letter or arrow, its strip button (a click, Enter or
  Space) — every route is `{kind: "ignore", why: "greyed"}` (`ringClickCommand`, `ringKeyCommand`), with
  or without "confirm every move": it is never chosen, never Confirmed, never in the odds. What a greyed
  button WOULD send (`withheld`) is kept for its words only.
- **The weapon swap is never greyed:** every code the engine gives it is a hide (`no-secondary`, a forced
  phase; and, from 39da762, `no-arrows`), so it stays hidden as S6 built it. A grey code on it would hide
  it too; none exists.
- **Proven** (`test/arena-ring-reasons.test.js`):
  - every code in the table on one button (the step-forward arrow, re-stamped with each of the 19): each
    of the 9 grey codes drawn once, greyed, its words under the pointer, its click saying why, listed
    once; each of the 10 hide codes drawn, listed and pointed at nowhere, its arrow `not-offered`;
  - over 24 seeded bouts (1v1, 2v2, 3v3; plain, `tricks`, `buffs`, `10`; seeds 1-2), every turn, every
    foe selected (3,206 selections, 32,368 withheld entries): every entry with a grey code drawn exactly
    once where it stands, with the engine's reason, dimmed even under the pointer, hit by the pointer at
    its centre, saying the engine's words, sending nothing when clicked and listed once — `no-rank` 1,550,
    `other-rank` 1,171, `in-reach` 1,021, `duel` 939, `not-built` (the item) 637, `body-blocks` 155; every
    hide entry, and every jump and charge, drawn and listed nowhere (`slot-empty` 13,975, jump 5,092,
    `level` 2,779, charge 1,935, `no-secondary` 1,830, `no-ammo` 776 and more);
  - staged turns with their literals: the taunt greyed `other-rank` at the 2v2 opening, the walk toward a
    foe and the taunt greyed `in-reach` and the step forward `no-rank` eight turns in, a 1v1's rank arrows
    greyed `duel`, the item greyed `not-built`, and the forced swap (no arrows, bow drawn) hiding every
    move.
- **What it moved in the earlier slices** (measured under the arena's camera over the edge slice's 24
  bouts, 3,877 selections, a scratch script in the S9 report): 3,136 rings now carry a greyed button
  (5,777 in all), none off the stage and none overlapping another. They join the stage fit, so in 28 rings
  an acting button stands elsewhere than it did; and the edge slice's push — the rest of the ring moved on
  past a held walk by the least that clears it — is reached for the first time (3 rings; 0 without S9),
  leaving the two discs exactly tangent. The S4 and S7 acceptances now count greyed moves (4,413 of 5,692
  withheld) and greyed hovers (5,290), and assert the push's tangency to rounding.
- **Owner decisions:** grey the engine's own codes, or hide them; no key label on a greyed button; the
  words' form; `aria-disabled` over `disabled` in the strip; the tangent discs the edge push leaves
  (a gap would be the ring's own, 2.7 overlay px).
- **Not seen:** no agent may open a browser. Screenshot `?play=red&teams=2` with a foe in the other rank
  selected (the taunt and the swings greyed, their captions), `?play=red` (a 1v1's rank arrows greyed
  `duel`), `?play=red&items=10` (the greyed item), and tab through the strip with a screen reader (a
  greyed button announced unavailable, with its reason).

<a id="decided-hud-2026-09-24"></a>

## Team HUD, reach preview and the camera: DECIDED by the owner, 2026-09-24 (a grilling round, 2 rounds, 12 questions)

Asked after the owner played the team demo ("quite excellent") and reported the spell row covering
the bow's "Bombard" text, the ring cut off at the stage's edges, and "spells and ranged (bombard
particularly) options to attack multiple enemies … appears to be missing". Facts checked first: the
engine already offers bombard and every foe-targeted spell against up to 3 foes in 3v3 (mean ~2.6),
each action with ONE target (no area attack exists, as in the build); the build's own HUD
(`combat_panel`, sprite 751) shows per side a health vial (hp/max), an ENERGY vial and an armour
gauge, plus one crowd bar with ten mood words; the camera (`stepFramedCamera`) frames fighters only
and the ring is squeezed onto the stage after it.

1. **Multiple enemies means TARGET PICKING, not area attacks** (the owner chose picking; area attacks
   would be a new combat rule the build cannot answer). **Reach preview (Q5a):** hovering or focusing
   a spell or bombard lights EVERY foe it can reach with a numbered gold ring (1–3, left to right)
   and dims the rest; the hover text names the target ("Fireball → Nym · click another lit foe to
   change"); one click still fires at the SELECTED foe (the who-first decision stands).
2. **Team HUD (Q1a, Q2, Q3c):** the right-hand roster becomes TWO TEAM PANELS, red then blue; each
   fighter's row shows **health, energy and armour** bars with numbers (the build's three readings;
   SS2 has no mana — spells are paid from energy; magicka appears only in spell previews), a
   highlight on the fighter whose turn it is, condition chips in plain words (Burning, Frozen,
   Poisoned…), and a "you" marker on seats a person controls.
3. **Crowd meter (Q11):** one shared meter at the top of the side panel, with the build's ten mood
   words (`crowd: <mood>`, index `ceil(interest / 10)`).
   **Built 2026-09-24 (H2, items 2 and 3):** `teamHudFor`, `crowdMeterFor`, `conditionsFor` in
   `tools/arena/team-hud.js`, drawn by `renderRoster` (`renderCrowdMeter`, `teamPanelNode`,
   `fighterRowNode`, `readingNode`); `test/arena-team-hud.test.js`,
   `test/arena-team-hud-bouts.test.js` (whole bouts, every row held to `host.battle` after every
   action; a spectated bout's hash sequence unchanged by reading it), and the wiring pins. Where
   each reading lives: health `health`/`maxHealth`; energy `staminaleft`/`staminamax`; armour
   `armourclass`/`armourclass_max` (the maximum falling back to `armourclass`, as `vanillaRecordOf`
   does), hidden at 0 as the build's gauge is (`hero_armour` clip-action 0, `+0x0094`-`+0x00bb`);
   each bar `round(value / max * 100)` as the build's three gauges compute it. The chips are the
   build's own splat words — Burning, Frozen, Poisoned, and **Wraith** for life stolen
   (`SPLAT_WORDS[151]` at `STATUS_BONUS_FRAMES`) — and "Taunted", authored; `facing-left` is not a
   condition and is no longer printed. The ten moods are NOT recorded in the battle map or the text
   pack (the icons pack has them only as a sorted set); their order was read from the oracle's
   action dump, `crowd_bar` clip-action 0 `+0x01c7` — `"", bored to tears, bored silly, restless,
   indifferent, interested, entertained, enthusiastic, wildly entertained, Tranfixed [sic],
   Fanatical` — and is `CROWD_MOODS`. Authored: above 100 (an opening level sum, before the first
   phase clamps it) the meter keeps the top mood, where the build's label would read "undefined";
   the meter is hidden when every fighter is level 1, as the build hides `crowd_bar`
   (`crowdHeardFor`). The roster's `side slot N · authored` line is gone.
4. **Turn-order strip (Q3c, Q10a):** a thin DOM strip just above the stage — every fighter in
   initiative order, team-coloured, the current one highlighted, the dead struck through. It never
   touches the canvas or the camera.
   **Built 2026-09-24 (H3):** `turnOrderFor` in `tools/arena/team-hud.js` (also `teamHudFor`'s
   `turnOrder`), drawn by `renderTurnStrip` into `#turn-strip`, an `<ol>` in the stage's column
   above `#stage` at a fixed 30 px, redrawn with the side panel on every turn. The order is the
   ENGINE's — the wire's `initiative` (the battle's own list, `rules.initiativeOrder`:
   `ss2InitiativeOrder`) — and whose turn it is, `initiative[turnCursor]`; nothing is re-derived.
   The current fighter is `aria-current="step"`; the fallen are struck through and say "(down)".
   It never scrolls — a classic scrollbar would eat the fixed height (Codex review of H3) — so on a
   narrow stage the chips shrink and the names end in an ellipsis, each chip titled with the whole
   name. `test/arena-team-hud-bouts.test.js` holds it to `host.battle.initiative` after every
   action.
5. **Team colours (Q4, Q12):** red team `#e0584f`, blue team `#4c8fe0`; each name plate on the stage
   is tinted with a dark outline PLUS a coloured underline and a team initial (a cue that does not
   rely on colour alone); the panels and the strip use the same colours. The demo fighters' SKIN
   colours are random across both teams, which is why the name cue matters.
   **Built 2026-09-24 (H1):** `tools/arena/team-hud.js` (`teamStyleFor`, `namePlateFor`,
   `namePlateLayout`), drawn by `renderStage`'s name plate and `renderRoster`;
   `test/arena-team-hud.test.js`, `test/arena-team-hud-wiring.test.js`. The plate is the name in
   the side's colour stroked in `#0b0a0d`, a coloured underline over the same outline, and the
   side's initial (R, B) on a disc to the left; nothing reaches under the ring's `below` line.
   Contrast, WCAG 2.1: on the sand the colours alone reach only 1.4–3.4 : 1 (the build's sand shape
   667 `#602d18`; the authored bowl `#4a3a2b`–`#836b4b`), so the OUTLINE carries them — red 5.34,
   blue 5.94 against it — so a LIVING plate is drawn opaque (the light plate's 0.85 let the sand
   through the outline and the outline through the fill: red 4.39 : 1, Codex review of H1); a
   fallen fighter's still fades to 0.4. On the side panel's `--panel` red is 4.44 (under AA), so a
   roster row is drawn on `--ground`: red 4.90, blue 5.45.
6. **Camera (Q7b):** on a PERSON's turn only, the camera eases to also frame the acting fighter's
   ring (buttons, items row, rank arrows) with a margin, and every lit target while a reach preview
   shows; the ring is drawn at a FIXED on-screen size, capped at what the build shows at zoom 80,
   instead of growing with the survivors' close-up. AI and spectate turns stay byte-identical — the
   close-up and 1v1 untouched.
7. **The spell row never covers the bow buttons' words** ("Bombard", "Snipe", the arrow count).
8. **The grilling gate (Q6a, Q8a, Q9b)** — how the harness enforces this front end rather than
   invoking it on judgment: every commit carries a trailer, `Decided: <doc#section>` (a recorded
   grilling decision, like this section) or a class trailer (`Fix:`, `Docs:`, `Chore:`, `Test:`),
   checked by a `commit-msg` hook and re-checked in CI, so it binds Claude, Codex and humans
   identically (the harness's own rule: deterministic enforcement lives in git and CI, not agent
   hooks); and the workflow template refuses to start a feature slice with no `decided` pointer.
   The harness ships the hook, the CI template and `adopt.sh <project>`; this repository adopts it
   first; `docs/adoption-matrix.md` tracks the rest; the harness's ADR 0001 is amended.

9. **Jump and charge are SHOWN GREYED, "Not built yet"** (the owner, 2026-09-24, reversing the ring's
   decision 7 "stay hidden"): the engine's `not-built` reason (grey) already says so, and S9 draws it.
   **Their own design pass should consider lane changes** — e.g. a jump or charge that crosses ranks — as
   well as the build's sideways leap and the mid-charge attack (`Chargeattack`, unmodelled).

10. **Lanes: SOFT LANES is the direction** (the owner, 2026-09-24, after weighing free 2-D y): positions
    continuous in y WITHIN a lane's band (natural-looking), melee needs the same band (out-of-lane melee
    stays forbidden, as the engine already rules), area verbs such as whirlwind use a real 2-D radius, and
    lanes change by walk, jump or charge. **Free y is deferred, to be decided by DATA, "perhaps far
    later":** a spike with free y behind a flag and scripted cheese bots (a kiter, a corner-turtler, a
    wall-builder) against the AI in lanes / soft lanes / free y, compared on bout length, walking share,
    stall rate and exploit win rate. The analysis: free y opens flanking, area-effect spacing, formations
    and escape routes, but in a turn-based side-on game it invites kiting, tape-measure micro, turtling and
    AI exploitation, reads poorly in depth, and costs a spatial AI.

### Slices (tracked on the board)

- **HUD track** (starts now): **H1** team colours on the stage and the roster · **H2** the team panels
  with health / energy / armour, the turn highlight, condition chips, the "you" marker, and the crowd
  meter · **H3** the turn-order strip.
- **Ring and camera track** (after the running S9 and S8 land — the same files): **R1** the spell row
  clear of the bow's words · **R2** the reach preview · **C1** the camera frames a person's ring and
  the lit targets; the ring at a fixed on-screen size.
- **Gate track:** **G1** the harness: `githooks/commit-msg`, the CI template, `adopt.sh`, git-hygiene
  rule 14 and the ADR amendment · **G2** this repository adopts it, and the workflow template checks
  the `decided` pointer.

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
