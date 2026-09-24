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
  - `unavailableActions(actor)`: the verbs `legalActions` withheld, with a reason code (`other-rank`,
    `out-of-reach`, `body-blocks`, `in-reach` for taunt, `level`, `slot-empty`, `no-ammo`, `wall`).
  - A test pins that the preview equals what resolution uses.
- **Targeting state machine**: Idle → Action chosen → (Choosing target) → Ready → Sent. Esc steps back
  one state. The existing per-action animation gate keeps the dock read-only while the arena plays
  the last action.
- **Accessibility**: real buttons; the keyboard map (Q W E R fight, 1–6 slots, A D walk, ↑ ↓ rank;
  while targeting, 1–3, Tab, Enter, Esc); every state change announced in an aria-live region.

## From the build, or authored for team play

- **From the build:** which verbs a stance offers (the eight controller slots per frame; battle map
  "Buttons wired per controller frame"), hit chances, damage, energy costs, the three HUD readings,
  the crowd's ten moods and its 20 / 70 thresholds, and the damage pop-ups (built, 62b9cdd).
- **Authored:** the four groups, the target step and reason codes, a row per fighter, rank lanes, the
  turn-order strip, the keyboard map and the phone layout.

## Delivery order

1. **Seats**: choose which fighters a human plays, with the rest AI (e.g. `?red=human&blue=ai`), using
   the existing ControllerRegistry. This is the first time anyone can play against the AI.
2. **Action dock**: the model and the four groups replace the raw buttons.
3. **Targeting overlay**: rings, numbers, dimming, and the one-target shortcut.
4. **Team HUD**: fighter rows, the turn strip and the crowd meter.
5. **Previews and reasons**: the two engine additions.
6. **Phone**: once the desktop version has been played.

No slice may change combat state, a hash or a random draw. The golden census proves it on every merge.
