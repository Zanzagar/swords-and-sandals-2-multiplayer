/**
 * The per-action animation gate: "the resolver is ready" and "the surface is
 * ready" kept as two questions with two answers.
 *
 * WHY THIS EXISTS. Every presentation command carries the resolver `sequence`
 * it came from, which orders the commands *relative to each other*. Nothing
 * ordered them relative to **time**. A host that submitted action N+1 while
 * action N's timeline was still running rebound `_global.attacker` /
 * `_global.defender` / `game_attacker` / `game_defender` underneath it, and
 * vanilla's mapped functions read those globals rather than parameters
 * captured at dispatch. `docs/ss2-adapter-contract.md` carried that as a
 * documented hazard with a four-part sketch of the seam that would close it;
 * this module is parts (2) and (3) of that sketch, `presentation.js` is part
 * (1), and part (4) is deliberately absent — see "What this module refuses to
 * decide" below.
 *
 * WHAT A TOKEN IS, and the correction that shaped this module. The contract
 * and `presentation.js` both said "the resolver sequence is already unique per
 * action and would serve". **It is not.** `addEvent` stamps
 * `sequence: battle.events.length + 1`, so `sequence` is unique per EVENT, and
 * one action emits several. Measured, not argued — 5,708 actions over 40 seeds
 * at 1v1 and 3v3 under `ss2TeamRules`: 5,488 actions emitted one event, 140
 * emitted two (an attack that knocked someone down), and 80 emitted four (the
 * killing blow: the action, the knockout, `team-eliminated` and
 * `battle-result-pending`). That is a sweep of one rule set, not a law:
 * `assertActionOutcome` requires only that `events` be an array, so a rule set
 * may legally emit none or a dozen. Either way a token taken off
 * `event.sequence` splits one action into as many pieces as it has events, and
 * the host gates on the wrong number.
 *
 * The identifier that does work already exists and is already computed:
 * `lastResolvedAction(battle).firstEventSequence`. It is deliberately NOT in
 * `toTeamWireState`, and that is load-bearing rather than an oversight —
 * `combatStateHash` hashes the whole projection, so projecting an action
 * boundary would move every pinned battle hash and desync an old peer from a
 * new one. So the boundary is CARRIED BY THE CALLER into
 * `presentResolvedEvents`, never derived from the wire.
 *
 * WHAT THIS MODULE REFUSES TO DECIDE, because deciding it would put a guess at
 * the centre of the action loop:
 *
 * - **It never times out.** Nothing here counts wall-clock, holds a timer or
 *   gives up on a surface. A timeout is a policy decision about a particular
 *   animation surface, and no capture of the vanilla timeline's own completion
 *   signal exists to derive one from. A host that wants to stop waiting says
 *   so, in its own words, through `abandon(token, reason)` — which records the
 *   decision rather than making it.
 * - **It never reports on the surface's behalf.** `acknowledgement.js` learned
 *   this the expensive way: `acknowledgeResultAnimations` used to fabricate the
 *   death reports and the arena label it was itself waiting for, so both
 *   settlement gates were satisfied by the adapter talking to itself. A gate
 *   that supplies its own evidence is not a gate. Nothing in `battle-host.js`
 *   calls `report`; the only caller is whoever is driving the animation.
 * - **It never decides combat, and it cannot make a battle end.** It holds
 *   tokens and nothing else — no combatants, no battle, no state.
 *
 * It is deliberately separate from `acknowledgement.js`, whose state machine
 * has a different lifetime: that one arms once per battle and settles once,
 * this one opens and closes once per action, many times over.
 */

export class ActionAnimationError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = new.target.name;
  }
}

function assertToken(token, verb) {
  if (!Number.isInteger(token) || token <= 0) {
    throw new ActionAnimationError(
      `Cannot ${verb}: an action animation token is a positive integer resolver sequence, not ${String(token)}.`
    );
  }
}

class ActionAnimationGate {
  /** Every token this gate has been shown, in the order it first saw them. */
  #observed = [];
  #known = new Set();
  #reported = new Set();
  /** token -> the host's stated reason for giving up on it. */
  #abandoned = new Map();

  /**
   * Registers the action tokens a batch of presentation commands carried.
   *
   * Idempotent per token: a host that re-drains, or that hands the same batch
   * over twice, does not double-count. Commands with a null `actionToken` are
   * ignored, which is the honest reading of "the caller did not tell us where
   * this action began" rather than an invented boundary.
   *
   * @param {Iterable<{actionToken?: number|null}>} commands
   */
  observe(commands) {
    if (!commands || typeof commands[Symbol.iterator] !== "function") {
      throw new ActionAnimationError("observe() needs the iterable of presentation commands to register.");
    }
    const newly = [];
    for (const command of commands) {
      const token = command?.actionToken;
      if (token === null || token === undefined) continue;
      assertToken(token, "observe an action token");
      if (this.#known.has(token)) continue;
      this.#known.add(token);
      this.#observed.push(token);
      newly.push(token);
    }
    return Object.freeze({ observed: Object.freeze(newly), pending: this.pending });
  }

  /** Tokens observed and neither reported nor abandoned, in observation order. */
  get pending() {
    return Object.freeze(
      this.#observed.filter((token) => !this.#reported.has(token) && !this.#abandoned.has(token))
    );
  }

  /** Every token this gate has seen, in observation order. */
  get observed() {
    return Object.freeze([...this.#observed]);
  }

  /** Tokens the surface reported finished, in observation order. */
  get reported() {
    return Object.freeze(this.#observed.filter((token) => this.#reported.has(token)));
  }

  /** What the host gave up on, and the reason it gave. */
  get abandoned() {
    return Object.freeze(
      this.#observed
        .filter((token) => this.#abandoned.has(token))
        .map((token) => Object.freeze({ token, reason: this.#abandoned.get(token) }))
    );
  }

  /**
   * Whether the surface has answered for every action the host has dispatched.
   *
   * A gate that has been shown nothing is ready, which is correct and is why
   * the first action of a battle is never blocked.
   */
  get isReady() {
    return this.pending.length === 0;
  }

  /** Whether this token is one this gate was shown. */
  knows(token) {
    return this.#known.has(token);
  }

  #refuseUnknown(token, verb) {
    assertToken(token, verb);
    if (this.#known.has(token)) return;
    const seen = this.#observed.length === 0 ? "no action tokens" : `tokens ${this.#observed.join(", ")}`;
    throw new ActionAnimationError(
      `Cannot ${verb} ${token}: no presentation command carried it. This gate has been shown ${seen}. ` +
      "An unreachable token means presentation and the animation surface disagree about which action played; " +
      "accepting it would let a surface open a gate the host never dispatched."
    );
  }

  /**
   * The animation surface reports that one action's timeline reached its
   * terminal frame.
   *
   * Accepted once. A duplicate is **answered rather than thrown** — a surface
   * that fires a completion handler twice is a nuisance, not a desync, and the
   * caller can see it in `duplicate`. An unknown token IS refused.
   *
   * `outOfOrder` is reported, not refused: a surface finishing a later action
   * before an earlier one is unmeasured here rather than contradicted by
   * resolved state, and this module refuses only what resolved state can
   * contradict. `late` says the host had already abandoned this token, so the
   * animation finished after it stopped waiting.
   */
  report(token) {
    this.#refuseUnknown(token, "report an action animation for token");
    const duplicate = this.#reported.has(token);
    const late = this.#abandoned.has(token);
    const pendingBefore = this.pending;
    const outOfOrder = !duplicate && !late && pendingBefore.length > 0 && pendingBefore[0] !== token;
    this.#reported.add(token);
    this.#abandoned.delete(token);
    return Object.freeze({
      accepted: true,
      counted: !duplicate && !late,
      duplicate,
      late,
      outOfOrder,
      ready: this.isReady,
      pending: this.pending
    });
  }

  /**
   * The HOST decides to stop waiting for one action's timeline.
   *
   * This is where a timeout lands, and the reason is mandatory because the
   * decision is a policy this module does not own: something has to say, in
   * the record, that a gate was opened by a host giving up rather than by a
   * surface finishing. Abandoning an already-reported token is answered, not
   * thrown; an unknown token is refused exactly as in `report`.
   */
  abandon(token, reason) {
    this.#refuseUnknown(token, "abandon an action animation for token");
    if (typeof reason !== "string" || reason.trim().length === 0) {
      throw new ActionAnimationError(
        `Cannot abandon action animation ${token} without a reason. Giving up on a surface is a host policy ` +
        "decision, and the gate records the decision rather than making it — an unexplained abandonment is " +
        "indistinguishable from the surface having reported."
      );
    }
    if (this.#reported.has(token)) {
      return Object.freeze({
        accepted: true,
        counted: false,
        alreadyReported: true,
        ready: this.isReady,
        pending: this.pending
      });
    }
    const duplicate = this.#abandoned.has(token);
    this.#abandoned.set(token, reason);
    return Object.freeze({
      accepted: true,
      counted: !duplicate,
      duplicate,
      alreadyReported: false,
      ready: this.isReady,
      pending: this.pending
    });
  }

  /** Forgets every token. For a host rebinding a fresh battle onto one gate. */
  reset() {
    this.#observed = [];
    this.#known = new Set();
    this.#reported = new Set();
    this.#abandoned = new Map();
  }

  /** JSON-safe, for a host that wants to report or compare gate state. */
  toJSON() {
    return {
      observed: [...this.#observed],
      reported: [...this.reported],
      abandoned: this.abandoned.map(({ token, reason }) => ({ token, reason })),
      pending: [...this.pending],
      ready: this.isReady
    };
  }
}

export function createActionAnimationGate() {
  return new ActionAnimationGate();
}
