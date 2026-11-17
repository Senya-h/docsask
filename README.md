# DocsAsk

Ask questions about the Next.js documentation and get streamed answers that cite the exact passage they came from. Includes an evaluation dashboard that measures retrieval and answer quality.

**Live demo:** https://docsask-black.vercel.app (sign in with GitHub)

> **Status:** Phase 1 (foundation) done. See `PLAN.md` for the full roadmap.

## Stack

Next.js 16.4 (App Router, Cache Components, `proxy.ts`) · React 19 · TypeScript 6 · Tailwind CSS 4 · shadcn/ui (Base UI) · Better Auth (GitHub) · Neon Postgres + pgvector · Drizzle ORM · Vitest · GitHub Actions

Coming next: Claude API (`@anthropic-ai/sdk`), Voyage embeddings and reranking, Vercel Workflows.

## Local setup

Requirements: Node.js 24+, a [Neon](https://neon.tech) database, a GitHub OAuth app.

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy the env template and fill it in:
   ```bash
   cp .env.example .env.local
   ```
   - `DATABASE_URL`: Neon connection string
   - `BETTER_AUTH_SECRET`: generate one with `npx @better-auth/cli secret`
   - `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`: from a GitHub OAuth app with callback URL `http://localhost:3000/api/auth/callback/github`
3. Create the database tables (the first migration enables pgvector):
   ```bash
   npm run db:migrate
   ```
4. Start the dev server:
   ```bash
   npm run dev
   ```

## Ingestion

The corpus is the Next.js documentation that ships inside the installed `next` package (`node_modules/next/dist/docs`), so it always matches the version the app runs on. App Router docs plus the Architecture and Community sections are indexed; the legacy Pages Router docs are not.

```bash
npm run ingest -- --dry-run    # stats and cost estimate, no API calls
npm run ingest -- --limit=5    # small end-to-end test
npm run ingest                 # everything; unchanged documents are skipped
```

Pipeline per document (`lib/ingest/`):

1. **Parse** (`parse.ts`): read frontmatter, keep App Router content, drop Pages Router-only sections, MDX comments and layout components. Of each TypeScript/JavaScript code-block pair, only the TypeScript one is kept; of the package-manager variants, only npm.
2. **Chunk** (`chunk.ts`): split at headings, pack paragraphs up to ~500 tokens, never split a code block, split large tables by rows with the header repeated. Each chunk records its heading path, e.g. `use cache › Cache lifetimes`.
3. **Contextualize** (`contextualize.ts`): [Contextual Retrieval](https://www.anthropic.com/news/contextual-retrieval). Claude Haiku 5.5 writes 1–2 sentences placing each chunk in its document. The full document sits in a cached prompt prefix, and the first chunk runs alone so the rest read that cache.
4. **Embed** (`embed.ts`): Voyage `voyage-4`, 1024 dimensions, batched within API limits, retries with backoff on 429/5xx.
5. **Store**: one transaction per document. Keyed on version + path; skipped when the checksum is unchanged.

Current corpus (v16.4.6): 307 documents, ~2,500 chunks, ~715K tokens. Contextualization costs about $0.40 per full run.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Dev server on http://localhost:3000 |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generate route types, then `tsc --noEmit` |
| `npm test` | Unit tests (Vitest) |
| `npm run db:generate` | Generate a migration from `lib/db/schema.ts` |
| `npm run db:migrate` | Apply migrations |
| `npm run db:studio` | Browse the database |
| `npm run ingest` | Index the Next.js docs (see Ingestion) |

## Project layout

```
app/                 routes (landing, sign-in, (app)/dashboard, api/auth)
proxy.ts             optimistic auth gate for app routes
lib/env.ts           Zod-validated environment
lib/auth.ts          Better Auth server config
lib/db/schema.ts     all tables: auth, corpus, chat, evals
lib/ingest/          parse, chunk, contextualize, embed
scripts/ingest.ts    ingestion CLI
drizzle/             SQL migrations
tests/unit/          Vitest tests
```

## Credits

The indexed documentation is from [Next.js](https://github.com/vercel/next.js), © Vercel, Inc., MIT License. Answers link back to the original pages on nextjs.org.

## Decisions that differ from the original plan

- **npm instead of pnpm:** pnpm isn't installed on the dev machine, and Node 25+ no longer ships Corepack. Easy to switch later.
- **TypeScript 6.0 instead of 7:** `typescript-eslint` (used by `eslint-config-next`) doesn't support TypeScript 7 yet.
- **`/library` instead of `/docs`** for the ingested-docs page, to avoid confusion with the Next.js docs themselves.
- **Docs from the installed package instead of a GitHub download:** Next.js bundles its docs in `node_modules/next/dist/docs`, so the corpus is version-locked to the app with no network fetch.
- **No chunk overlap:** each chunk carries its heading path and a generated context sentence, which covers what overlap would add, without duplicate text in the index.
- **Ingestion runs as a script for now:** the planned Vercel Workflow and `/library` page come in a follow-up. The pipeline modules are written so a workflow can call them step by step.
