-- Ručne grupe i frekvencija za #89 (hrLex UPSERT ih čuva).
ALTER TABLE "rijeci" ADD COLUMN IF NOT EXISTS "rucno_dodane_grupe" text[] DEFAULT '{}' NOT NULL;
--> statement-breakpoint
ALTER TABLE "rijeci" ADD COLUMN IF NOT EXISTS "rucna_frekvencija" integer;