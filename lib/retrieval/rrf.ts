/**
 * Reciprocal Rank Fusion (Cormack et al., 2009).
 *
 * Combines ranked lists from different retrievers without comparing their raw
 * scores, which live on different scales (cosine similarity vs ts_rank_cd).
 * Each item scores the sum of 1 / (k + rank) over the lists it appears in.
 * k = 60 is the value from the original paper and the common default: it keeps
 * a single first place from outweighing agreement between retrievers.
 */

export interface FusedItem {
  id: string;
  score: number;
  /** 1-based rank in each input list, undefined where the item is absent. */
  ranks: (number | undefined)[];
}

export function reciprocalRankFusion(lists: string[][], k = 60): FusedItem[] {
  const items = new Map<string, FusedItem>();
  lists.forEach((list, listIndex) => {
    list.forEach((id, position) => {
      let item = items.get(id);
      if (!item) {
        item = { id, score: 0, ranks: lists.map(() => undefined) };
        items.set(id, item);
      }
      // A retriever should not return duplicates; if it does, count the best rank only.
      if (item.ranks[listIndex] !== undefined) return;
      const rank = position + 1;
      item.ranks[listIndex] = rank;
      item.score += 1 / (k + rank);
    });
  });
  return [...items.values()].sort(
    (a, b) => b.score - a.score || bestRank(a) - bestRank(b) || a.id.localeCompare(b.id),
  );
}

function bestRank(item: FusedItem): number {
  return Math.min(...item.ranks.map((r) => r ?? Infinity));
}
