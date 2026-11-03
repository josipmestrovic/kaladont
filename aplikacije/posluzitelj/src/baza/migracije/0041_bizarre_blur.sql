CREATE TYPE "public"."tip_prijave_rijeci" AS ENUM('za_brisanje', 'za_dodavanje');--> statement-breakpoint
DROP INDEX IF EXISTS "uq_prijave_igrac_partija_potez";--> statement-breakpoint
ALTER TABLE "prijave" ADD COLUMN "tip" "tip_prijave_rijeci" DEFAULT 'za_brisanje' NOT NULL;--> statement-breakpoint
ALTER TABLE "prijave" ADD COLUMN "rijec" text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE "prijave" AS p SET "rijec" = potezi."rijec" FROM "potezi" WHERE p."potez_id" = potezi."id" AND potezi."rijec" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_prijave_brisanje_igrac_partija_potez" ON "prijave" USING btree ("igrac_id","partija_id","potez_id") WHERE "prijave"."tip" = 'za_brisanje';--> statement-breakpoint
CREATE UNIQUE INDEX "uq_prijave_dodavanje_igrac_partija_rijec" ON "prijave" USING btree ("igrac_id","partija_id","rijec") WHERE "prijave"."tip" = 'za_dodavanje';