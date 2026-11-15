import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GitHubSignInButton } from "./github-sign-in-button";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-24">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in to DocsAsk</CardTitle>
          <CardDescription>Use your GitHub account to continue.</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense>
            <GitHubSignInButton />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
