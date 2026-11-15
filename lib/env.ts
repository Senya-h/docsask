import { z } from "zod";

/**
 * Server-side environment, validated once at startup.
 * Set SKIP_ENV_VALIDATION=1 for CI builds that run without secrets.
 */
const schema = z.object({
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),
  // Needed from Phase 2 on; optional until then.
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  VOYAGE_API_KEY: z.string().min(1).optional(),
});

export type Env = z.infer<typeof schema>;

function load(): Env {
  if (process.env.SKIP_ENV_VALIDATION) {
    return process.env as unknown as Env;
  }
  // Treat blank lines like `KEY=` as unset, so optional keys can stay empty in .env files.
  const present = Object.fromEntries(
    Object.entries(process.env).filter(([, value]) => value !== ""),
  );
  const parsed = schema.safeParse(present);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}\nSee .env.example.`);
  }
  return parsed.data;
}

export const env = load();
