DROP INDEX "documents_version_path_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "documents_version_path_idx" ON "documents" USING btree ("version","path");