import type { Metadata } from "next";
import Form from "next/form";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { auth } from "@/lib/auth";
import { search } from "@/lib/retrieval";
import { SearchHit } from "./search-hit";

export const metadata: Metadata = { title: "Search" };

const querySchema = z.string().trim().min(1).max(300);

// Not async: the heading renders in the static shell, and only the part that
// reads searchParams (request-time data) waits inside Suspense.
export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-12">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Search the Next.js docs</h1>
        <p className="text-sm text-muted-foreground">
          Hybrid retrieval: vector + keyword search, fused with RRF and reranked by Voyage rerank-3.
        </p>
      </div>
      <Suspense fallback={<SearchForm defaultValue="" />}>
        {searchParams.then(({ q }) => {
          const parsed = querySchema.safeParse(typeof q === "string" ? q : "");
          const query = parsed.success ? parsed.data : "";
          return (
            <>
              <SearchForm defaultValue={query} />
              {query && (
                <Suspense key={query} fallback={<p className="text-sm text-muted-foreground">Searching…</p>}>
                  <Results query={query} />
                </Suspense>
              )}
            </>
          );
        })}
      </Suspense>
    </main>
  );
}

function SearchForm({ defaultValue }: { defaultValue: string }) {
  return (
    <Form action="/search" className="flex gap-2" role="search">
      <Input
        name="q"
        defaultValue={defaultValue}
        placeholder="e.g. How do I cache a function that reads cookies?"
        aria-label="Search query"
        maxLength={300}
        required
      />
      <button type="submit" className={buttonVariants()}>
        Search
      </button>
    </Form>
  );
}

async function Results({ query }: { query: string }) {
  // The proxy only checks that a session cookie exists; verify it here, since
  // each search spends API calls.
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect(`/sign-in?next=${encodeURIComponent(`/search?q=${query}`)}`);

  let result;
  try {
    result = await search(query);
  } catch (error) {
    console.error("search failed", error);
    return (
      <p role="alert" className="text-sm text-destructive">
        Search failed. This is usually the embedding API&apos;s rate limit; try again in a minute.
      </p>
    );
  }

  if (result.hits.length === 0) {
    return <p className="text-sm text-muted-foreground">No matching passages.</p>;
  }

  return (
    <section aria-label="Results" className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">
        {result.hits.length} passages in {result.timingsMs.total} ms (search {result.timingsMs.search} ms
        {result.reranked ? `, rerank ${result.timingsMs.rerank} ms` : ""})
        {!result.reranked && " · reranking unavailable, showing fused order"}
      </p>
      <ol className="flex flex-col gap-4">
        {result.hits.map((hit, i) => (
          <li key={hit.id}>
            <SearchHit hit={hit} position={i + 1} />
          </li>
        ))}
      </ol>
    </section>
  );
}
