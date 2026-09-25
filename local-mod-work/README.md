# Local mod work area

Use this ignored directory for independently authored scratch output and local
integration experiments. Keep the licensed installation read-only.

Do not place original or extracted SWFs, scripts, images, audio, or other game
assets here. ~~If a later checkpoint truly requires a derived game binary, stop
and obtain explicit approval for the exact local-only workflow first.~~

**Corrected 2026-09-24 — superseded by the owner's decision of 2026-09-02,
recorded in `AGENTS.md` ("BUILD THE BEST VERSION OF THE GAME").** This file was
written on 2026-08-29 and its last sentence treated a derived game binary as
something to stop for. It is not: modding the build is unblocked. What remains
are two narrow operational facts, and they decide WHERE things go rather than
WHETHER:

- **Extracted assets** from your own licensed copy go in the gitignored
  `assets/` (see `assets/README.md`), not here. A test fails if any of them is
  ever tracked; the rule is about what leaves the repository.
- **A modded build** goes in a SECOND install with its own fingerprint lane
  (`AGENTS.md`, "The installed SWF stays byte-identical"), never over the
  installed SWF, which is the measurement oracle every golden cites — and not
  here either.
