# DocsAsk: Implementation Plan

A Next.js web app that answers questions about the **Next.js documentation** with streamed, cited answers, plus an evaluation dashboard that measures how well it works.

*Plan version: 2026-11-15. Versions to be pinned with `npm show <pkg> version` at scaffold time.*

---

## 1. Goals

**Product:** Ask a question about Next.js and get a correct, streamed answer with clickable citations to the exact doc passage. If the docs don't cover it, say so instead of guessing.

**Portfolio:** Demonstrate, with numbers:
- Full-stack Next.js 16 engineering (server components, route handlers, auth, DB, background jobs, deploy)
- Modern retrieval (hybrid search, Contextual Retrieval, reranking)
- Rigorous evaluation (retrieval and answer metrics, hold-out set, calibrated LLM judge, cost and latency)
- Production hygiene (guardrails, rate limits, tests, CI)

**Why the Next.js docs work well as the corpus:**
- Public, well-structured MDX with clear headings, so chunking is clean
- You already know the material, so eval questions are easy to write and grade
- **Next.js 16.3 shipped in August 2026, after the model's training cutoff (June 2026).** Questions about 16.3 features (`catchError`, root params, Partial Prefetching, `instant()` test helper) can't be answered from memory. That lets the eval show retrieval adds real value, not just what the model already knows.
- Versioned by git tag, which enables a "filter by version" feature

---

## 2. Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16.3+** (App Router), React 19, **TypeScript 7** | `proxy.ts` (not `middleware.ts`), `cacheComponents: true` |
| UI | Tailwind CSS, shadcn/ui | |
| Auth | **Better Auth** (GitHub OAuth) | Auth.js is in maintenance mode |
| Database | **Neon Postgres + pgvector** | Postgres full-text search for keyword retrieval |
| ORM | **Drizzle 0.45.x (stable)** | Move to 1.0 once it leaves RC |
| LLM | **`@anthropic-ai/sdk`**, model **`claude-opus-5-5`** | Adaptive thinking, `effort` set per route, streaming |
| Cheap model | **`claude-haiku-5-5`** | LLM judge, chunk-context generation, query classifier |
| Embeddings | **Voyage `voyage-4`** (or `voyage-4-lite`) | |
| Reranker | **Voyage `rerank-3`** | `rerank-2.5` is legacy |
| Background jobs | **Vercel Workflows** (`"use workflow"` / `"use step"`) | Ingestion and eval runs |
| Rate limiting | Upstash Redis (`@upstash/ratelimit`) | |
| Validation | Zod | Env, API inputs, tool inputs |
| Charts | Recharts | Eval dashboard |
| Testing | Vitest, Playwright, `@next/playwright` (`instant()`) | |
| CI | GitHub Actions | lint, typecheck, unit tests, e2e on preview |
| Hosting | Vercel | |
| Package manager | pnpm | |

**Accounts you'll need** (you create these and put keys in `.env.local` yourself): Anthropic API, Voyage AI, Neon, Vercel, Upstash, GitHub OAuth app.

---

## 3. Architecture

```
                         ┌──────────────────────────────────────────┐
Browser (React)          │ Next.js 16 on Vercel                     │
  chat UI ──stream──────►│ /api/chat                                │
  sources panel          │   1. guardrails (rate limit, size, auth) │
  /evals dashboard       │   2. router (Haiku): simple | multi-hop  │
                         │   3a. simple → retrieval pipeline        │
                         │   3b. multi-hop → agent (Tool Runner)    │
                         │   4. Opus 5.5 answer, native citations   │
                         └───────┬───────────────────────┬──────────┘
                                 │                       │
            retrieval pipeline   ▼                       ▼
  query rewrite (Haiku) → [vector top-30 ∥ BM25 top-30] → RRF → rerank-3 → top-6
                                 │
                                 ▼
                    Postgres: chunks (embedding, tsv, context)

Ingestion (Vercel Workflow): fetch MDX @ tag → parse → chunk → contextualize (Haiku,
                             cached doc) → embed (voyage-4) → upsert
Evals (Vercel Workflow):     dataset × config → run pipeline → judge (Haiku) → store → /evals
```

---

## 4. Data model (Drizzle)

```
documents      id, version (e.g. "v16.3.0"), path, title, url, section, checksum, status, createdAt
chunks         id, documentId, ordinal, headingPath, content, context (generated),
               tokenCount, embedding vector(N), tsv tsvector
               indexes: HNSW (embedding, cosine), GIN (tsv), btree (documentId)
conversations  id, userId, title, createdAt
messages       id, conversationId, role, content, citations jsonb, route ("rag"|"agent"),
               model, inputTokens, outputTokens, cacheReadTokens, costUsd, ttftMs, totalMs
eval_questions id, question, expectedAnswer, goldChunkIds[], category, split ("dev"|"holdout")
eval_runs      id, configName, params jsonb, gitSha, status, createdAt
eval_results   id, runId, questionId, retrievedIds[], answer, recallAt5, mrr,
               correctness, groundedness, refusalCorrect, costUsd, ttftMs, totalMs
judge_calibration  questionId, humanScore, judgeScore
```

`tsv` is built from `context || ' ' || headingPath || ' ' || content` so keyword search also benefits from the generated context.

---

## 5. Folder structure

```
app/
  (marketing)/page.tsx                 landing + live demo link
  (app)/chat/[id]/page.tsx
  (app)/docs/page.tsx                  ingested versions, chunk counts, status
  (app)/evals/page.tsx                 run list + config comparison
  (app)/evals/[runId]/page.tsx         per-question drilldown
  api/chat/route.ts
  api/auth/[...all]/route.ts           Better Auth
  api/ingest/route.ts                  starts ingestion workflow
  api/evals/run/route.ts               starts eval workflow
proxy.ts                               auth gate + demo-mode rules
lib/
  env.ts                               Zod-validated env
  db/{schema.ts,client.ts}  drizzle/   migrations
  auth.ts
  llm/{client.ts,prompts.ts,tools.ts,router.ts,cost.ts,guardrails.ts}
  ingest/{fetch-docs.ts,parse-mdx.ts,chunk.ts,contextualize.ts,embed.ts}
  retrieval/{rewrite.ts,vector.ts,keyword.ts,rrf.ts,rerank.ts,pipeline.ts}
  evals/{dataset.json,configs.ts,judge.ts,metrics.ts}
workflows/{ingest.ts,run-eval.ts}
components/{chat/,sources/,evals/,ui/}
tests/{unit/,e2e/}
AGENTS.md                              maintained by `next dev` (version-matched docs)
```

---

## 6. Phases

Phases 1–4 are the **MVP**: it's already CV-worthy once they're done. Phases 5–7 add depth.

### Phase 1: Foundation (days 1–2)
- `create-next-app` (TypeScript, Tailwind, App Router), pnpm, TypeScript 7, ESLint, Prettier
- shadcn/ui init; base layout, theme, landing page
- `lib/env.ts` with Zod; `.env.example`
- Neon + pgvector extension; Drizzle schema + first migration
- Better Auth with GitHub; `proxy.ts` protects `(app)` routes
- `next.config.ts`: `cacheComponents: true`
- GitHub Actions: lint, typecheck, test
- Deploy to Vercel

**Done when:** a logged-in user sees an empty dashboard on the production URL, and CI is green.

### Phase 2: Ingestion (days 3–4)
- `fetch-docs.ts`: download the `docs/` folder from the `vercel/next.js` repo at a pinned tag (start with the latest 16.x). Check the repo license and credit it in the README.
- `parse-mdx.ts`: strip JSX components, keep headings, code blocks and frontmatter (title, description); map file path → nextjs.org URL
- `chunk.ts`: heading-aware split, ~400–600 tokens, keep code blocks intact, store `headingPath` ("Caching › use cache › Cache lifetimes")
- `contextualize.ts` (**Contextual Retrieval**): for each chunk, Haiku 5.5 writes 1–2 sentences placing the chunk in its document. Put the full document in the cached prefix so each chunk costs only a cache read.
- `embed.ts`: batch embed `context + content` with voyage-4; retries with backoff
- `workflows/ingest.ts`: Vercel Workflow with one step per stage, so a failure resumes instead of restarting; idempotent upserts keyed on checksum
- `/docs` page: versions, document and chunk counts, status, re-ingest button (admin only)
- **Tests:** chunker (heading boundaries, code blocks never split, overlap, empty files), MDX parser fixtures

**Done when:** the full docs for one version are ingested with context and embeddings, and you can see the counts on `/docs`.

### Phase 3: Retrieval and chat (days 5–7)
- `rewrite.ts`: Haiku turns chat history + follow-up into a standalone search query (structured output)
- `vector.ts` (cosine top-30) and `keyword.ts` (`ts_rank_cd` top-30), run in parallel
- `rrf.ts`: Reciprocal Rank Fusion (k = 60)
- `rerank.ts`: rerank-3 → top-6; drop chunks below a score threshold
- `pipeline.ts`: composable so each eval config can switch stages on or off
- `/api/chat`:
  - Opus 5.5, `thinking: {type: "adaptive"}`, `output_config.effort` set explicitly (start at `low` for chat; tune with evals)
  - Retrieved chunks passed as **document blocks with `citations: {enabled: true}`**, titled with heading path and URL
  - System prompt: answer only from the documents; if they don't cover it, say so
  - If no chunk passes the rerank threshold, skip generation and return the "not in the docs" response
  - Streaming to the client; server-side refusal fallback (`fallbacks: "default"`), check `stop_reason`
  - **Prompt caching** on the system prompt and tool definitions; log `cache_read_input_tokens`
  - Persist message with tokens, cost, time to first token (TTFT) and total time
- UI: streaming chat, citation chips under each sentence, side panel showing the cited passage highlighted with a link to nextjs.org, copy and regenerate buttons, version selector
- **Tests:** RRF unit tests, pipeline tests with a fixed small fixture corpus

**Done when:** answers stream with working citations, and an off-topic question gets a clean refusal.

### Phase 4: Evaluation (days 8–10). The centerpiece.
**Dataset:** 60 hand-written questions, each with an expected answer and gold chunk(s):

| Category | Count | Example |
|---|---|---|
| Factual, single passage | 15 | "What's the default `maxDuration`...?" |
| Multi-passage | 10 | "How do `use cache` and Suspense interact for a dynamic page?" |
| **Post-cutoff (16.3 features)** | 10 | "How do I retry a failed Server Component with `catchError`?" |
| Follow-ups (need history) | 8 | "And how do I test that it stays instant?" |
| Out of scope (should refuse) | 7 | "How do I configure Nuxt middleware?" |
| Version-sensitive | 5 | "Is `middleware.ts` still the right file in v16?" |
| Prompt-injection probes | 5 | Question that targets a planted malicious doc |

Split **45 dev / 15 hold-out**. Tune only on dev; the hold-out score is the headline number.

**Metrics:**
- Retrieval: recall@5, MRR, nDCG@5
- Answer: correctness (judge vs expected answer), groundedness (every claim supported by a cited chunk)
- Refusal accuracy on out-of-scope questions; injection resistance
- Operational: p50/p95 TTFT, cost per query, cache hit rate

**Judge:** Haiku 5.5 with structured output and a written rubric. Grade 20 answers yourself and report the judge's agreement rate. If agreement is below about 80%, improve the rubric before trusting it.

**Configs to compare:**

| Config | What it tests |
|---|---|
| `closed-book` | No retrieval. Shows what the model already knows and where it fails (especially post-cutoff questions) |
| `full-context` | The whole doc version in the prompt with caching. Measure its size with token counting in Phase 2; if it exceeds the 1M window, use the whole relevant section (e.g. App Router docs only). Shows when RAG is worth it compared with long context |
| `vector-only` | Basic RAG baseline |
| `hybrid` | + BM25 and RRF |
| `hybrid+rerank` | + rerank-3 |
| `hybrid+rerank+contextual` | + Contextual Retrieval |
| `…+rewrite` | + query rewriting (matters for follow-ups) |

**Runner:** `workflows/run-eval.ts` runs dataset × config, records the git SHA, stores results.

**`/evals` dashboard:**
- Run history; grouped bar chart comparing configs per metric
- Accuracy vs cost-per-query scatter plot (the long-context-or-RAG chart)
- Per-category breakdown (post-cutoff vs pre-cutoff is the key comparison)
- Drilldown: question, gold vs retrieved chunks, answer, judge reasoning

**Done when:** you have a results table on the hold-out set showing which config wins, by how much, and at what cost.

### Phase 5: Adaptive routing and agent mode (days 11–12)
- `router.ts`: Haiku classifies each question as `simple` or `multi-hop` (structured output). Add it to the eval and measure its accuracy.
- Agent path with the SDK **Tool Runner** and `betaZodTool`:
  - `searchDocs(query, version?, section?)`
  - `getPage(path)`: full page by path
  - `listSections(version)`
  - `compareVersions(topic, versionA, versionB)` (needs two ingested versions)
- Tool choice stays `auto` (forced tool choice isn't supported on Opus 5.5); `strict: true` on tool schemas; validate inputs; return errors to the model as `is_error` results
- Cap the number of steps; show each tool call in the UI as a collapsible step
- Add a `routed` config to the eval: quality vs always-RAG and always-agent, plus cost

**Done when:** "What changed about caching between 15 and 16?" works through the agent and shows its steps, and the eval shows whether routing pays off.

### Phase 6: Guardrails and hardening (day 13)
- Retrieved text is untrusted data: delimited document blocks, never merged into the system prompt. Operator instructions mid-conversation go in `role: "system"` messages.
- Plant one malicious chunk in a test fixture and verify the injection probes in the eval set
- Upstash rate limit per user and per IP; input length caps; per-user daily token budget
- Data isolation tests (users only see their own conversations)
- Error boundaries with `catchError`, loading states with Suspense, empty states
- Accessibility: keyboard navigation, `aria-live` region for streamed text, contrast check

### Phase 7: Polish and publish (days 14–15)
- Playwright e2e: sign in → ask → citation opens the source panel; `instant()` test for chat navigation
- **Public demo mode:** no sign-in, rate-limited, read-only, preloaded example questions
- README:
  - Problem and live demo link; 60-second demo video/GIF
  - Architecture diagram
  - Results table (hold-out set) and the accuracy-vs-cost chart
  - "What didn't work" section (failed configs, judge disagreement, hard question types)
  - Cost per query and how caching affected it
  - Setup instructions
- Lighthouse pass, OG image, optional custom domain

---

## 7. Acceptance criteria

Targets to aim for. **Report the actual numbers honestly, whatever they turn out to be.**

- Hold-out recall@5 ≥ 85%, correctness ≥ 80%, groundedness ≥ 90%
- Clear improvement of the best config over `closed-book` on post-cutoff questions
- ≥ 90% correct refusals on out-of-scope questions; no successful injections
- p95 TTFT < 2.5 s on the RAG path
- Judge agreement with your grading ≥ 80%
- CI green; live demo works without sign-in

---

## 8. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Scope creep | Ship Phases 1–4 first; Phases 5–7 are additions |
| API costs | Haiku for judge/context/routing; prompt caching; cache eval results by (question, config, git SHA); daily budget caps |
| Overfitting to the eval | Dev/hold-out split; write questions before tuning |
| Biased judge | Calibrate against your own grades; publish agreement |
| Docs license or format changes | Pin a git tag; verify license; credit the source |
| Vercel function timeouts | Ingestion and evals run in Workflows; chat streams |
| Demo abuse | Rate limits, token caps, read-only demo mode |
| Library churn (Drizzle 1.0, Next.js minors) | Pin versions; upgrade in separate PRs |

---

## 9. Ways of working

- Git from day one; one branch and PR per phase; conventional commit messages
- Keep this plan updated as decisions change; record notable decisions in `docs/decisions.md`
- Run the eval before and after every retrieval or prompt change, and note the result in the PR description

---

## 10. CV bullet (fill in real numbers at the end)

> Built and deployed **DocsAsk**, a Next.js 16 / TypeScript RAG assistant over the Next.js docs with streamed, cited answers (Claude API, Postgres + pgvector, Voyage embeddings and reranking). Designed a 60-question eval with a hold-out split and calibrated LLM judge; hybrid search with Contextual Retrieval and reranking raised hold-out accuracy from **X%** (closed-book) to **Y%**, at **$Z** per query and **N s** p95 time to first token.
