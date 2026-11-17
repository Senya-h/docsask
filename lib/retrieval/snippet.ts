/**
 * Turns a chunk's Markdown into a short preview made of text and code parts,
 * so the UI can show code in a monospace block instead of raw ``` fences.
 */

export type SnippetPart =
  | { kind: "text"; text: string }
  | { kind: "code"; text: string; filename?: string; truncated: boolean };

export interface SnippetOptions {
  /** Total characters across all parts. */
  maxChars?: number;
  /** Lines shown per code block. */
  maxCodeLines?: number;
}

const FENCE = /^(`{3,}|~{3,})(.*)$/;

export function snippetParts(content: string, { maxChars = 600, maxCodeLines = 8 }: SnippetOptions = {}): SnippetPart[] {
  // The chunk's own heading is already shown as the result title.
  const lines = content.replace(/^#{1,6} .*\n+/, "").split("\n");
  const parts: SnippetPart[] = [];
  let budget = maxChars;

  for (let i = 0; i < lines.length && budget > 0; i++) {
    const open = lines[i].trim().match(FENCE);
    if (open) {
      const code: string[] = [];
      let j = i + 1;
      while (j < lines.length && !lines[j].trim().startsWith(open[1])) code.push(lines[j++]);
      i = j;
      const shown = code.slice(0, maxCodeLines).join("\n").slice(0, budget);
      const filename = open[2].match(/filename="([^"]+)"/)?.[1];
      parts.push({ kind: "code", text: shown, filename, truncated: shown.length < code.join("\n").length });
      budget -= shown.length;
      continue;
    }
    const text: string[] = [];
    while (i < lines.length && !lines[i].trim().match(FENCE)) text.push(lines[i++]);
    i--;
    const joined = text.join("\n").trim();
    if (!joined) continue;
    const shown = joined.length > budget ? `${joined.slice(0, budget).trimEnd()}…` : joined;
    parts.push({ kind: "text", text: shown });
    budget -= shown.length;
  }
  return parts;
}
