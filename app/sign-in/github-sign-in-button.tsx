"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { signIn } from "@/lib/auth-client";

/** Only allow same-site relative paths, so `?next=` can't redirect off-site. */
function safeNext(value: string | null): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return "/dashboard";
}

export function GitHubSignInButton() {
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setPending(true);
    setError(null);
    const { error } = await signIn.social({
      provider: "github",
      callbackURL: safeNext(searchParams.get("next")),
    });
    if (error) {
      setError(error.message ?? "Sign-in failed. Please try again.");
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Button onClick={onClick} disabled={pending} className="w-full">
        {pending ? "Redirecting…" : "Continue with GitHub"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
