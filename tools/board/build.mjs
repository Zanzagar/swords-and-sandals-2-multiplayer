/**
 * Builds the project board — a kanban of every system and where it stands —
 * from `docs/board/board.json` into ONE self-contained HTML page, published as
 * a private claude.ai Artifact ("Team Arena Board").
 *
 *   node tools/board/build.mjs <out.html>
 *
 * The JSON is the source of truth: move a card by editing its `column`, add a
 * line to `changes`, set `updatedAt` and `head`, rebuild, republish to the same
 * Artifact URL (HANDOFF.md's living head names it). Columns, left to right:
 * needs-design, ready, in-progress, gaps (built, gaps open), done.
 *
 * Seeded 2026-09-23 from three write-nothing inventory agents that checked
 * every doc claim against the code; a card's `evidence` says what was checked.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const BOARD_COLUMNS = Object.freeze(["needs-design", "ready", "in-progress", "gaps", "done"]);

/** Throws on the first card that could not be drawn where it claims to be. */
export function validateBoard(data) {
  const laneIds = new Set((data.lanes ?? []).map((lane) => lane.id));
  const ids = new Set();
  for (const card of data.cards ?? []) {
    if (!card.id || !card.title) throw new Error(`a card has no id or title: ${JSON.stringify(card).slice(0, 80)}`);
    if (!BOARD_COLUMNS.includes(card.column)) throw new Error(`card ${card.id}: unknown column ${card.column}`);
    if (!laneIds.has(card.lane)) throw new Error(`card ${card.id}: unknown lane ${card.lane}`);
    if (ids.has(card.id)) throw new Error(`duplicate card id ${card.id}`);
    ids.add(card.id);
  }
  return data;
}

/** The page: the template with the board's JSON inlined (`<` escaped so it cannot close its script). */
export function buildBoardHtml(data, template) {
  const json = JSON.stringify(validateBoard(data)).replace(/</g, "\\u003c");
  return template.replace("__BOARD_DATA__", () => json);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const out = process.argv[2];
  if (!out) { console.error("usage: node tools/board/build.mjs <out.html>"); process.exit(2); }
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const data = JSON.parse(fs.readFileSync(path.join(root, "docs/board/board.json"), "utf8"));
  const html = buildBoardHtml(data, fs.readFileSync(path.join(root, "tools/board/template.html"), "utf8"));
  fs.writeFileSync(out, html);
  const count = (column) => data.cards.filter((card) => card.column === column).length;
  console.log(`built ${out}: ${data.cards.length} cards (${BOARD_COLUMNS.map((c) => `${c} ${count(c)}`).join(", ")})`);
}
