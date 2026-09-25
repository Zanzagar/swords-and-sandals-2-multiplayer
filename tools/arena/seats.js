/**
 * WHO PLAYS WHICH FIGHTER — the arena's seats (slice 1 of
 * `docs/design/battle-ui.md`, 2026-09-24). Until this module every seat was
 * `controller: "local"`, so one person clicked for BOTH sides, and
 * `?spectate=1` had the AI play every seat. Nobody could play against the AI.
 *
 * ```text
 *   (no parameter)          every seat is played by hand here — the arena as it was
 *   ?play=red               you play red; the AI plays blue
 *   ?play=red-1             you play red-1; the AI plays everyone else, your own side included
 *   ?play=red-1,blue-2      several: sides and fighters, comma-separated, in any mix
 *   ?spectate=1             the AI plays every seat
 * ```
 *
 * ► **`play=`, AND NOT `?red=human&blue=ai`, BECAUSE `red=` AND `blue=` ARE
 *   TAKEN.** They name the build's own champions (`?red=2,4,16&blue=1,3,10`,
 *   `championRequestFrom` in `roster.js`), which refuses `red=human` as "not a
 *   which_boss number" — so the design doc's suggested spelling would have
 *   refused to start the arena. `play=` names what a PERSON plays and leaves
 *   every other seat to the AI, and it composes with the champions:
 *   `?red=2,4,16&blue=1,3,10&play=red` is you as three champions against three.
 *
 * ► **THE SEATS ARE DECLARED THROUGH THE ENGINE, NOT HELD BY THE SHELL.**
 *   `withSeatControllers` writes each member's `controller`, which the host
 *   hands to the roster, which hands it to the battle's own
 *   `ControllerRegistry` (`src/team/roster.js`, `buildRoster`). So the engine's
 *   `isAiControlled` answers "is this an AI seat?" — `seatTurnFor` asks it,
 *   rather than a flag of its own — and `chooseAiAction`'s guard refuses a
 *   human's seat. The controller is outside the combat state and its hash by
 *   construction (`toTeamWireState`, "It deliberately excludes controller
 *   identity"); `test/arena-seats.test.js` measures that it stays so.
 *
 * ► **`?spectate=1` DECLARES EVERY SEAT AI, where it used to leave them
 *   `local` and ask `suggestAction` for a deliberately human seat.** The choice
 *   is the same function either way (`chooseAiAction` is `suggestAction` plus
 *   the seat check), so a spectated bout plays exactly as it did; only the
 *   registry now says what the arena is actually doing.
 *
 * Refuses loudly, as `demoItemsFrom` and `championRequestFrom` do: a typo that
 * silently gave the AI your fighter would look like the controls being broken.
 */

import { ControllerKind } from "../../src/team/controllers.js";
import { currentCombatant, isAiControlled } from "../../src/team/resolver.js";

/** The three ways a bout's seats can be filled. */
export const SeatMode = Object.freeze({
  /** No parameter: every seat played by hand from this one screen — the arena before seats. */
  LOCAL: "local",
  /** `?play=`: the named seats are a person's, every other seat the AI's. */
  PLAY: "play",
  /** `?spectate=1`: every seat the AI's. */
  SPECTATE: "spectate"
});

/**
 * The seats the query string asks for, checked against the fighters actually
 * on the field.
 *
 * @param {URLSearchParams|{get: Function, has: Function}} params
 * @param {{id: string, members: {id: string}[]}[]} teams the roster, as
 *   `demoSide`/`championSide` build it
 * @returns {{mode: string, controllers: Record<string, string>, humans: string[], humanSides: string[]}}
 *   `controllers` maps every member id to `"local"` or `"ai"`; `humans` is the
 *   member ids a person plays, in roster order; `humanSides` the team ids that
 *   hold at least one of them.
 */
export function seatControllersFrom(params, teams) {
  if (!Array.isArray(teams) || teams.length === 0) throw new Error("Seats need the roster's teams.");
  const members = teams.flatMap((team) => team.members.map((member) => ({ teamId: team.id, id: member.id })));
  const has = (name) => Boolean(params) && typeof params.has === "function" && params.has(name);
  const get = (name) => (params && typeof params.get === "function" ? params.get(name) : null);
  // Exactly the test the shell made before seats, `params.get("spectate") ===
  // "1"`; this is now the parameter's only reader.
  const spectate = get("spectate") === "1";

  let mode = SeatMode.LOCAL;
  let human = () => true;
  if (has("play")) {
    const raw = String(get("play") ?? "");
    if (spectate) {
      throw new Error(
        `play=${raw} names the fighters a person plays, and spectate=1 gives every fighter to the AI. ` +
        "Drop one: spectate=1 to watch, or play= to play."
      );
    }
    const tokens = raw.split(",").map((token) => token.trim()).filter(Boolean);
    if (tokens.length === 0) {
      throw new Error(
        "play= is empty. Name a side or fighters, e.g. play=red or play=red-1,red-2 — or use spectate=1 to watch the AI " +
        "play everyone."
      );
    }
    const sides = new Set(teams.map((team) => team.id));
    const fighters = new Set(members.map((member) => member.id));
    const valid = [...sides, ...fighters];
    for (const token of tokens) {
      if (sides.has(token) || fighters.has(token)) continue;
      // A slot the roster could build but this bout did not is the likeliest
      // mistake (play=red-3 in a 2v2), so it gets its own sentence.
      const slot = /^([a-z]+)-(\d+)$/.exec(token);
      if (slot && sides.has(slot[1])) {
        const size = teams.find((team) => team.id === slot[1]).members.length;
        throw new Error(
          `play=${raw}: ${token} is not on the field — ${slot[1]} has ${size} fighter${size === 1 ? "" : "s"} this bout ` +
          `(${valid.filter((id) => id.startsWith(`${slot[1]}-`)).join(", ")}). Use teams= to field more.`
        );
      }
      throw new Error(`play=${raw}: ${JSON.stringify(token)} is neither a side nor a fighter here. Choose from ${valid.join(", ")}.`);
    }
    mode = SeatMode.PLAY;
    const named = new Set(tokens);
    human = (member) => named.has(member.teamId) || named.has(member.id);
  } else if (spectate) {
    mode = SeatMode.SPECTATE;
    human = () => false;
  }

  const controllers = {};
  const humans = [];
  const humanSides = [];
  for (const member of members) {
    const person = human(member);
    controllers[member.id] = person ? ControllerKind.LOCAL : ControllerKind.AI;
    if (!person) continue;
    humans.push(member.id);
    if (!humanSides.includes(member.teamId)) humanSides.push(member.teamId);
  }
  return Object.freeze({
    mode,
    controllers: Object.freeze(controllers),
    humans: Object.freeze(humans),
    humanSides: Object.freeze(humanSides)
  });
}

/**
 * The roster with each member's `controller` set to its seat's — the field
 * the host passes through to the battle's `ControllerRegistry`. Nothing else
 * on a member changes, so with no parameter (every seat `"local"`, which is
 * what both roster builders already write) the teams come back equal to the
 * ones that went in.
 */
export function withSeatControllers(teams, seats) {
  return teams.map((team) => ({
    ...team,
    members: team.members.map((member) => {
      const controller = seats?.controllers?.[member.id];
      if (controller !== ControllerKind.LOCAL && controller !== ControllerKind.AI) {
        throw new Error(`No seat was decided for ${member.id}.`);
      }
      return { ...member, controller };
    })
  }));
}

/**
 * WHOSE TURN IT IS, and what the arena does about it — the one decision the
 * shell's turn loop and its heading both read, so they cannot disagree.
 *
 * `ai` is the ENGINE's answer (`isAiControlled` over the battle's registry),
 * never a shell flag. `autoplay` is true only on an AI seat's turn AND with the
 * animation gate open: an AI move never fires while the previous action is
 * still being drawn. `choose` is true on a person's turn — the controls wait
 * for input, and are enabled only once the gate is open.
 *
 * Null once the battle is decided, or with nobody to act.
 *
 * @param {object} battle the host's battle
 * @param {{mode: string}} seats `seatControllersFrom`'s answer
 * @param {{ready: boolean}} gate whether the animation gate is open
 */
export function seatTurnFor(battle, seats, { ready = false } = {}) {
  if (!battle || battle.result) return null;
  const actor = currentCombatant(battle);
  if (!actor) return null;
  const ai = isAiControlled(battle, actor);
  const name = actor.name ?? actor.id;
  let heading;
  if (seats?.mode === SeatMode.SPECTATE) {
    // Kept word for word from the shell before seats: the spectator takes its
    // turn the instant the gate opens, so the waiting state was never the one
    // a person saw and must not read as a stall.
    heading = `Spectating — ${name}`;
  } else if (ai) {
    heading = `${name} (AI) is thinking…`;
  } else if (seats?.mode === SeatMode.PLAY) {
    heading = ready ? `Your turn: ${name}` : `Your turn: ${name} — wait for the arena`;
  } else {
    // Every seat by hand (no parameter): exactly the headings the arena had.
    heading = ready ? `${name} — choose` : "waiting for the arena";
  }
  return Object.freeze({
    actorId: actor.id, name, ai, ready: ready === true, autoplay: ai && ready === true, choose: !ai, heading
  });
}

/**
 * WHAT THE CONTROLS ON SCREEN WERE DRAWN FOR, as one comparable string: the
 * actor, whether the engine calls its seat AI, and whether the gate was open.
 * `"none"` once decided or with nobody to act.
 */
export function seatTurnKey(turn) {
  if (!turn) return "none";
  return `${turn.actorId}|${turn.ai ? "ai" : "person"}|${turn.ready ? "open" : "shut"}`;
}

/**
 * THE CONTROLS PANEL for a turn — the model `renderControls` draws, so what a
 * person can press is decided here, under the suite.
 *
 * An AI seat's turn is a note and NO buttons: the AI takes it once the gate
 * opens, and a click must never take a turn that is not a person's. A
 * person's turn is one button per legal action, enabled only with the gate
 * open. `key` is `seatTurnKey`: the shell keeps it to know when what it drew
 * has gone stale.
 *
 * @param {object|null} turn `seatTurnFor`'s answer
 * @param {object[]} legalActions the host's `legalActions()` for a person's turn
 * @param {{mode: string}} seats
 */
export function seatControlsFor(turn, legalActions, seats) {
  const key = seatTurnKey(turn);
  if (!turn) return Object.freeze({ key, note: null, buttons: Object.freeze([]) });
  if (turn.ai) {
    const note = seats?.mode === SeatMode.SPECTATE
      ? "The AI plays every fighter (?spectate=1)."
      : `${turn.name} is played by the AI; it moves once the arena has finished drawing.`;
    return Object.freeze({ key, note, buttons: Object.freeze([]) });
  }
  const buttons = (Array.isArray(legalActions) ? legalActions : [])
    .map((action) => Object.freeze({ action, enabled: turn.ready }));
  return Object.freeze({ key, note: null, buttons: Object.freeze(buttons) });
}

/**
 * ONE FRAME OF THE SHELL'S SEAT LOOP — whether the controls on screen are
 * stale, and whether an AI seat moves now.
 *
 * ► **`refresh` EXISTS FOR A SEAT HANDED OVER MID-BOUT (Codex review,
 *   gpt-6-astra, 2026-09-24).** The shell redraws its controls only on an
 *   event — an action submitted, an animation finished or abandoned — so a
 *   `reassignController` of the ACTING seat with the gate already open changed
 *   whose turn it was with nothing to redraw it: AI -> person left the AI's
 *   note up and no buttons for good (the person could never move), and person
 *   -> AI left a person's live buttons up until the AI's own move redrew them.
 *   Comparing what was DRAWN (`shownKey`) with what is TRUE every frame closes
 *   both, and the refresh comes BEFORE the AI's move so no frame ever acts for
 *   a seat whose controls still say otherwise.
 *
 * @param {object} battle
 * @param {{mode: string}} seats
 * @param {{ready: boolean, shownKey: string|null}} frame the gate, and the
 *   `key` of the controls last drawn
 */
export function seatFrameFor(battle, seats, { ready = false, shownKey = null } = {}) {
  const turn = seatTurnFor(battle, seats, { ready });
  const key = seatTurnKey(turn);
  return Object.freeze({ turn, key, refresh: key !== shownKey, autoplay: Boolean(turn?.autoplay) });
}

/**
 * The decided bout as the person at the screen sees it: `"won"`, `"lost"`,
 * `"draw"`, or null when there is no single "you" — every seat by hand (both
 * sides are yours), spectating (neither is), or a person on each side.
 */
export function seatOutcomeFor(result, seats) {
  if (!result) return null;
  if (!Array.isArray(seats?.humanSides) || seats.humanSides.length !== 1) return null;
  const winner = result.winnerTeamId ?? null;
  if (winner === null) return "draw";
  return seats.humanSides[0] === winner ? "won" : "lost";
}

/** The turn heading once the bout is decided. Without a single "you", the arena's own words. */
export function resultHeadingFor(result, seats, { settled = false } = {}) {
  const outcome = seatOutcomeFor(result, seats);
  if (outcome === "won") return "You won";
  if (outcome === "lost") return "You lost";
  if (outcome === "draw") return "A draw";
  return settled ? "Settled" : "Decided";
}

/**
 * A roster row's seat tag in a `play=` bout — `"you"` or `"AI"` — and null
 * otherwise, so the arena with no parameter, and a spectated one, look exactly
 * as they did.
 */
export function seatTagFor(seats, memberId) {
  if (seats?.mode !== SeatMode.PLAY) return null;
  return seats.humans.includes(memberId) ? "you" : "AI";
}

/** One log line naming who plays whom, e.g. "seats: you play Ruk (red-1); the AI plays Cidra (blue-1)". */
export function seatSummaryFor(seats, nameOf = (id) => id) {
  const label = (id) => {
    const name = nameOf(id);
    return name && name !== id ? `${name} (${id})` : id;
  };
  const ai = Object.keys(seats.controllers).filter((id) => seats.controllers[id] === ControllerKind.AI);
  if (seats.mode === SeatMode.LOCAL) return "seats: every fighter is played by hand from this screen (?play=red to play against the AI)";
  if (seats.mode === SeatMode.SPECTATE) return "seats: the AI plays every fighter";
  const parts = [`you play ${seats.humans.map(label).join(", ")}`];
  if (ai.length > 0) parts.push(`the AI plays ${ai.map(label).join(", ")}`);
  return `seats: ${parts.join("; ")}`;
}
