import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  casing: "snake_case",
  dbCredentials: {
    // `drizzle-kit generate` doesn't connect, so a placeholder is fine there.
    url: process.env.DATABASE_URL ?? "postgres://placeholder@localhost/placeholder",
  },
  strict: true,
  verbose: true,
});
