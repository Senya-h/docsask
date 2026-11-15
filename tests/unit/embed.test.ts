import { describe, expect, it, vi } from "vitest";
import { batchInputs, embed, embeddingInput, withRetry } from "@/lib/ingest/embed";

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe("batchInputs", () => {
  it("caps each batch at 128 inputs and keeps order", () => {
    const inputs = Array.from({ length: 300 }, (_, i) => `t${i}`);
    const batches = batchInputs(inputs);
    expect(batches.map((b) => b.length)).toEqual([128, 128, 44]);
    expect(batches.flat()).toEqual(inputs);
  });

  it("starts a new batch before exceeding the token budget", () => {
    const big = "x".repeat(3.5 * 60_000); // ~60K tokens each
    expect(batchInputs([big, big, big]).map((b) => b.length)).toEqual([1, 1, 1]);
  });
});

describe("embed", () => {
  it("sends document embeddings at 1024 dimensions and restores input order", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body).toMatchObject({ model: "voyage-4", input_type: "document", output_dimension: 1024 });
      return ok({
        data: [
          { embedding: [2], index: 1 },
          { embedding: [1], index: 0 },
        ],
        usage: { total_tokens: 7 },
      });
    });
    const result = await embed(["a", "b"], "document", { apiKey: "k", fetchImpl: fetchImpl as typeof fetch });
    expect(result).toEqual({ embeddings: [[1], [2]], totalTokens: 7 });
  });

  it("fails when the response is missing embeddings", async () => {
    const fetchImpl = vi.fn(async () => ok({ data: [], usage: { total_tokens: 0 } }));
    await expect(embed(["a"], "query", { apiKey: "k", fetchImpl: fetchImpl as typeof fetch })).rejects.toThrow(
      /0 embeddings for 1 inputs/,
    );
  });
});

describe("withRetry", () => {
  it("retries 429 and 5xx, then succeeds", async () => {
    const responses = [new Response("", { status: 429 }), new Response("", { status: 503 }), ok({})];
    const request = vi.fn(async () => responses.shift()!);
    const res = await withRetry(request, { baseMs: 1 });
    expect(res.status).toBe(200);
    expect(request).toHaveBeenCalledTimes(3);
  });

  it("fails fast on a 4xx that is not 429", async () => {
    const request = vi.fn(async () => new Response("bad key", { status: 401 }));
    await expect(withRetry(request, { baseMs: 1 })).rejects.toThrow(/401: bad key/);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("gives up after the last attempt", async () => {
    const request = vi.fn(async () => new Response("", { status: 500 }));
    await expect(withRetry(request, { attempts: 3, baseMs: 1 })).rejects.toThrow(/500/);
    expect(request).toHaveBeenCalledTimes(3);
  });
});

describe("embeddingInput", () => {
  it("puts context first and skips an empty context", () => {
    expect(embeddingInput({ context: "Ctx.", headingPath: "A › B", content: "Body" })).toBe("Ctx.\n\nA › B\n\nBody");
    expect(embeddingInput({ context: "", headingPath: "A", content: "Body" })).toBe("A\n\nBody");
  });
});
