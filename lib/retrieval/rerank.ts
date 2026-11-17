import { withRetry } from "../ingest/embed";

/** Voyage rerank-3: a cross-encoder that scores each (query, passage) pair directly. */

export const RERANK_MODEL = "rerank-3";
const ENDPOINT = "https://api.voyageai.com/v1/rerank";

export interface RerankScore {
  /** Index into the documents array that was sent. */
  index: number;
  score: number;
}

interface VoyageRerankResponse {
  data: { index: number; relevance_score: number }[];
  usage: { total_tokens: number };
}

export async function rerank(
  query: string,
  documents: string[],
  topK: number,
  { apiKey, fetchImpl = fetch }: { apiKey: string; fetchImpl?: typeof fetch },
): Promise<RerankScore[]> {
  if (documents.length === 0) return [];
  const res = await withRetry(
    () =>
      fetchImpl(ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query, documents, model: RERANK_MODEL, top_k: topK }),
      }),
    // Interactive path: fail fast and fall back to fused ranking instead of waiting.
    { attempts: 2, baseMs: 300 },
  );
  const json = (await res.json()) as VoyageRerankResponse;
  return json.data
    .map((d) => ({ index: d.index, score: d.relevance_score }))
    .sort((a, b) => b.score - a.score);
}
