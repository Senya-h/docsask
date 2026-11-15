/**
 * Turns a Next.js docs Markdown file into clean text for chunking.
 *
 * The docs are shared between the App Router and Pages Router and use a few
 * MDX components. We index the App Router docs, so <AppOnly> content is kept,
 * <PagesOnly> content is dropped, and duplicate JS/package-manager variants of
 * code blocks are removed (the TypeScript / npm variant stays).
 */

export interface ParsedDoc {
  title: string;
  description: string;
  body: string;
}

const FENCE = /^\s*(`{3,}|~{3,})(.*)$/;

export function parseDoc(raw: string): ParsedDoc {
  const { data, content } = splitFrontmatter(raw.replace(/\r\n?/g, "\n"));
  return {
    title: data.title ?? "",
    description: data.description ?? "",
    body: cleanBody(content),
  };
}

/** Reads the top-level `title` and `description` scalars; nested keys are ignored. */
export function splitFrontmatter(raw: string): {
  data: Record<string, string>;
  content: string;
} {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { data: {}, content: raw };
  const data: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (kv && kv[2] !== "") data[kv[1]] = unquote(kv[2].trim());
  }
  return { data, content: raw.slice(match[0].length) };
}

function unquote(value: string): string {
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'");
  }
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/\\"/g, '"');
  }
  return value;
}

/** Lines are either prose (cleaned) or fenced code (kept verbatim, maybe dropped). */
export function cleanBody(content: string): string {
  const out: string[] = [];
  const lines = dropPagesOnly(content.split("\n"));
  let prose: string[] = [];

  const flushProse = () => {
    if (prose.length) out.push(cleanProse(prose.join("\n")));
    prose = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const open = lines[i].match(FENCE);
    if (!open) {
      prose.push(lines[i]);
      continue;
    }
    flushProse();
    const marker = open[1];
    const info = open[2].trim();
    const block = [lines[i]];
    let j = i + 1;
    while (j < lines.length && !lines[j].trim().startsWith(marker)) block.push(lines[j++]);
    block.push(lines[j] ?? marker); // closing fence (added if the file forgot it)
    i = j;
    if (keepCodeBlock(info)) {
      block[0] = block[0].replace(info, simplifyInfo(info));
      out.push(block.join("\n"));
    }
  }
  flushProse();
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Removes <PagesOnly>…</PagesOnly> regions, which can span paragraphs and code
 * blocks. Tags inside code fences are code, not markup, and are left alone.
 */
export function dropPagesOnly(lines: string[]): string[] {
  const out: string[] = [];
  let fence: string | null = null;
  let skipping = false;
  for (const line of lines) {
    const f = line.match(FENCE);
    if (f && (fence === null || line.trim().startsWith(fence))) {
      fence = fence === null ? f[1] : null;
      if (!skipping) out.push(line);
      continue;
    }
    if (fence !== null) {
      if (!skipping) out.push(line);
      continue;
    }
    let rest = line.replace(/<PagesOnly>.*?<\/PagesOnly>/g, "");
    if (skipping) {
      const end = rest.indexOf("</PagesOnly>");
      if (end === -1) continue;
      skipping = false;
      rest = rest.slice(end + "</PagesOnly>".length);
    }
    const start = rest.indexOf("<PagesOnly>");
    if (start !== -1) {
      skipping = true;
      rest = rest.slice(0, start);
    }
    if (rest.trim() !== "" || line.trim() === "") out.push(rest);
  }
  return out;
}

/** Drop the JS twin of a TS "switcher" pair and non-npm package-manager tabs. */
export function keepCodeBlock(info: string): boolean {
  const lang = info.split(/\s+/)[0];
  if (/\bswitcher\b/.test(info) && (lang === "js" || lang === "jsx")) return false;
  const pkg = info.match(/package="([^"]+)"/);
  if (pkg && pkg[1] !== "npm") return false;
  return true;
}

/** Keep the language and filename; drop UI-only attributes. */
function simplifyInfo(info: string): string {
  const lang = info.split(/\s+/)[0] ?? "";
  const filename = info.match(/filename="([^"]+)"/);
  return filename ? `${lang} filename="${filename[1]}"` : lang;
}

function cleanProse(text: string): string {
  return (
    text
      // MDX comments, possibly multi-line
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      // Keep App Router-only content, drop the wrapper
      .replace(/<\/?AppOnly>/g, "")
      // Table icons
      .replace(/<Check\b[^>]*\/>/g, "✓")
      .replace(/<Cross\b[^>]*\/>/g, "✗")
      // Lines that are only a layout component tag, e.g. <FixCardGrid> or <Image ... />
      .replace(/^[ \t]*<\/?[A-Z][\w.]*(\s[^<>]*)?\/?>[ \t]*$/gm, "")
      // HTML wrappers used for collapsible sections; keep their text
      .replace(/<\/?(details|summary)>/g, "")
  );
}
