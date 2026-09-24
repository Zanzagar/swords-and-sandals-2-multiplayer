export const meta = {
  name: 'implement-slices',
  description: 'Build decided slices: file-disjoint tracks, each slice test-first in a pre-made worktree and Codex-reviewed to approve, then at most 6 write-nothing verifiers; a slice with no decided pointer or class never starts',
  whenToUse: 'Implementing several already-DECIDED slices (a grilling round recorded in a doc) across file-disjoint worktrees, e.g. overnight. Every slice names the decision it implements (`decided: "path#anchor"`) or its class (fix|docs|chore|test); that is the commit trailer claude-harness docs/git-hygiene.md rule 14 requires, and this script refuses to start without it.',
  phases: [
    { title: 'Preflight', detail: 'one low-effort agent resolves every decided pointer at the base commit; any miss refuses the run' },
    { title: 'Build', detail: 'one implementer per slice, sequential within a track, tracks in parallel' },
    { title: 'Verify', detail: 'write-nothing verifiers, one named claim each, at most 6 in the run' },
  ],
}

// args: {
//   project: string,        // how prompts name the project, e.g. 'the Swords & Sandals II multiplayer repo'
//   base: string,           // the commit every worktree starts from
//   night: string,          // scratch root: reports, cumulative diffs, verifier scratch (agents get private subdirs)
//   mainTree: string,       // the project's main tree: READ-ONLY to every agent
//   codex: string,          // pinned Codex review command, run as: <codex> <worktree> <outfile> "<focus>"
//   suite: string,          // the full test command, run from the worktree
//   suiteExpect: string,    // what a green run looks like there, e.g. 'expect 0 fail and 1 skipped (the archive check)'
//   binding?: string[],     // project rules every implementer is bound by (one line each)
//   checks?: string[],      // extra steps after the suite; "{scratch}" becomes the slice's scratch dir
//   verifyFrom?: string,    // what verifiers re-derive claims from, besides the code
//   checker?: string,       // the check-trailers the preflight runs; default <mainTree>/.githooks/check-trailers
//                           //   (pass claude-harness githooks/check-trailers if the main tree has not adopted the gate)
//   maxCodexPasses?: number,// default 4
//   tracks: [{
//     key, worktree, branch,
//     files: string,        // the files this track may touch
//     chain?: boolean,      // later slices build on earlier ones; a failed slice stops the track
//     binding?: string[],   // extra rules for this track only
//     checks?: string[],    // replaces args.checks for this track
//     slices: [{
//       key, brief,
//       decided?: 'path#anchor',          // THE GATE: the recorded decision this slice implements,
//       class?: 'fix'|'docs'|'chore'|'test' // or the class of a slice that needs no decision.
//     }],
//     verifiers: string[],  // claims to break, one verifier each
//   }],
// }
//
// Returns { status: 'complete' | 'INCOMPLETE', started, briefs, deadAgents,
// notStarted, results }. INCOMPLETE means an agent died or a slice never
// started: a track with a dead verifier is UNVERIFIED, not done.
//
// THE GATE (claude-harness docs/git-hygiene.md rule 14; the owner's decision,
// recorded in the SS2 repo's docs/design/battle-ui.md#decided-hud-2026-09-24,
// item 8): every commit carries `Decided: <path>#<anchor>` or a class trailer,
// and a slice with neither is refused HERE, before any agent spawns, so a
// feature cannot be built on judgment and given a pointer afterwards. A
// pointer's SHAPE is checked here; that it RESOLVES at the base commit (the
// decision was recorded before the run, not during it) is checked by the one
// preflight agent below, before any implementer: this sandbox has no
// filesystem, and the commit-msg hook only sees the tree at commit time.

const A = args
if (!A || !Array.isArray(A.tracks) || A.tracks.length === 0) {
  throw new Error('implement-slices: args.tracks[] required (see the args block at the top of the script)')
}
for (const k of ['project', 'base', 'night', 'mainTree', 'codex', 'suite', 'suiteExpect']) {
  if (typeof A[k] !== 'string' || A[k] === '') throw new Error(`implement-slices: args.${k} (string) is required`)
}

const CLASSES = ['fix', 'docs', 'chore', 'test']
const DECIDED = /^[^/#\s][^#]*#[^#\s]+$/
const titled = (c) => c[0].toUpperCase() + c.slice(1)
const trailerFor = (s) => (s.decided ? `Decided: ${s.decided}` : `${titled(s.class)}: <why>`)

const refused = []
// A POSIX path with ".", ".." and repeated "/" resolved, so "/wt/./a" and
// "/wt/a" compare equal. The sandbox has no filesystem, so a SYMLINK alias of
// a worktree cannot be seen here: give every track its real path.
function normal(path) {
  const out = []
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') out.pop(); else out.push(part)
  }
  return `/${out.join('/')}`
}
const mainTree = normal(A.mainTree)
// Tracks run in parallel, so each needs its own worktree; scratch paths are
// <night>/<track>/<slice>, so keys must not repeat either.
const seenTracks = new Set()
const byWorktree = new Map()
for (const t of A.tracks) {
  if (!t || !t.key || !Array.isArray(t.slices) || t.slices.length === 0) {
    refused.push(`${t && t.key ? t.key : '(unnamed track)'}: a track needs a key and at least one slice`)
    continue
  }
  if (seenTracks.has(t.key)) refused.push(`track key "${t.key}" appears twice; its slices would share scratch paths`)
  seenTracks.add(t.key)
  if (typeof t.worktree !== 'string' || t.worktree === '' || typeof t.branch !== 'string' || t.branch === '') {
    refused.push(`${t.key}: a track needs its own worktree and branch`)
  } else if (!t.worktree.startsWith('/')) {
    refused.push(`${t.key}: worktree "${t.worktree}" must be an absolute path`)
  } else {
    const w = normal(t.worktree)
    if (w === mainTree) refused.push(`${t.key}: worktree ${t.worktree} is the main tree, which is read-only to every agent`)
    byWorktree.set(w, [...(byWorktree.get(w) || []), t.key])
  }
  const seenSlices = new Set()
  for (const s of t.slices) {
    const name = `${t.key}:${s && s.key ? s.key : '(unnamed slice)'}`
    if (s && s.key && seenSlices.has(s.key)) refused.push(`${name}: slice key appears twice in the track`)
    if (s && s.key) seenSlices.add(s.key)
    if (!s || !s.key || !s.brief) { refused.push(`${name}: a slice needs a key and a brief`); continue }
    if (s.decided === undefined && s.class === undefined) {
      refused.push(`${name}: carries neither \`decided\` ("path#anchor", the recorded grilling decision it implements) nor \`class\` (${CLASSES.join('|')}). Grill it and record the decision first, or give it a class.`)
      continue
    }
    if (s.decided !== undefined && (typeof s.decided !== 'string' || !DECIDED.test(s.decided))) {
      refused.push(`${name}: decided "${s.decided}" must be <repo-relative-path>#<anchor>`)
    }
    if (s.class !== undefined && !CLASSES.includes(s.class)) {
      refused.push(`${name}: class "${s.class}" must be one of ${CLASSES.join(', ')}`)
    }
  }
}
for (const [w, keys] of byWorktree) {
  if (keys.length > 1) refused.push(`worktree ${w} is named by tracks ${keys.join(', ')}; parallel tracks would overwrite each other there`)
}
// The cap on verifiers is claude-harness docs/adr/0001's: at most 6 in a run.
const MAX_VERIFIERS = 6
const verifierCount = A.tracks.reduce((n, t) => n + (Array.isArray(t && t.verifiers) ? t.verifiers.length : 0), 0)
if (verifierCount > MAX_VERIFIERS) {
  refused.push(`${verifierCount} verifiers requested; the hard cap is ${MAX_VERIFIERS} per run (claude-harness docs/adr/0001). Keep the most load-bearing claims.`)
}
if (refused.length) {
  throw new Error(`implement-slices refused to start; no agent was spawned:\n- ${refused.join('\n- ')}`)
}

const PREFLIGHT = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          pointer: { type: 'string', description: 'the pointer exactly as given, path#anchor' },
          resolved: { type: 'boolean', description: 'true ONLY if the command exited 0' },
          output: { type: 'string', description: 'the command\'s output and exit status, verbatim' },
        },
        required: ['pointer', 'resolved', 'output'],
      },
    },
  },
  required: ['results'],
}

const IMPL = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['done', 'partial', 'blocked'] },
    summary: { type: 'string', description: 'what was built, <=150 words' },
    wrongPremises: { type: 'string', description: 'premises in the brief that were wrong; "none" if none' },
    codexPasses: { type: 'array', items: { type: 'string' }, description: 'verdict of each Codex pass in order, e.g. needs-attention, approve' },
    codexFinalFile: { type: 'string' },
    suite: { type: 'string', description: 'tests / pass / fail / skipped, exact' },
    checks: { type: 'string', description: 'the result of each extra check, or "none"' },
    diffstat: { type: 'string' },
    ownerDecisions: { type: 'string', description: 'anything the owner must decide; "none" if none' },
    handoffLines: { type: 'string', description: 'lines for the project\'s handoff document; "none" if none' },
    reportFile: { type: 'string' },
    trailer: { type: 'string', description: 'the exact trailer line this slice\'s commit carries (claude-harness git-hygiene rule 14): "Decided: <path>#<anchor>" or "<Class>: <why>"' },
  },
  required: ['status', 'summary', 'wrongPremises', 'codexPasses', 'suite', 'diffstat', 'reportFile', 'trailer'],
}
const VERDICT = {
  type: 'object',
  properties: {
    claim: { type: 'string' },
    verdict: { type: 'string', enum: ['HOLDS', 'PARTIALLY-BROKEN', 'BROKEN', 'UNVERIFIABLE'] },
    evidence: { type: 'string', description: 'commands, numbers, file:line — enough to re-run' },
    smallestFix: { type: 'string' },
  },
  required: ['claim', 'verdict', 'evidence'],
}

const pad = (i) => String(i + 1).padStart(2, '0')
const lines = (xs) => (xs && xs.length ? xs.map((x) => `- ${x}`).join('\n') + '\n' : '')
const maxPasses = Number.isInteger(A.maxCodexPasses) && A.maxCodexPasses > 0 ? A.maxCodexPasses : 4

function decisionBlock(s) {
  if (s.decided) {
    const [path, anchor] = [s.decided.slice(0, s.decided.indexOf('#')), s.decided.slice(s.decided.indexOf('#') + 1)]
    return `THE DECISION THIS SLICE IMPLEMENTS: ${s.decided}
Read that section of ${path} first: it is the spec, recorded by the owner in a grilling round. Where the brief below and the decision disagree, the decision wins and the disagreement is a finding. If the project has .githooks/check-trailers, confirm the pointer resolves: \`sh .githooks/check-trailers --anchors < ${path} | grep -Fx '${anchor}'\`; a pointer that does not resolve is a wrong premise.`
  }
  return `THIS SLICE'S CLASS: ${s.class} (a ${s.class} change needs no recorded decision). If it turns out to need a design decision the owner has not made, stop and report it under ownerDecisions instead of making it.`
}

function implPrompt(t, s, i) {
  const n = t.slices.length
  const earlier = t.slices.slice(0, i).map((x) => x.key).join(', ')
  const scratch = `${A.night}/${t.key}/${s.key}`
  const checks = (t.checks || A.checks || []).map((c) => c.split('{scratch}').join(scratch))
  return `You are an IMPLEMENTER on ${A.project}: slice "${s.key}" (${i + 1} of ${n}) of the track "${t.key}". The main session merges and commits; you build, test and get Codex to approve.

WORKTREE: ${t.worktree} — cd there for EVERY command. Branch ${t.branch}, based on commit ${A.base}.
${i === 0
    ? 'It should be clean: `git status --short` prints nothing. If it is not clean, stop and report.'
    : `It already holds this track's EARLIER slices, uncommitted (${earlier}). Their reports: ${A.night}/${t.key}/*.report.md. ${t.chain ? 'Build on that work; do not undo it.' : 'They are independent of yours; leave them alone.'}`}

${decisionBlock(s)}

BINDING (the project's AGENTS.md binds you as well):
- No state-mutating git: no add, add -N, stash, commit, checkout, reset, restore, apply --index, config. Diff stat: \`git diff --stat\` plus \`git ls-files --others --exclude-standard | xargs -r wc -l\`. Leave everything uncommitted.
- YOUR FILES: ${t.files}. Touch nothing else; if another file must change, stop that part and say so prominently.
- Scratch ONLY in ${scratch}/ (mkdir -p it; private to you — other agents share the parent directory).
- The main tree ${A.mainTree} is READ-ONLY to you.
- Premises below are HYPOTHESES. A wrong one is a finding: report it prominently rather than working around it.
${lines([...(A.binding || []), ...(t.binding || [])])}
THE SLICE
${s.brief}

METHOD
1. Test-first: invoke the \`tdd\` skill and follow its red-green-refactor loop, testing through public interfaces. For every assertion you add or change, name the one-line mutation that should break it and confirm it does.
2. Focused tests while working; at the end the full suite from the worktree: \`${A.suite}\` (${A.suiteExpect}; report exact counts and explain any other skip).
${checks.length ? `3. Then:\n${lines(checks)}` : '3. (No extra checks for this track.)\n'}4. When the slice is green, run the pinned Codex review: \`${A.codex} ${t.worktree} ${scratch}/codex-<pass>.txt "<focus: what THIS slice changed and the concrete ways it could be wrong>"\` with a Bash timeout of 600000. Its findings are CLAIMS: reproduce each as a failing test before fixing; reject with evidence any that do not reproduce. Re-run the review after fixes. Stop at "Verdict: approve" or after ${maxPasses} passes (then status is partial unless every open finding was rejected with evidence).
5. Snapshot the CUMULATIVE worktree diff: \`{ git diff --full-index; git ls-files --others --exclude-standard | while read -r f; do git diff --no-index --full-index /dev/null "$f"; done; } > ${A.night}/${t.key}/${pad(i)}-${s.key}.cumulative.diff\`
6. Write your full report (the evidence behind every number) to ${A.night}/${t.key}/${pad(i)}-${s.key}.report.md, ENDING with the commit trailer this slice is committed under, on its own line:
   ${trailerFor(s)}
   ${s.decided ? 'exactly as written.' : 'with <why> replaced by one line saying why this change was needed.'} Return the same line as \`trailer\` in the structured summary. The project's commit-msg hook and CI refuse a commit without it (claude-harness docs/git-hygiene.md rule 14).`
}

function verifyPrompt(t, claim, j) {
  return `You are an ADVERSARIAL VERIFIER on ${A.project}. You WRITE NOTHING except in your own scratch directory ${A.night}/verify/${t.key}-${j + 1}/ (mkdir -p it). No git state changes of any kind, no edits in any worktree or in the main tree.

TARGET: the uncommitted work in ${t.worktree} (branch ${t.branch}, base ${A.base}). The implementers' reports are ${A.night}/${t.key}/*.report.md and their per-slice cumulative diffs sit beside them — treat every number and claim in them as a hypothesis. To compare with the base, export it read-only: \`git -C ${A.mainTree} archive ${A.base} | tar -x -C <your scratch>/base\`.

ONE CLAIM TO BREAK:
"${claim}"

Re-derive it yourself from the code${A.verifyFrom ? `, ${A.verifyFrom}` : ''} and your own measurement harness (write it in your scratch dir; import the worktree's modules read-only). Do not reuse the implementers' harnesses. Default to BROKEN if you cannot establish the claim; UNVERIFIABLE only if the tree makes it impossible to check. Return the verdict, the evidence (commands, numbers, file:line — enough for someone to re-run), and the smallest fix if it is broken.`
}

// Every distinct pointer, with the slices that name it.
const pointers = new Map()
for (const t of A.tracks) for (const s of t.slices) if (s.decided) pointers.set(s.decided, [...(pointers.get(s.decided) || []), `${t.key}:${s.key}`])
const checker = A.checker || `${A.mainTree}/.githooks/check-trailers`
const sq = (x) => `'${String(x).split("'").join("'\\''")}'`

function preflightPrompt() {
  const cmds = [...pointers.keys()].map((p) => {
    const path = p.slice(0, p.indexOf('#'))
    const anchor = p.slice(p.indexOf('#') + 1)
    return `POINTER ${p}\n  git -C ${sq(A.mainTree)} show ${sq(`${A.base}:${path}`)} | sh ${sq(checker)} --anchors | grep -Fx -- ${sq(anchor)}`
  })
  return `You are a PREFLIGHT CHECKER for a multi-agent run on ${A.project}. WRITE NOTHING: no files, no git state changes. Run each command below exactly as written, one at a time, from any directory, and report for each pointer whether it exited 0. Do not fix, search for, or reinterpret anything: a pointer whose command fails is UNRESOLVED, whatever the reason (missing file at ${A.base}, missing anchor, missing checker).

${cmds.join('\n\n')}

Return one result per POINTER, in order, with resolved=true only for exit status 0 and the command's output and exit status verbatim.`
}

let started = 0
const briefs = A.tracks.reduce((n, t) => n + t.slices.length + (t.verifiers || []).length, 0) + (pointers.size ? 1 : 0)
log(`briefs written: ${briefs} (${pointers.size ? `preflight: ${pointers.size} pointer(s); ` : ''}${A.tracks.map((t) => `${t.key}: ${t.slices.length} slices + ${(t.verifiers || []).length} verifiers`).join('; ')})`)

if (pointers.size) {
  phase('Preflight')
  started++
  const pre = await agent(preflightPrompt(), { label: 'preflight:decisions', phase: 'Preflight', schema: PREFLIGHT, effort: 'low' })
  if (!pre || !Array.isArray(pre.results)) {
    throw new Error('implement-slices refused to start: the preflight agent died, so no decided pointer is known to resolve; no implementer was spawned')
  }
  const missing = [...pointers.keys()].filter((p) => !pre.results.some((r) => r && r.pointer === p && r.resolved === true))
  if (missing.length) {
    throw new Error(`implement-slices refused to start; no implementer was spawned. These decided pointers do not resolve at ${A.base} (record the decision and commit it first, or fix the pointer):\n- ${missing.map((p) => `${p} (named by ${pointers.get(p).join(', ')})`).join('\n- ')}`)
  }
  log(`preflight: all ${pointers.size} decided pointer(s) resolve at ${A.base}`)
}

const results = await parallel(A.tracks.map((t) => async () => {
  const slices = []
  let notStarted = []
  for (let i = 0; i < t.slices.length; i++) {
    const s = t.slices[i]
    const expectedTrailer = trailerFor(s)
    started++
    const r = await agent(implPrompt(t, s, i), { label: `${t.key}:${s.key}`, phase: 'Build', schema: IMPL })
    slices.push({ slice: s.key, expectedTrailer, ...(r ?? { status: 'dead' }) })
    log(`${t.key}:${s.key} -> ${r ? r.status : 'DEAD'}; codex ${r?.codexPasses?.join('>') ?? '-'}`)
    if (r) {
      const t0 = String(r.trailer || '').trim()
      const ok = s.decided ? t0 === expectedTrailer : t0.startsWith(`${titled(s.class)}: `) && t0.length > titled(s.class).length + 2
      if (!ok) log(`${t.key}:${s.key}: returned trailer "${t0}" does not match the slice's (${expectedTrailer}); commit it under the slice's, not the agent's`)
    }
    if (t.chain && (!r || r.status !== 'done')) {
      notStarted = t.slices.slice(i + 1).map((x) => `${t.key}:${x.key}`)
      log(`${t.key}: chain stopped after ${s.key}; not started: ${notStarted.join(', ') || 'none'}`)
      break
    }
  }
  const verdicts = await parallel((t.verifiers || []).map((claim, j) => () => {
    started++
    return agent(verifyPrompt(t, claim, j), { label: `${t.key}:verify${j + 1}`, phase: 'Verify', schema: VERDICT })
  }))
  const dead = verdicts.filter((v) => !v).length
  if (dead) log(`${t.key}: ${dead} verifier(s) DEAD — this track is UNVERIFIED`)
  return {
    track: t.key, worktree: t.worktree, slices, verdicts, deadVerifiers: dead, notStarted,
    dead: [...slices.filter((x) => x.status === 'dead').map((x) => `${t.key}:${x.slice}`),
      ...verdicts.flatMap((v, j) => (v ? [] : [`${t.key}:verify${j + 1}`]))],
  }
}))

// A run is complete only if every brief started and every agent returned; a
// dead verifier leaves its track UNVERIFIED. The results are returned either
// way, so nothing finished is lost, but the top-level status says which it was.
const deadAgents = results.flatMap((r, i) => (r ? r.dead : [`${A.tracks[i].key}:(track failed)`]))
const notStarted = results.flatMap((r, i) => (r ? r.notStarted : A.tracks[i].slices.map((x) => `${A.tracks[i].key}:${x.key}`)))
const status = started === briefs && deadAgents.length === 0 && notStarted.length === 0 ? 'complete' : 'INCOMPLETE'
log(`started ${started} of ${briefs} briefs; ${status}${deadAgents.length ? `; dead: ${deadAgents.join(', ')}` : ''}${notStarted.length ? `; not started: ${notStarted.join(', ')}` : ''}`)
return { status, started, briefs, deadAgents, notStarted, results }
