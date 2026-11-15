import { EMBEDDING_DIMENSIONS } from "../db/schema";
import { estimateTokens } from "./chunk";

/** Voyage AI embeddings over the REST API (there is no official TypeScript SDK). */

export const EMBEDDING_MODEL = "voyage-4";
const ENDPOINT = "https://api.voyageai.com/v1/embeddings";

// Voyage limits per request for voyage-4: 1,000 inputs and 320K tokens.
// Stay well under both, since our token count is an estimate.
const MAX_BATCH_INPUTS = 128;
const MAX_BATCH_TOKENS = 100_000;

export type InputType = "document" | "query";

export interface EmbedResult {
  embeddings: number[][];
  totalTokens: number;
}

interface VoyageResponse {
  data: { embedding: number[]; index: number }[];
  usage: { total_tokens: number };
}

/** Splits inputs into batches that respect both request limits, keeping order. */
export function batchInputs(inputs: string[]): string[][] {
  const batches: string[][] = [];
  let batch: string[] = [];
  let tokens = 0;
  for (const input of inputs) {
    const t = estimateTokens(input);
    if (batch.length && (batch.length >= MAX_BATCH_INPUTS || tokens + t > MAX_BATCH_TOKENS)) {
      batches.push(batch);
      batch = [];
      tokens = 0;
    }
    batch.push(input);
    tokens += t;
  }
  if (batch.length) batches.push(batch);
  return batches;
}

export async function embed(
  inputs: string[],
  inputType: InputType,
  { apiKey, fetchImpl = fetch }: { apiKey: string; fetchImpl?: typeof fetch },
): Promise<EmbedResult> {
  const embeddings: number[][] = [];
  let totalTokens = 0;
  for (const batch of batchInputs(inputs)) {
    const res = await withRetry(() =>
      fetchImpl(ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          input: batch,
          model: EMBEDDING_MODEL,
          input_type: inputType,
          output_dimension: EMBEDDING_DIMENSIONS,
        }),
      }),
    );
    const json = (await res.json()) as VoyageResponse;
    const ordered = [...json.data].sort((a, b) => a.index - b.index);
    if (ordered.length !== batch.length) {
      throw new Error(`Voyage returned ${ordered.length} embeddings for ${batch.length} inputs`);
    }
    embeddings.push(...ordered.map((d) => d.embedding));
    totalTokens += json.usage.total_tokens;
  }
  return { embeddings, totalTokens };
}

/** Retries 429 and 5xx with exponential backoff and jitter; other errors fail fast. */
export async function withRetry(
  request: () => Promise<Response>,
  { attempts = 5, baseMs = 1000 }: { attempts?: number; baseMs?: number } = {},
): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    const res = await request();
    if (res.ok) return res;
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= attempts) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Voyage API ${res.status}: ${detail.slice(0, 300)}`);
    }
    const retryAfter = Number(res.headers.get("retry-after"));
    const delay = retryAfter > 0 ? retryAfter * 1000 : baseMs * 2 ** (attempt - 1) * (0.5 + Math.random());
    await new Promise((r) => setTimeout(r, delay));
  }
}

/** What gets embedded: generated context, then where the chunk sits, then the chunk. */
export function embeddingInput(chunk: { context: string; headingPath: string; content: string }): string {
  return [chunk.context, chunk.headingPath, chunk.content].filter(Boolean).join("\n\n");
}
