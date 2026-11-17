import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Hit } from "@/lib/retrieval";
import { snippetParts } from "@/lib/retrieval/snippet";

function Snippet({ content }: { content: string }) {
  return (
    <div className="flex flex-col gap-2 text-sm">
      {snippetParts(content).map((part, i) =>
        part.kind === "text" ? (
          <p key={i} className="line-clamp-4 whitespace-pre-line">
            {part.text}
          </p>
        ) : (
          <figure key={i} className="overflow-hidden rounded-md bg-muted">
            {part.filename && (
              <figcaption className="border-b px-3 py-1 font-mono text-xs text-muted-foreground">
                {part.filename}
              </figcaption>
            )}
            <pre className="overflow-x-auto px-3 py-2 font-mono text-xs leading-relaxed">
              <code>
                {part.text}
                {part.truncated && "\n…"}
              </code>
            </pre>
          </figure>
        ),
      )}
    </div>
  );
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
        <Snippet content={hit.content} />
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
