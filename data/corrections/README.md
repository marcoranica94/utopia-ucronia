# Persistent conversion corrections

Create `<content-slug>.json` with an array of `{ "from": "exact generated text", "to": "replacement", "reason": "why" }` objects. The converter applies them after structural conversion, on every build. Originals and the map's block digests remain unchanged. No source correction was necessary for the S2 sample: the losses found there were converter bugs and were fixed in code.

Use small, unambiguous replacements. An empty or absent `from` blocks conversion, so a changed source cannot silently discard a correction. The fidelity audit applies the same declared replacements to the source text; corrections to markup alone must also preserve source text, anchors, tables and illustrations. Textual source changes should be exceptional and documented with their reason.
