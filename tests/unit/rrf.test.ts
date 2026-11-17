import { describe, expect, it } from "vitest";
import { reciprocalRankFusion } from "@/lib/retrieval/rrf";

describe("reciprocalRankFusion", () => {
  it("scores each item as the sum of 1 / (k + rank)", () => {
    const [top] = reciprocalRankFusion([["a", "b"], ["a"]], 60);
    expect(top.id).toBe("a");
    expect(top.score).toBeCloseTo(1 / 61 + 1 / 61);
    expect(top.ranks).toEqual([1, 1]);
  });

  it("ranks agreement between lists above a single first place", () => {
    // "b" is second in both lists; "a" and "c" are each first in only one.
    const fused = reciprocalRankFusion([
      ["a", "b"],
      ["c", "b"],
    ]);
    expect(fused[0].id).toBe("b");
  });

  it("keeps items that appear in only one list, with the other rank undefined", () => {
    const fused = reciprocalRankFusion([["a"], ["b"]]);
    expect(fused.map((f) => f.ranks)).toEqual([[1, undefined], [undefined, 1]]);
  });

  it("breaks score ties deterministically", () => {
    const once = reciprocalRankFusion([["x"], ["y"]]).map((f) => f.id);
    const again = reciprocalRankFusion([["x"], ["y"]]).map((f) => f.id);
    expect(once).toEqual(again);
  });

  it("counts a duplicate within one list only once, at its best rank", () => {
    const [item] = reciprocalRankFusion([["a", "a"]]);
    expect(item.ranks).toEqual([1]);
    expect(item.score).toBeCloseTo(1 / 61);
  });

  it("handles empty input", () => {
    expect(reciprocalRankFusion([[], []])).toEqual([]);
  });
});
