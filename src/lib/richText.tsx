import type { ReactNode } from "react";

// Matches the lightweight markup analyze.ts embeds in verdict reasons:
// **bold** for emphasis, {{g:...}}/{{r:...}} for a good/bad-colored figure.
const TOKEN_RE = /\*\*(.+?)\*\*|\{\{(g|r):(.+?)\}\}/g;

export function parseRichText(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  TOKEN_RE.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = TOKEN_RE.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));

    if (match[1] !== undefined) {
      nodes.push(
        <strong key={key++} className="tabular font-semibold" style={{ color: "var(--text-primary)" }}>
          {match[1]}
        </strong>
      );
    } else if (match[2] && match[3] !== undefined) {
      const color = match[2] === "g" ? "var(--status-good)" : "var(--status-critical)";
      nodes.push(
        <strong key={key++} className="tabular font-semibold" style={{ color }}>
          {match[3]}
        </strong>
      );
    }

    lastIndex = TOKEN_RE.lastIndex;
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

export function stripRichText(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\{\{[gr]:(.+?)\}\}/g, "$1");
}
