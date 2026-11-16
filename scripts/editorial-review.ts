import type { EditorialMap } from "../src/editorial/model.ts";

/** Regeneration may propose new metadata, but cannot replace an owner's decision. */
export function preserveOwnerDecisions(
  next: EditorialMap,
  previous: EditorialMap,
): void {
  const owned = (review: { by: string }) => review.by === "owner";
  const assertSources = (ids: string[]) => {
    for (const id of ids) {
      const old = previous.documents.find((d) => d.id === id);
      const current = next.documents.find((d) => d.id === id);
      if (!old || !current || old.sha256 !== current.sha256)
        throw new Error(`Owner-reviewed source changed or missing: ${id}`);
    }
  };
  const preserveRegistry = <T extends { id: string; review: { by: string } }>(
    nextValues: T[],
    oldValues: T[],
  ) => {
    for (const old of oldValues) {
      if (!owned(old.review)) continue;
      const index = nextValues.findIndex((value) => value.id === old.id);
      if (index < 0) nextValues.push(structuredClone(old));
      else nextValues[index] = structuredClone(old);
    }
  };
  for (const author of previous.authors.filter((a) => owned(a.review)))
    assertSources(author.documents);
  preserveRegistry(next.authors, previous.authors);
  preserveRegistry(next.eras, previous.eras);
  preserveRegistry(next.places, previous.places);
  preserveRegistry(next.themes, previous.themes);
  for (const old of previous.items) {
    const current = next.items.find((i) => i.id === old.id);
    if (owned(old.review)) {
      assertSources(old.sources.map((s) => s.documentId));
      if (current) Object.assign(current, structuredClone(old));
      else next.items.push(structuredClone(old));
      for (const authorId of old.authors)
        if (!next.authors.some((a) => a.id === authorId)) {
          const author = previous.authors.find((a) => a.id === authorId);
          if (author) next.authors.push(structuredClone(author));
        }
    } else if (current) {
      if (
        old.contributions.some(
          (c) =>
            owned(c.kind.review) || (c.replyReview && owned(c.replyReview)),
        )
      ) {
        assertSources(old.sources.map((s) => s.documentId));
        current.contributions = structuredClone(old.contributions);
        for (const contribution of old.contributions) {
          if (
            !contribution.authorId ||
            next.authors.some((a) => a.id === contribution.authorId)
          )
            continue;
          const author = previous.authors.find(
            (a) => a.id === contribution.authorId,
          );
          if (author) next.authors.push(structuredClone(author));
        }
      }
      if (owned(old.language.review)) {
        assertSources(old.sources.map((s) => s.documentId));
        current.language = structuredClone(old.language);
      }
      for (const key of Object.keys(
        old.classification,
      ) as (keyof typeof old.classification)[]) {
        if (!owned(old.classification[key].review)) continue;
        assertSources(old.sources.map((s) => s.documentId));
        Object.assign(
          current.classification[key],
          structuredClone(old.classification[key]),
        );
      }
    }
  }
  for (const old of previous.proposals)
    if (owned(old.review)) {
      assertSources(old.documents);
      const current = next.proposals.find((p) => p.id === old.id);
      if (current) Object.assign(current, structuredClone(old));
      else next.proposals.push(structuredClone(old));
      for (const target of old.targets)
        if (!next.items.some((i) => i.id === target)) {
          const item = previous.items.find((i) => i.id === target);
          if (item) next.items.push(structuredClone(item));
        }
    }
}
