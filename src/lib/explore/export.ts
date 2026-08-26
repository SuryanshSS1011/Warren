// Pure serializers turning a saved warren into portable formats (Phase 6a export). No I/O,
// no DOM — just data → string, so they're trivially testable. The route layer handles auth,
// entitlement, and the HTTP download. See PRODUCT_PLAN §2 (Pillar 5: "Export = BUILD NOW").

import { wikipediaArticleUrl } from "@/lib/attribution";
import type { WarrenSnapshot, SnapshotNode, SnapshotEdge } from "./warren-snapshot";

/** The minimum a warren needs to be exportable (SavedWarren satisfies this). */
export type ExportableWarren = Pick<
  WarrenSnapshot,
  "title" | "spine" | "nodes" | "edges" | "stats" | "startedAt"
>;

function nodesById(nodes: SnapshotNode[]): Map<string, SnapshotNode> {
  const m = new Map<string, SnapshotNode>();
  for (const n of nodes) m.set(n.id, n);
  return m;
}

/** The spine edge that leads INTO a node (its incoming bridge on the clicked path). */
function bridgeInto(edges: SnapshotEdge[], targetId: string): string {
  const e = edges.find((x) => x.spine && x.target === targetId);
  return e?.bridge ?? "";
}

/** Escape a value for a CSV cell (RFC-4180: quote and double inner quotes). */
export function csvCell(value: string): string {
  const needsQuote = /[",\n\r]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
}

/**
 * Markdown export — the journey as a readable, Obsidian-friendly document: a titled path with
 * each hop's AI bridge as connective prose and a source link, then the full node list grouped
 * by category. Wiki-links use [[Title]] so they resolve inside Obsidian/Roam.
 */
export function toMarkdown(w: ExportableWarren): string {
  const byId = nodesById(w.nodes);
  const lines: string[] = [];

  lines.push(`# ${w.title}`, "");
  lines.push(
    `> A Wikipedia journey mapped in [Warren](https://warren.app) — ` +
      `${w.stats.hops} hops · ${w.stats.categories} categories · ${w.stats.minutes} min.`,
    "",
  );

  lines.push("## The path", "");
  w.spine.forEach((id, i) => {
    const node = byId.get(id);
    if (!node) return;
    const bridge = i > 0 ? bridgeInto(w.edges, id) : "";
    if (bridge) lines.push(`*${bridge}*`, "");
    lines.push(
      `${i + 1}. [[${node.title}]] — ${node.category}  ` +
        `([Wikipedia](${wikipediaArticleUrl(node.title)}))`,
    );
  });
  lines.push("");

  // Branch nodes (explored but not on the clicked spine).
  const spineSet = new Set(w.spine);
  const branches = w.nodes.filter((n) => !spineSet.has(n.id));
  if (branches.length) {
    lines.push("## Also explored", "");
    for (const n of branches) {
      lines.push(`- [[${n.title}]] — ${n.category} ([Wikipedia](${wikipediaArticleUrl(n.title)}))`);
    }
    lines.push("");
  }

  lines.push("---", "");
  lines.push(
    "Article titles and links are from Wikipedia, under " +
      "[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). " +
      "Bridge sentences are AI-generated.",
  );
  return lines.join("\n");
}

/**
 * Anki-importable CSV: one card per article (front: "What is X?", back: category + source),
 * plus one card per bridge on the path (front: the two endpoints, back: the AI connection).
 * Columns: Front,Back,Tags. Deterministic order (spine first, then branches).
 */
export function toAnkiCsv(w: ExportableWarren): string {
  const byId = nodesById(w.nodes);
  const rows: string[] = ["Front,Back,Tags"];
  const tag = `warren::${w.title.replace(/\s+/g, "_")}`;

  const ordered = [
    ...w.spine.map((id) => byId.get(id)).filter(Boolean),
    ...w.nodes.filter((n) => !w.spine.includes(n.id)),
  ] as SnapshotNode[];

  for (const n of ordered) {
    const back = `${n.category}. See ${wikipediaArticleUrl(n.title)}`;
    rows.push([csvCell(`What is ${n.title}?`), csvCell(back), csvCell(tag)].join(","));
  }

  // Bridge cards: the conceptual link between consecutive spine articles.
  for (let i = 1; i < w.spine.length; i++) {
    const from = byId.get(w.spine[i - 1]);
    const to = byId.get(w.spine[i]);
    const bridge = bridgeInto(w.edges, w.spine[i]);
    if (from && to && bridge) {
      rows.push(
        [
          csvCell(`How does “${from.title}” connect to “${to.title}”?`),
          csvCell(bridge),
          csvCell(`${tag}::bridges`),
        ].join(","),
      );
    }
  }

  return rows.join("\n");
}

export type ExportFormat = "markdown" | "anki";

export const EXPORT_META: Record<
  ExportFormat,
  { ext: string; contentType: string; serialize: (w: ExportableWarren) => string }
> = {
  markdown: { ext: "md", contentType: "text/markdown; charset=utf-8", serialize: toMarkdown },
  anki: { ext: "csv", contentType: "text/csv; charset=utf-8", serialize: toAnkiCsv },
};

/** A filesystem-safe filename stem from a warren title. */
export function exportFilename(title: string, format: ExportFormat): string {
  const stem = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "warren";
  return `${stem}.${EXPORT_META[format].ext}`;
}
