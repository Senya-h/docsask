import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import type { Chunk } from "@/lib/ingest/chunk";
import { contextCostUsd, contextualizeDocument, emptyUsage } from "@/lib/ingest/contextualize";

const chunk = (ordinal: number): Chunk => ({
  ordinal,
  headingPath: `Doc › Part ${ordinal}`,
  content: `Content ${ordinal}`,
  tokenCount: 3,
});

function fakeClient() {
  const events: string[] = [];
  const create = vi.fn(async (req: Anthropic.MessageCreateParamsNonStreaming) => {
    const text = (req.messages[0].content as Anthropic.TextBlockParam[])[1].text;
    const n = text.match(/Content (\d+)/)![1];
    events.push(`start ${n}`);
    await new Promise((r) => setTimeout(r, n === "0" ? 20 : 1));
    events.push(`end ${n}`);
    return {
      content: [{ type: "text", text: `Context ${n}.` }],
      usage: {
        input_tokens: 10,
        cache_creation_input_tokens: n === "0" ? 1000 : 0,
        cache_read_input_tokens: n === "0" ? 0 : 1000,
        output_tokens: 5,
      },
    };
  });
  return { client: { messages: { create } } as unknown as Anthropic, create, events };
}

describe("contextualizeDocument", () => {
  it("returns one context per chunk, in chunk order", async () => {
    const { client } = fakeClient();
    const contexts = await contextualizeDocument(client, { title: "Doc", body: "Body" }, [0, 1, 2].map(chunk), emptyUsage());
    expect(contexts).toEqual(["Context 0.", "Context 1.", "Context 2."]);
  });

  it("finishes the first request before starting the others, so they can read its cache", async () => {
    const { client, events } = fakeClient();
    await contextualizeDocument(client, { title: "Doc", body: "Body" }, [0, 1, 2].map(chunk), emptyUsage());
    expect(events.slice(0, 2)).toEqual(["start 0", "end 0"]);
  });

  it("puts the document in a cached block that is identical for every chunk", async () => {
    const { client, create } = fakeClient();
    await contextualizeDocument(client, { title: "Doc", body: "Body" }, [0, 1].map(chunk), emptyUsage());
    const prefixes = create.mock.calls.map(([req]) => (req.messages[0].content as Anthropic.TextBlockParam[])[0]);
    expect(prefixes[0]).toEqual(prefixes[1]);
    expect(prefixes[0].cache_control).toEqual({ type: "ephemeral" });
    expect(prefixes[0].text).toContain("Body");
    // The system prompt must not vary either, or the cache would miss.
    expect(create.mock.calls[0][0].system).toBe(create.mock.calls[1][0].system);
  });

  it("adds up token usage across requests", async () => {
    const { client } = fakeClient();
    const usage = emptyUsage();
    await contextualizeDocument(client, { title: "Doc", body: "Body" }, [0, 1, 2].map(chunk), usage);
    expect(usage).toEqual({ requests: 3, inputTokens: 30, cacheWriteTokens: 1000, cacheReadTokens: 2000, outputTokens: 15 });
    expect(contextCostUsd(usage)).toBeCloseTo((30 * 0.1 + 1000 * 0.125 + 2000 * 0.01 + 15 * 0.5) / 1e6);
  });

  it("makes no requests for a document without chunks", async () => {
    const { client, create } = fakeClient();
    expect(await contextualizeDocument(client, { title: "Doc", body: "" }, [], emptyUsage())).toEqual([]);
    expect(create).not.toHaveBeenCalled();
  });
});
