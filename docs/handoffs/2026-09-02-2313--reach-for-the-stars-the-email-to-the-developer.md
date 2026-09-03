---
handoff:      2026-09-02-2313--reach-for-the-stars-the-email-to-the-developer
written:      2026-09-02 23:13 -0400
sessionId:    426439d1-71ea-4b21-8f84-9782562bbba7 (https://claude.ai/code/session_0117WNCMTh4Uy619L7sbNvM4)
branch:       arena/champion-capture; `1aa9ef7` is on GitHub, this commit is
              NOT pushed (the project asks before every push).
suite:        721 / 720 / 0 / 1 (fresh-clone profile), measured 2026-09-02
              evening. Re-measure; never copy this line.
supersedes:   2026-09-02-1659--three-waves-cut-at-the-usage-limit — whose
              findings and ranked list are UNCHANGED and are not restated
              here. Read it second.
---
# Handoff — reach for the stars: the email to the developer

## The one-sentence version

The owner's FIRST task for the next session is to draft — never send — a
careful, respectful email from him to the developer of Swords & Sandals II
introducing himself and asking about collaboration or access to the source;
everything else (the 16:59 brief's ranked list) waits behind it.

## What changed since 16:59

- **The verification precedence is decided and enforced** (`1aa9ef7`, and
  `claude-harness` ADR `docs/adr/0001-verification-precedence.md`, pushed on
  its `standards/git-hygiene` branch): Pocock's skills first, Codex
  adversarial review on diffs, a fan-out wave LAST — one at a time, hard-capped
  at 6 questions / 6 verifiers in the script, `Workflow` in `permissions.ask`.
- **Ultracode stays ON, at the owner's instruction** ("Keep ultracode on
  always"). It raises the bar for exhaustiveness; it does not reopen the caps.
  **Drafting this email is SOLO work. Do not launch a wave to write an email.**

## THE FIRST TASK: the email — the owner's brief, in his words

> "I want to email the developer at whiskeybarrelstudios introducing myself as
> a phd candidate at penn state (you can describe my research) and explain that
> I am working on this project as a passion project in between my dissertation
> research to keep sane (humor). Explain what I am building (multiplayer and
> progression systems — word it in a way not to sound like I am violating his
> game's copyright etc), but ask him if he is interested in collaborating or
> even sharing the source code for the game. I want to treat this email very
> carefully and show reverence, respect, intrigue, and interest for
> collaboration and relationship."

**Before writing a word, three things the record cannot supply:**

1. **The owner's research.** Nothing in this repository, the harness or the
   memory describes it (grepped 2026-09-02: no hit for Penn State, PhD or
   dissertation that is about him). **Ask him for two or three sentences on it.
   Never invent a field, an advisor or a topic.**
2. **The recipient and the route.** The record does not name the developer or
   a contact address. Verify from the studio's own site / Steam page / socials
   who to write to and how they prefer to be reached, and put the source of
   that in the draft's header for the owner to see. Do not guess a name.
3. **Which facts the owner wants disclosed.** Offer him the honest inventory
   below and let him cut.

**What the email can say truthfully, from the record** (each is measured, and
each is what makes the ask defensible):

- He plays a licensed Steam copy (Classic Collection) and the project
  *requires* one: the repository ships no game asset, no extracted script, no
  art — the Doom source-port model, stated in `AGENTS.md` — and is
  non-commercial by rule.
- The work so far is INSTRUMENTATION, not modification: the installed game is
  kept byte-identical and used as a measurement oracle; a Ruffle-driven
  wrapper observes the game's own combat resolution; 23 runtime-verified
  fixtures each confirmed by two independent captures; a small resolver that
  reproduces the game's attack arithmetic and replays every fixture.
- What he is building on top: a shared, deterministic battle resolver for
  multiplayer (1v1 now, 2v2/3v3 shown feasible without touching an asset) and
  a progression/opponent system of his own design — new systems and new art,
  not redistribution of his.
- What he would love from the developer: conversation, blessing, design
  history, and — reaching for the stars — the source, under whatever terms
  the developer is comfortable with.

**Tone rules the owner set:** reverence and respect for a game he has loved
for a long time; genuine intrigue about how it was made; interest in a
relationship, not a transaction; light humor about the dissertation. Short.
No legalese, no "reverse-engineering" vocabulary, no claims about what the
project *will* become. Everything stated must be true of the repo today.

**Deliverable:** a draft in the reply (and in the scratchpad), with a
one-line note of every fact it asserts and where in the record it comes
from. The owner sends it himself. Offer two subject lines.

## Then, in order

The 16:59 brief's ranked list, unchanged: (1) land the role-based damage-pair
requirement and empty `REPLAY_UNDRIVABLE`; (2) put the enchantment fork to the
owner; (3) correct the map's status-arm section after a verifier; (4) the
schema question and `.claude/settings.local.json` remain the owner's.

## Hard rules (unchanged)

See the 16:59 brief; every one still applies. **Ask before every push.**
