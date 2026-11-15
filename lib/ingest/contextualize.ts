import Anthropic from "@anthropic-ai/sdk";
import pLimit from "p-limit";
import type { Chunk } from "./chunk";

/**
 * Contextual Retrieval (Anthropic, 2024): before embedding, ask a small model
 * to write 1–2 sentences that situate each chunk within its document, e.g.
 * "This section of the `use cache` reference explains cache lifetimes…".
 * The context is prepended for embedding and keyword search, which fixes
 * chunks that are ambiguous on their own ("This option…", "In this example…").
 *
 * Cost control: the full document goes in a cached prefix. The first request
 * per document writes the cache; the rest read it at a fraction of the price.
 */

export const CONTEXT_MODEL = "claude-haiku-5-5";

const SYSTEM = `You write short retrieval context for chunks of the Next.js documentation.
Given a full document and one chunk from it, write 1-2 sentences that situate the chunk within the document so a search engine can match it to user questions.
Name the specific API, file convention, or concept the chunk covers, and what it explains or shows.
Do not repeat the chunk, do not start with "This chunk", and reply with the context only.`;

export interface ContextUsage {
  inputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  outputTokens: number;
  requests: number;
}

export function emptyUsage(): ContextUsage {
  return { inputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0, outputTokens: 0, requests: 0 };
}

/**
 * Claude Haiku 5.5 prices (USD per million tokens) for prompts ≤100K tokens.
 * Cache write = 1.25× input, cache read ≈ 0.1× input. Used for reporting only;
 * the Anthropic console is the source of truth for billing.
 */
const PRICE = { input: 0.1, cacheWrite: 0.125, cacheRead: 0.01, output: 0.5 };

export function contextCostUsd(u: ContextUsage): number {
  return (
    (u.inputTokens * PRICE.input +
      u.cacheWriteTokens * PRICE.cacheWrite +
      u.cacheReadTokens * PRICE.cacheRead +
      u.outputTokens * PRICE.output) /
    1_000_000
  );
}

export function documentPrompt(title: string, body: string): string {
  return `<document title="${title.replace(/"/g, "'")}">\n${body}\n</document>`;
}

export async function contextualizeDocument(
  client: Anthropic,
  doc: { title: string; body: string },
  chunks: Chunk[],
  usage: ContextUsage,
  { concurrency = 4 }: { concurrency?: number } = {},
): Promise<string[]> {
  const prefix = documentPrompt(doc.title, doc.body);
  const one = (chunk: Chunk) => contextualizeChunk(client, prefix, chunk, usage);
  if (chunks.length === 0) return [];

  // A cache entry is readable only once the first response starts, so run the
  // first chunk alone and fan out the rest after it.
  const first = await one(chunks[0]);
  const limit = pLimit(concurrency);
  const rest = await Promise.all(chunks.slice(1).map((c) => limit(() => one(c))));
  return [first, ...rest];
}

async function contextualizeChunk(
  client: Anthropic,
  documentPrefix: string,
  chunk: Chunk,
  usage: ContextUsage,
): Promise<string> {
  const response = await client.messages.create({
    model: CONTEXT_MODEL,
    max_tokens: 200,
    // A one-sentence summary needs no reasoning; disabled is allowed on Haiku 5.5 at effort ≤ high.
    thinking: { type: "disabled" },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          // Shared across every chunk of this document: the cache breakpoint goes here.
          { type: "text", text: documentPrefix, cache_control: { type: "ephemeral" } },
          {
            type: "text",
            text: `<chunk heading="${chunk.headingPath.replace(/"/g, "'")}">\n${chunk.content}\n</chunk>`,
          },
        ],
      },
    ],
  });

  usage.requests += 1;
  usage.inputTokens += response.usage.input_tokens;
  usage.cacheWriteTokens += response.usage.cache_creation_input_tokens ?? 0;
  usage.cacheReadTokens += response.usage.cache_read_input_tokens ?? 0;
  usage.outputTokens += response.usage.output_tokens;

  // A refusal or empty reply is not fatal: the chunk is still indexed, just without context.
  const text = response.content
    .flatMap((b) => (b.type === "text" ? [b.text] : []))
    .join(" ")
    .trim();
  return text;
}
