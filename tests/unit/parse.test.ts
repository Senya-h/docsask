import { describe, expect, it } from "vitest";
import { keepCodeBlock, parseDoc, splitFrontmatter } from "@/lib/ingest/parse";

const doc = (body: string, front = "title: 'use cache: private'\ndescription: Caches things.") =>
  `---\n${front}\n---\n\n${body}`;

describe("splitFrontmatter", () => {
  it("reads quoted and unquoted scalars and ignores nested keys", () => {
    const { data, content } = splitFrontmatter(
      "---\ntitle: 'It''s here'\ndescription: \"Say \\\"hi\\\"\"\nrelated:\n  title: Related\n---\nBody",
    );
    expect(data).toEqual({ title: "It's here", description: 'Say "hi"' });
    expect(content).toBe("Body");
  });

  it("returns the whole file when there is no frontmatter", () => {
    expect(splitFrontmatter("# Hello").content).toBe("# Hello");
  });
});

describe("parseDoc", () => {
  it("extracts title and description", () => {
    const parsed = parseDoc(doc("Hello"));
    expect(parsed.title).toBe("use cache: private");
    expect(parsed.description).toBe("Caches things.");
  });

  it("keeps App Router content and drops Pages Router content", () => {
    const { body } = parseDoc(
      doc("<AppOnly>\n\nApp text.\n\n</AppOnly>\n\n<PagesOnly>\n\nPages text.\n\n```js\npages()\n```\n\n</PagesOnly>\n\nShared."),
    );
    expect(body).toContain("App text.");
    expect(body).toContain("Shared.");
    expect(body).not.toContain("Pages text");
    expect(body).not.toContain("pages()");
    expect(body).not.toMatch(/AppOnly|PagesOnly/);
  });

  it("drops inline PagesOnly spans but keeps the rest of the line", () => {
    const { body } = parseDoc(doc("Use this <PagesOnly>in pages</PagesOnly> everywhere."));
    expect(body).toBe("Use this  everywhere.");
  });

  it("removes MDX comments, including multi-line ones", () => {
    const { body } = parseDoc(doc("Before\n{/* a\nmulti-line comment */}\nAfter"));
    expect(body).not.toContain("comment");
    expect(body).toContain("Before");
    expect(body).toContain("After");
  });

  it("keeps the TypeScript variant of a switcher pair and the npm package tab", () => {
    const { body } = parseDoc(
      doc(
        [
          '```tsx filename="app/page.tsx" switcher',
          "const a: number = 1",
          "```",
          "",
          '```jsx filename="app/page.js" switcher',
          "const a = 1",
          "```",
          "",
          '```bash package="pnpm"',
          "pnpm add next",
          "```",
          "",
          '```bash package="npm"',
          "npm install next",
          "```",
        ].join("\n"),
      ),
    );
    expect(body).toContain('```tsx filename="app/page.tsx"\nconst a: number = 1');
    expect(body).not.toContain("const a = 1");
    expect(body).not.toContain("pnpm add");
    expect(body).toContain("npm install next");
    expect(body).not.toContain("switcher");
  });

  it("does not touch component tags inside code blocks", () => {
    const { body } = parseDoc(doc("```tsx\n<PagesOnly>\n<Suspense>\n```"));
    expect(body).toContain("<PagesOnly>\n<Suspense>");
  });

  it("replaces table icons and drops layout-only component lines", () => {
    const { body } = parseDoc(doc("| a | <Check size={18} /> |\n\n<FixCardGrid>\n\nText\n\n</FixCardGrid>"));
    expect(body).toContain("| a | ✓ |");
    expect(body).not.toContain("FixCardGrid");
    expect(body).toContain("Text");
  });

  it("normalises Windows line endings", () => {
    expect(parseDoc("---\r\ntitle: T\r\n---\r\nA\r\nB").body).toBe("A\nB");
  });
});

describe("keepCodeBlock", () => {
  it.each([
    ["tsx switcher", true],
    ['ts filename="x.ts" switcher', true],
    ["js switcher", false],
    ["jsx switcher", false],
    ["js", true],
    ['bash package="yarn"', false],
    ['bash package="npm"', true],
  ])("%s → %s", (info, expected) => {
    expect(keepCodeBlock(info)).toBe(expected);
  });
});
