import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-4 py-24">
      <div className="flex flex-col gap-4">
        <p className="text-sm font-medium text-muted-foreground">DocsAsk</p>
        <h1 className="text-4xl font-semibold tracking-tight">
          Ask the Next.js docs. Get answers with sources.
        </h1>
        <p className="text-lg text-muted-foreground">
          Every answer cites the exact passage it came from. If the docs don&apos;t
          cover your question, DocsAsk says so instead of guessing.
        </p>
      </div>
      <div className="flex gap-3">
        <Link href="/dashboard" className={buttonVariants({ size: "lg" })}>
          Get started
        </Link>
      </div>
    </main>
  );
}
