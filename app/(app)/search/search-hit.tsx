import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Hit } from "@/lib/retrieval";

const SNIPPET_CHARS = 600;

/** Drops the chunk's own heading line (already shown as the title) and trims to a preview. */
export function snippet(content: string): string {
  const body = content.replace(/^#{1,6} .*\n+/, "");
  return body.length > SNIPPET_CHARS ? `${body.slice(0, SNIPPET_CHARS).trimEnd()}…` : body;
}

export function SearchHit({ hit, position }: { hit: Hit; position: number }) {
  const path = hit.headingPath.split(" › ");
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription className="flex flex-wrap items-center gap-2">
          <span className="tabular-nums">#{position}</span>
          {hit.section && <Badge variant="secondary">{hit.section}</Badge>}
          <span>{path.slice(0, -1).join(" › ") || hit.documentTitle}</span>
        </CardDescription>
        <CardTitle>
          <a href={hit.url} target="_blank" rel="noreferrer" className="hover:underline">
            {path.at(-1)}
          </a>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {hit.context && <p className="text-sm italic text-muted-foreground">{hit.context}</p>}
        <p className="line-clamp-6 text-sm whitespace-pre-line">{snippet(hit.content)}</p>
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground" aria-label="Ranking signals">
          {hit.rerankScore !== undefined && <Badge variant="outline">rerank {hit.rerankScore.toFixed(2)}</Badge>}
          <Badge variant="outline">vector {hit.vectorRank ? `#${hit.vectorRank}` : "—"}</Badge>
          <Badge variant="outline">keyword {hit.keywordRank ? `#${hit.keywordRank}` : "—"}</Badge>
          <Badge variant="outline">fused #{hit.fusedRank}</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
