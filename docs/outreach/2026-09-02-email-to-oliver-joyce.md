# Outreach — Oliver Joyce, Whiskeybarrel Studios

**Status: SENT.** Reported by the owner on 2026-09-07; the record does not hold
the exact send timestamp or the transport used. The text below is the SENT
version, pasted by the owner, not the 2026-09-02 draft — the draft's research
paragraph was rewritten by him and the signature block was filled in.

**No reply is recorded.** If one arrives, append it here rather than to a
handoff: a handoff freezes at the end of its session, this file does not.

## Recipient and route — VERIFIED 2026-09-07, not assumed

Fetched that day from the studio's own press kit,
`http://whiskeybarrelstudios.com/press/index.php` (HTTP 200):

- *"Team & Repeating Collaborator — Oliver Joyce, Founder, Whiskeybarrel
  Studios"*; *"Contact — Oliver Joyce info@whiskeybarrelstudios.com"*;
  *"Based in Sydney, Australia"*.
- Socials on the same page: `twitter.com/oliver_joyce`,
  `facebook.com/WhiskeybarrelStudios`, Whiskeybarrel Studios @ YouTube.
- Official Discord `discord.com/invite/swordsandsandals` (search-verified, NOT
  on the press page).
- **eGames is real and is named by the studio itself**: *"he teamed up with
  Aram Fuchs at eGames, who had acquired the rights to the long dormant Swords
  and Sandals brand from the old company"* — which is what makes the email's
  *"and eGames, if it is their call too"* an accurate hedge rather than a guess.

## Every factual claim the email makes about this project, and where it comes from

| Claim in the email | Where the record backs it |
| --- | --- |
| own Steam copy of the Classic Collection | `AGENTS.md`; the install is the measurement oracle |
| "a deterministic battle engine" for two players | `src/team/`, `node tools/hotseat.mjs` plays a fight |
| "and, it turns out, up to six" | `27ef6a1`, a VERIFIED wave (30/30 returned): 2v2 and 3v3 need no new or altered asset |
| "a couple of dozen of those verified rounds" | 23 goldens in `test/fixtures/ss2-1v1-golden/` |
| each confirmed twice | golden `provenance.observationIds` carries >=2 ids from >=2 sessions (spot-checked on the armoured and prisoner goldens, 2026-09-07) |
| "the installed game is untouched" | byte-identical rule, `AGENTS.md`; sha256 cited by all 23 goldens, 70 observations and every manifest |
| "ships none of your art, code or data" | the Doom source-port model, `AGENTS.md` |
| "it will never be sold" | *"Never distributed FOR PROFIT"*, `AGENTS.md` |
| "would still need their own copy" | same rule, stated as its purpose |

## ONE CLAIM IN THE SENT TEXT OVERSTATES THE RECORD

> "Every number in it was observed in the real game and confirmed twice"

**True of the 23 goldens. NOT true of the engine.** `src/team/ss2-rules.js:914`
builds its rule set with `kind: "map-derived"` and **`runtimeVerified: false`** —
the SS2 arithmetic the resolver runs was read from the build's bytecode, and the
`map-derived` tier exists precisely to keep that distinct from what a capture
measured. The accurate sentence is *"every fixture the engine replays against
was observed in the real game and confirmed by two independent capture
sessions."*

Flagged, not fixed: the mail is sent. It is recorded here so that if Oliver ever
asks how the numbers were obtained, the answer given is the one the repo can
defend — and because this project's standing rule is to flag its own mistakes in
its own record rather than quietly correct them.

## Subject lines offered to the owner (which was used is not recorded)

1. A long-time Swords & Sandals fan with a hopeful question about collaboration
2. Swords & Sandals II, a PhD, and a passion project I'd love to show you

---

## The sent text

**To:** info@whiskeybarrelstudios.com

Hi Oliver,

My name is Corey Hoydic. I'm a PhD candidate at Penn State, and I've been playing Swords & Sandals for longer than I'd like to admit. I'm writing to introduce myself, to say thank you, and to ask a hopeful question.

The day job first. My dissertation is in computational geoscience, building what amounts to a searchable library of geological analogs: given a few sparse observations of the subsurface (say a handful of wells and a seismic survey), find the known systems that share its essential structure. If you are keen to the technical side, I am combining geostatistics, mathematical topology, and learned vision models to find out where these views agree. It is slow, careful, occasionally maddening work, and somewhere in the middle of it I needed something to keep me sane. It turns out the healthiest response to a chapter on persistent homology is to go and hit a gladiator with a mace.

That escape has grown into a passion project. Using my own Steam copy of the Classic Collection, I've been building a multiplayer foundation alongside Swords & Sandals II: a deterministic battle engine that lets two players (and, it turns out, up to six) fight under the same rules, plus a progression and opponent system of my own design to sit beside it. Most of my time so far has actually gone into fidelity, measuring how your combat plays out one round at a time so that the engine reproduces it faithfully rather than approximating it. Every number in it was observed in the real game and confirmed twice, and there are a couple of dozen of those verified rounds now. Nothing of yours is redistributed: the installed game is untouched, the project ships none of your art, code or data, and it will never be sold. Anyone who wanted to play would still need their own copy of your game, which is exactly how I want it.

I'll be honest about why I'm writing. Partly I would love to hear how the game was made: what you were thinking when you designed the arena, what you were proud of, what you'd do differently. Partly I'd be delighted to collaborate in any form you'd find worthwhile. And, reaching for the stars, if you were ever open to sharing the source of Swords & Sandals II, under whatever terms you (and eGames, if it is their call too) would be comfortable with, it would turn months of careful measurement into something I could build on properly, and I would treat it with the care it deserves.

If none of that appeals, a reply saying "carry on, have fun" would still make my month. Thank you for the game. It has been a very good companion.

With respect and admiration,

Corey Hoydic
PhD Candidate | John & Willie Leone Department of Energy & Mineral Engineering
The Pennsylvania State University

> **[Postal address, phone and PSU email REDACTED — this repository is
> PUBLIC.]** The sent mail carried all three in the signature block. They are
> the owner's to publish, not mine: say the word and the verbatim block goes
> back in. Nothing evidentiary is lost by their absence — no measurement, no
> provenance and no claim in the table above depends on them.
