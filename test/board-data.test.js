/** The project board's data (`docs/board/board.json`) must build: see tools/board/build.mjs. */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { BOARD_COLUMNS, buildBoardHtml, validateBoard } from "../tools/board/build.mjs";

const data = JSON.parse(fs.readFileSync(new URL("../docs/board/board.json", import.meta.url), "utf8"));
const template = fs.readFileSync(new URL("../tools/board/template.html", import.meta.url), "utf8");

test("every card sits in a known lane and column, once", () => {
  assert.doesNotThrow(() => validateBoard(data));
  assert.ok(data.cards.length > 0);
});

test("the page inlines the data and nothing can close its script early", () => {
  const html = buildBoardHtml(data, template);
  assert.ok(!html.includes("__BOARD_DATA__"));
  const inline = html.slice(html.indexOf('id="board-data">'), html.indexOf("</script>", html.indexOf('id="board-data">')));
  assert.ok(!inline.includes("<"), "a '<' in the data would let a card's text end the script");
});

test("a card in an unknown column is refused", () => {
  const bad = { ...data, cards: [{ ...data.cards[0], column: "doing" }] };
  assert.throws(() => validateBoard(bad), /unknown column/);
  assert.deepEqual([...BOARD_COLUMNS], ["needs-design", "ready", "in-progress", "gaps", "done"]);
});
