import { describe, expect, it } from "vitest";
import { docsUrl, sectionOf } from "@/lib/ingest/source";

describe("docsUrl", () => {
  it.each([
    ["01-app/03-api-reference/01-directives/use-cache.md", "https://nextjs.org/docs/app/api-reference/directives/use-cache"],
    ["01-app/02-guides/caching.md", "https://nextjs.org/docs/app/guides/caching"],
    ["01-app/02-guides/migrating/index.md", "https://nextjs.org/docs/app/guides/migrating"],
    ["01-app/index.md", "https://nextjs.org/docs/app"],
    ["03-architecture/accessibility.md", "https://nextjs.org/docs/architecture/accessibility"],
  ])("%s → %s", (path, url) => {
    expect(docsUrl(path)).toBe(url);
  });
});

describe("sectionOf", () => {
  it.each([
    ["01-app/01-getting-started/01-installation.md", "Getting Started"],
    ["01-app/03-api-reference/04-functions/headers.md", "API Reference"],
    ["03-architecture/accessibility.md", "Architecture"],
  ])("%s → %s", (path, section) => {
    expect(sectionOf(path)).toBe(section);
  });
});
