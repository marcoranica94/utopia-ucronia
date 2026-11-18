import assert from "node:assert/strict";
import test from "node:test";
import { load } from "cheerio";
import { markSourceRed } from "../scripts/source-color.ts";

const body = (html: string) =>
  load(markSourceRed(`<html><body>${html}</body></html>`));

test("a paragraph entirely in red becomes one panel span", () => {
  const $ = body(
    '<p><font color="#FF0000">Ecco una domanda postaci da <b>Hurmar</b>:</font></p><p>Il testo.</p>',
  );
  const whole = $("p").first().children("span.src-red-whole");
  assert.equal(whole.length, 1);
  assert.equal(whole.text(), "Ecco una domanda postaci da Hurmar:");
  assert.equal($("p").last().find(".src-red").length, 0);
});

test("red words inside black text stay inline, and the text is unchanged", () => {
  const source =
    '<p>Nel <font color="red">1804</font> a Parigi &amp; altrove.</p>';
  const $ = body(source);
  assert.equal($(".src-red-whole").length, 0);
  assert.equal($("span.src-red").text(), "1804");
  assert.equal($("p").text(), load(source)("p").text());
});

test("the nearest colour wins and other colours are ignored", () => {
  const $ = body(
    '<font color="#FF0000"><p>Rosso <font color="#000000">nero</font></p></font><p><font color="#0000FF">blu</font></p>',
  );
  assert.deepEqual(
    $("span.src-red")
      .map((_i, e) => $(e).text())
      .get(),
    ["Rosso"],
  );
  assert.equal($(".src-red-whole").length, 0);
});

test("inline style colour counts too; pages without colour are untouched", () => {
  const $ = body('<p style="color: rgb(255, 0, 0)">POD:</p>');
  assert.equal($(".src-red-whole").text(), "POD:");
  const plain = "<html><body><p>Niente</p></body></html>";
  assert.equal(markSourceRed(plain), plain);
});
