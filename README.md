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

## Project layout

```
app/                 routes (landing, sign-in, (app)/dashboard, api/auth)
proxy.ts             optimistic auth gate for app routes
lib/env.ts           Zod-validated environment
lib/auth.ts          Better Auth server config
lib/db/schema.ts     all tables: auth, corpus, chat, evals
drizzle/             SQL migrations
tests/unit/          Vitest tests
```

## Decisions that differ from the original plan

- **npm instead of pnpm:** pnpm isn't installed on the dev machine, and Node 25+ no longer ships Corepack. Easy to switch later.
- **TypeScript 6.0 instead of 7:** `typescript-eslint` (used by `eslint-config-next`) doesn't support TypeScript 7 yet.
- **`/library` instead of `/docs`** for the ingested-docs page, to avoid confusion with the Next.js docs themselves.
