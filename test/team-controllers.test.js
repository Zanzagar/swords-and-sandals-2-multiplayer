/**
 * `src/team/controllers.js` — the seat → controller registry.
 *
 * WHY THIS FILE EXISTS. The mutation audit of 2026-09-07
 * (`docs/mutation-audit-2026-09-07.md`) returned this as one of three
 * structural findings that OUTRANKED the tasks the agents were given:
 *
 *   "`src/team/controllers.js` has ZERO negative tests. `ControllerError`
 *   appears nowhere under `test/`, and neither does its message text — so every
 *   throw in that file is a candidate survivor, and three of them are confirmed
 *   survivors."
 *
 * Re-derived here before it was believed, on a clean tree at `c22c91c`: with
 * each of the three mutations applied ONE AT A TIME the whole suite still
 * reported **849 pass / 0 fail**. They are named below, each against the test
 * that now kills it, so a reader can check the claim rather than take it.
 *
 * WHAT WAS ALREADY COVERED, and is deliberately not repeated. The module's
 * load-bearing invariant — "reassigning a controller must never change a combat
 * state hash" — is pinned in `test/team-resolver.test.js` ("controller identity
 * can be reassigned without touching combatant state or the combat hash"), and
 * the AI loop following the seat rather than the combatant is pinned beside it.
 * Those go through `reassignController`, which is a one-line pass-through to
 * `ControllerRegistry.reassign`. What had no test at all is this module's own
 * API: nothing under `test/` imported `controllerIdentity`,
 * `controllerKindForToken`, `controllerToken`, `ControllerRegistry` or
 * `createControllerRegistry`.
 *
 * A NEGATIVE TEST THAT ONLY CHECKS "it threw" IS HALF A TEST. Every refusal
 * below asserts the ERROR TYPE and matches its MESSAGE, because the audit's
 * point was that the message text appears nowhere either — an error whose
 * wording nothing pins can be rewritten into uselessness with a green suite.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  ControllerError,
  ControllerKind,
  ControllerRegistry,
  controllerIdentity,
  controllerKindForToken,
  controllerToken,
  createControllerRegistry
} from "../src/team/controllers.js";

/** Asserts a ControllerError whose message matches, not merely "it threw". */
function refuses(run, pattern, why) {
  assert.throws(run, (error) => {
    assert.ok(error instanceof ControllerError, `${why}: threw ${error.name}, not ControllerError`);
    assert.match(error.message, pattern, why);
    return true;
  }, why);
}

/* ------------------------------------------------------------------ */
/* The three confirmed mutation survivors                              */
/* ------------------------------------------------------------------ */

/**
 * SURVIVOR 1 — `controllers.js:92`, `if (!this.#seats.has(seatId)) {` → `if (false) {`.
 *
 * `reassign` differs from `assign` by that guard AND BY NOTHING ELSE: strip it
 * and `reassign` silently CREATES the seat it was asked to hand over, so a
 * typo'd or stale seat id invents a controller for a seat no combatant sits in.
 * That matters because seat ids come from the roster and from the wire, not
 * from the caller's imagination.
 */
test("reassign refuses an unknown seat instead of quietly inventing one", () => {
  const registry = new ControllerRegistry();
  registry.assign("red:slot-1", ControllerKind.LOCAL);

  refuses(
    () => registry.reassign("red:slot-2", ControllerKind.AI),
    /Unknown seat: red:slot-2/,
    "reassigning a seat that does not exist"
  );
  // The refusal must also leave nothing behind.
  assert.deepEqual(registry.seatIds(), ["red:slot-1"], "a refused reassign created no seat");
  assert.equal(registry.has("red:slot-2"), false);

  // And the guard is the ONLY difference from assign, which is why removing it
  // is invisible without this test: assign happily creates the same seat.
  registry.assign("red:slot-2", ControllerKind.AI);
  assert.deepEqual(registry.seatIds(), ["red:slot-1", "red:slot-2"]);
  assert.equal(registry.reassign("red:slot-2", ControllerKind.LOCAL).kind, ControllerKind.LOCAL);
});

/**
 * SURVIVOR 2 — `controllers.js:60`, `if (!KINDS.has(kind)) {` → `if (false) {`.
 *
 * Strip it and ANY value is a controller kind. `src/campaign/record.js` builds
 * its own `CONTROLLER_KINDS` set from `ControllerKind`, so a kind this module
 * lets through is a kind the campaign record has to reject later, or store.
 */
test("an unsupported controller kind is refused, and every supported one is accepted", () => {
  for (const kind of ["player", "AI", "Local", "", null, undefined, 0, {}]) {
    refuses(
      () => controllerIdentity({ kind, id: "someone" }),
      /Unsupported controller kind/,
      `kind ${JSON.stringify(kind)} must be refused`
    );
  }

  // The sweep asserts it found the accepting case too, or it proves nothing:
  // a guard that refused EVERYTHING would pass the block above.
  const accepted = Object.values(ControllerKind).map(
    (kind) => controllerIdentity({ kind, id: "someone" }).kind
  );
  assert.deepEqual(accepted, ["local", "hot-seat", "remote", "ai"]);
  assert.equal(accepted.length, Object.keys(ControllerKind).length);
});

/**
 * SURVIVOR 3 — `controllers.js:63`, `const resolvedId = id ?? kind;` → `id || kind`.
 *
 * `??` falls back only for null/undefined; `||` also falls back for `""` and
 * `0`. So the mutant turns "a controller id must be a non-empty string" into
 * "an empty id silently becomes the kind name" — and two seats given the empty
 * id would then share one identity while looking deliberate.
 */
test("an empty or non-string id is refused, and is NOT quietly replaced by the kind", () => {
  for (const id of ["", 0, false, Number.NaN, 7, {}, []]) {
    refuses(
      () => controllerIdentity({ kind: ControllerKind.LOCAL, id }),
      /A controller id must be a non-empty string/,
      `id ${JSON.stringify(id)} must be refused`
    );
  }

  // The fallback that IS intended: an ABSENT id means "named after its kind".
  // This is the half the mutation preserves, which is why it survived.
  assert.deepEqual(controllerIdentity({ kind: ControllerKind.AI }), {
    kind: "ai", id: "ai", label: "ai"
  });
  assert.deepEqual(controllerIdentity({ kind: ControllerKind.AI, id: undefined }), {
    kind: "ai", id: "ai", label: "ai"
  });
  assert.deepEqual(controllerIdentity({ kind: ControllerKind.AI, id: null }), {
    kind: "ai", id: "ai", label: "ai"
  });
});

/* ------------------------------------------------------------------ */
/* The remaining throws, none of which had a test                      */
/* ------------------------------------------------------------------ */

test("a controller token must be a non-empty string", () => {
  for (const token of ["", null, undefined, 5, {}, [], true]) {
    refuses(
      () => controllerKindForToken(token),
      /A controller token must be a non-empty string/,
      `token ${JSON.stringify(token)} must be refused`
    );
  }
});

test("a controller spec must be a token string or an object", () => {
  for (const spec of [null, undefined, 5, true, [], [ControllerKind.AI]]) {
    refuses(
      () => controllerIdentity(spec),
      /must be a token string or a \{ kind, id \} object/,
      `spec ${JSON.stringify(spec)} must be refused`
    );
  }
});

test("a label, when present, must be a non-empty string — and absent is not present", () => {
  for (const label of ["", 0, false, null, 7, {}]) {
    refuses(
      () => controllerIdentity({ kind: ControllerKind.LOCAL, id: "p1", label }),
      /A controller label must be a non-empty string when present/,
      `label ${JSON.stringify(label)} must be refused`
    );
  }
  // Absent means "default to the id", and must NOT be caught by the guard.
  assert.equal(controllerIdentity({ kind: ControllerKind.LOCAL, id: "p1" }).label, "p1");
  assert.equal(controllerIdentity({ kind: ControllerKind.LOCAL, id: "p1", label: undefined }).label, "p1");
});

test("a seat id must be a non-empty string, on assign and through reassign", () => {
  const registry = new ControllerRegistry();
  for (const seatId of ["", null, undefined, 5, {}, []]) {
    refuses(
      () => registry.assign(seatId, ControllerKind.AI),
      /A seat id must be a non-empty string/,
      `seat id ${JSON.stringify(seatId)} must be refused`
    );
  }
  // A bad seat id reaches the unknown-seat guard first through reassign, which
  // is a different message for a different reason. Both are refusals.
  refuses(() => registry.reassign("", ControllerKind.AI), /Unknown seat/, "reassigning an empty seat id");
  assert.deepEqual(registry.seatIds(), [], "no refusal created a seat");
});

test("reading an unknown seat is refused rather than answered with undefined", () => {
  const registry = new ControllerRegistry();
  refuses(() => registry.identityFor("nobody"), /Unknown seat: nobody/, "identityFor on an unknown seat");
  // `isAi` reads through `identityFor`, so it must refuse rather than answer
  // `false` — "this seat is not AI" and "there is no such seat" are different
  // facts and an AI loop that conflates them skips a turn silently.
  refuses(() => registry.isAi("nobody"), /Unknown seat: nobody/, "isAi on an unknown seat");
  assert.equal(registry.has("nobody"), false, "but `has` is the question that may be answered");
});

test("registry entries must be objects", () => {
  for (const entry of [null, undefined, "ai", 5, true]) {
    refuses(
      () => createControllerRegistry([entry]),
      /Controller entries must be objects/,
      `entry ${JSON.stringify(entry)} must be refused`
    );
  }
});

/* ------------------------------------------------------------------ */
/* The positive contract, which had no test either                     */
/* ------------------------------------------------------------------ */

test("legacy tokens map onto kinds by prefix, and everything else is a remote peer", () => {
  const cases = [
    ["ai", ControllerKind.AI],
    ["ai:hard", ControllerKind.AI],
    ["local", ControllerKind.LOCAL],
    ["local:2", ControllerKind.LOCAL],
    ["hot-seat", ControllerKind.HOT_SEAT],
    ["hot-seat:pad-2", ControllerKind.HOT_SEAT],
    // Both spellings, because `src/engine.js` accepted both before the seam.
    ["hotseat", ControllerKind.HOT_SEAT],
    ["hotseat:pad-2", ControllerKind.HOT_SEAT],
    ["peer-7f", ControllerKind.REMOTE],
    // The prefix tests are anchored on `:`, so a token that merely STARTS with
    // the letters is a remote peer. A `startsWith("ai")` bug would make the
    // first three of these AI, and nothing else in the suite would notice.
    ["ailment", ControllerKind.REMOTE],
    ["aixelrod", ControllerKind.REMOTE],
    ["localhost", ControllerKind.REMOTE],
    ["hot-seating", ControllerKind.REMOTE],
    ["hotseating", ControllerKind.REMOTE]
  ];
  for (const [token, kind] of cases) {
    assert.equal(controllerKindForToken(token), kind, `${token} is ${kind}`);
  }
  assert.ok(
    cases.filter(([, kind]) => kind === ControllerKind.REMOTE).length >= 6,
    "the sweep must actually exercise the remote default"
  );
});

test("a bare token round-trips losslessly, which is what the legacy projection needs", () => {
  // The module's own claim: "A bare string keeps its exact token, so the legacy
  // projection in src/engine.js round-trips losslessly."
  for (const token of ["ai", "ai:hard", "local", "local:2", "hot-seat:pad-2", "hotseat", "peer-7f", "ailment"]) {
    const identity = controllerIdentity(token);
    assert.equal(controllerToken(identity), token, `${token} survived the round trip`);
    assert.equal(identity.id, token);
    assert.equal(identity.label, token, "a bare token is its own label");
  }
  // An object spec's token is its id, not its kind — the distinction the third
  // survivor erased.
  assert.equal(controllerToken(controllerIdentity({ kind: ControllerKind.LOCAL, id: "local:2" })), "local:2");
});

test("an identity is frozen, so a caller cannot edit a controller in place", () => {
  const identity = controllerIdentity({ kind: ControllerKind.REMOTE, id: "peer-7f", label: "Ruk" });
  assert.equal(Object.isFrozen(identity), true);
  assert.deepEqual(identity, { kind: "remote", id: "peer-7f", label: "Ruk" });
  assert.throws(() => {
    "use strict";
    identity.kind = ControllerKind.LOCAL;
  }, TypeError);
});

test("the seat projection is ordered, JSON-safe, and carries no combat state", () => {
  const registry = createControllerRegistry([
    { seatId: "red:slot-1", controller: "local" },
    { seatId: "blue:slot-1", controller: { kind: ControllerKind.REMOTE, id: "peer-7f", label: "Cid" } },
    // The second accepted entry shape: the entry IS the spec, via
    // `entry.controller ?? entry`. Undocumented until now and untested.
    { seatId: "red:slot-2", kind: ControllerKind.AI }
  ]);

  assert.deepEqual(registry.seatIds(), ["red:slot-1", "blue:slot-1", "red:slot-2"], "insertion order");
  assert.deepEqual(registry.toJSON(), [
    { seatId: "red:slot-1", kind: "local", id: "local", label: "local" },
    { seatId: "blue:slot-1", kind: "remote", id: "peer-7f", label: "Cid" },
    { seatId: "red:slot-2", kind: "ai", id: "ai", label: "ai" }
  ]);
  // JSON-safe means it survives the round trip a wire projection would make.
  assert.deepEqual(JSON.parse(JSON.stringify(registry.toJSON())), registry.toJSON());
  assert.equal(registry.isAi("red:slot-2"), true);
  assert.equal(registry.isAi("red:slot-1"), false);
});

test("reassigning replaces a seat rather than adding one, and keeps its position", () => {
  const registry = createControllerRegistry([
    { seatId: "a", controller: "local" },
    { seatId: "b", controller: "ai" }
  ]);
  registry.reassign("a", { kind: ControllerKind.REMOTE, id: "peer-9" });
  assert.deepEqual(registry.seatIds(), ["a", "b"], "no seat was added, and none moved");
  assert.equal(registry.identityFor("a").id, "peer-9");
});

test("a clone is independent in both directions", () => {
  const original = createControllerRegistry([{ seatId: "a", controller: "local" }]);
  const copy = original.clone();
  assert.deepEqual(copy.toJSON(), original.toJSON());

  copy.assign("b", ControllerKind.AI);
  copy.reassign("a", ControllerKind.AI);
  assert.deepEqual(original.seatIds(), ["a"], "the original gained no seat");
  assert.equal(original.identityFor("a").kind, ControllerKind.LOCAL, "and kept its controller");

  original.assign("c", ControllerKind.HOT_SEAT);
  assert.equal(copy.has("c"), false, "and the copy gained none either");
});

test("an empty registry is a registry, not a special case", () => {
  const registry = createControllerRegistry();
  assert.deepEqual(registry.seatIds(), []);
  assert.deepEqual(registry.toJSON(), []);
  assert.deepEqual(registry.clone().toJSON(), []);
  assert.equal(registry.has("anything"), false);
});
