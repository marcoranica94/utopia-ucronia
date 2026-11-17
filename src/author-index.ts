import { createHash } from "node:crypto";
import { contentPath } from "./content-path.ts";

export interface AttributedItem {
  id: string;
  data: {
    title: string;
    level: "work" | "divergence" | "world";
    editorialId?: string;
    language: "it" | "fr" | "es" | "en" | "unknown";
    authors: string[];
    contributors?: string[];
    outline?: { id: string; kind: string; author?: string }[];
  };
}

// Only exact source spellings are grouped. Alias reconciliation is editorial work.
const nameKey = (name: string) => name.trim().normalize("NFC");
export function authorPath(name: string) {
  const key = nameKey(name);
  const slug =
    key
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "author";
  const hash = createHash("sha256").update(key).digest("hex").slice(0, 12);
  return `/authors/${slug}-${hash}/`;
}

export function buildAuthorIndex(items: AttributedItem[]) {
  const authors = new Map<
    string,
    {
      name: string;
      path: string;
      entries: {
        id: string;
        title: string;
        path: string;
        level: AttributedItem["data"]["level"];
        language: AttributedItem["data"]["language"];
        principal: boolean;
        anchors: string[];
      }[];
    }
  >();
  for (const item of items) {
    if (!item.data.editorialId) continue;
    const principal = new Set(item.data.authors.map(nameKey).filter(Boolean));
    const names = new Set(
      [
        ...principal,
        ...(item.data.contributors ?? []).map(nameKey),
        ...(item.data.outline ?? []).flatMap((entry) =>
          entry.kind === "contribution" && entry.author
            ? [nameKey(entry.author)]
            : [],
        ),
      ].filter(Boolean),
    );
    for (const name of names) {
      const author = authors.get(name) ?? {
        name,
        path: authorPath(name),
        entries: [],
      };
      author.entries.push({
        id: item.id,
        title: item.data.title,
        path: contentPath(item),
        level: item.data.level,
        language: item.data.language,
        principal: principal.has(name),
        anchors: [
          ...new Set(
            (item.data.outline ?? [])
              .filter(
                (entry) =>
                  entry.kind === "contribution" &&
                  entry.author &&
                  nameKey(entry.author) === name,
              )
              .map((entry) => entry.id),
          ),
        ],
      });
      authors.set(name, author);
    }
  }
  return [...authors.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "it"),
  );
}

export type PublishedAuthor = ReturnType<typeof buildAuthorIndex>[number];
