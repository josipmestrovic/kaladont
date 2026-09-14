ALTER TABLE "otkljucane_rijeci_igraca" ADD COLUMN IF NOT EXISTS "duga_tier" smallint;
--> statement-breakpoint
ALTER TABLE "otkljucane_rijeci_igraca" ADD COLUMN IF NOT EXISTS "rijetka_tier" smallint;