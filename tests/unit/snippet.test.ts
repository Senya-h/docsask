import { describe, expect, it } from "vitest";
import { snippetParts } from "@/lib/retrieval/snippet";

describe("snippetParts", () => {
  it("drops the leading heading and splits text from code", () => {
    const parts = snippetParts('## Usage\n\nEnable it:\n\n```ts filename="next.config.ts"\nconst a = 1\n```\n\nThen go.');
    expect(parts).toEqual([
      { kind: "text", text: "Enable it:" },
      { kind: "code", text: "const a = 1", filename: "next.config.ts", truncated: false },
      { kind: "text", text: "Then go." },
    ]);
  });

  it("shows at most maxCodeLines of a code block and marks it truncated", () => {
    const code = Array.from({ length: 20 }, (_, i) => `line ${i}`).join("\n");
    const [part] = snippetParts("```js\n" + code + "\n```", { maxCodeLines: 3 });
    expect(part).toMatchObject({ kind: "code", text: "line 0\nline 1\nline 2", truncated: true });
  });

  it("stops once the character budget is spent", () => {
    const parts = snippetParts(`${"a".repeat(50)}\n\n\`\`\`js\nmore()\n\`\`\``, { maxChars: 20 });
    expect(parts).toEqual([{ kind: "text", text: `${"a".repeat(20)}…` }]);
  });

  it("returns nothing for an empty chunk", () => {
    expect(snippetParts("")).toEqual([]);
  });
});
