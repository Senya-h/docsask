import "server-only";
import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { env } from "../env";
import { embed } from "../ingest/embed";
import { retrieve, type ChunkRecord, type RetrievalDeps, type RetrievalOptions } from "./pipeline";
import { rerank } from "./rerank";

/** Retrieval backed by Postgres (pgvector + full-text search) and Voyage. */

const vectorSearch: RetrievalDeps["vectorSearch"] = async (embedding, limit) => {
  // `<=>` is cosine distance; ORDER BY it uses the HNSW index.
  const { rows } = await db.execute<{ id: string }>(sql`
    select c.id
    from chunks c
    join documents d on d.id = c.document_id
    where d.status = 'ready' and c.embedding is not null
    order by c.embedding <=> ${JSON.stringify(embedding)}::vector
    limit ${limit}
  `);
  return rows.map((r) => r.id);
};

const keywordSearch: RetrievalDeps["keywordSearch"] = async (query, limit) => {
  // websearch_to_tsquery accepts free text safely ("quotes", -exclusions, or).
  // ts_rank_cd rewards matching terms that appear close together.
  const { rows } = await db.execute<{ id: string }>(sql`
    select c.id
    from chunks c
    join documents d on d.id = c.document_id,
      websearch_to_tsquery('english', ${query}) q
    where d.status = 'ready' and c.tsv @@ q
    order by ts_rank_cd(c.tsv, q) desc, c.id
    limit ${limit}
  `);
  return rows.map((r) => r.id);
};

const loadChunks: RetrievalDeps["loadChunks"] = async (ids) => {
  if (ids.length === 0) return [];
  const { rows } = await db.execute<ChunkRecord & Record<string, unknown>>(sql`
    select c.id, c.heading_path as "headingPath", c.content, c.context,
           d.title as "documentTitle", d.url as "documentUrl", d.section
    from chunks c
    join documents d on d.id = c.document_id
    where c.id in (${sql.join(
      ids.map((id) => sql`${id}::uuid`),
      sql`, `,
    )})
  `);
  return rows;
};

function voyageKey(): string {
  if (!env.VOYAGE_API_KEY) throw new Error("VOYAGE_API_KEY is not set");
  return env.VOYAGE_API_KEY;
}

const deps: RetrievalDeps = {
  embedQuery: async (query) => (await embed([query], "query", { apiKey: voyageKey() })).embeddings[0],
  vectorSearch,
  keywordSearch,
  loadChunks,
  rerank: (query, documents, topK) => rerank(query, documents, topK, { apiKey: voyageKey() }),
};

export function search(query: string, options?: RetrievalOptions) {
  return retrieve(query, deps, options);
}

export type { Hit, RetrievalResult } from "./pipeline";
