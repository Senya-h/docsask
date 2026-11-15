import { afterEach, describe, expect, it, vi } from "vitest";

const valid = {
  DATABASE_URL: "postgresql://u:p@localhost/db",
  BETTER_AUTH_SECRET: "x".repeat(32),
  BETTER_AUTH_URL: "http://localhost:3000",
  GITHUB_CLIENT_ID: "id",
  GITHUB_CLIENT_SECRET: "secret",
};

async function loadEnv(vars: Record<string, string | undefined>) {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv("SKIP_ENV_VALIDATION", "");
  for (const [key, value] of Object.entries(vars)) vi.stubEnv(key, value);
  return (await import("@/lib/env")).env;
}

describe("env", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("accepts a complete environment", async () => {
    const env = await loadEnv(valid);
    expect(env.DATABASE_URL).toBe(valid.DATABASE_URL);
  });

  it("treats blank optional keys as unset", async () => {
    const env = await loadEnv({ ...valid, ANTHROPIC_API_KEY: "", VOYAGE_API_KEY: "" });
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
  });

  it("rejects a blank required key", async () => {
    await expect(loadEnv({ ...valid, GITHUB_CLIENT_ID: "" })).rejects.toThrow(/GITHUB_CLIENT_ID/);
  });

  it("rejects a short auth secret", async () => {
    await expect(loadEnv({ ...valid, BETTER_AUTH_SECRET: "short" })).rejects.toThrow(
      /BETTER_AUTH_SECRET/,
    );
  });

  it("rejects a malformed database URL", async () => {
    await expect(loadEnv({ ...valid, DATABASE_URL: "not-a-url" })).rejects.toThrow(
      /DATABASE_URL/,
    );
  });
});
