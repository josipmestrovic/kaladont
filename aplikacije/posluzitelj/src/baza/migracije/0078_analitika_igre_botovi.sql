CREATE TYPE "public"."profil_analitike_botova" AS ENUM('pocetnik', 'iskusni', 'majstor', 'velemajstor', 'prilagodeno');
--> statement-breakpoint
CREATE TYPE "public"."vrsta_pobjednika_analitike" AS ENUM('covjek', 'bot');
--> statement-breakpoint
ALTER TABLE "analitika_igre" ADD COLUMN IF NOT EXISTS "broj_ljudi" smallint;
--> statement-breakpoint
ALTER TABLE "analitika_igre" ADD COLUMN IF NOT EXISTS "broj_botova" smallint;
--> statement-breakpoint
ALTER TABLE "analitika_igre" ADD COLUMN IF NOT EXISTS "profil_botova" "profil_analitike_botova";
--> statement-breakpoint
ALTER TABLE "analitika_igre" ADD COLUMN IF NOT EXISTS "verzija_bot_politike" integer;
--> statement-breakpoint
ALTER TABLE "analitika_igre" ADD COLUMN IF NOT EXISTS "verzija_profila_bota" integer;
--> statement-breakpoint
ALTER TABLE "analitika_igre" ADD COLUMN IF NOT EXISTS "vrsta_pobjednika" "vrsta_pobjednika_analitike";
--> statement-breakpoint
ALTER TABLE "analitika_igre" ADD COLUMN IF NOT EXISTS "eliminacije_ljudi" jsonb;
--> statement-breakpoint
ALTER TABLE "analitika_igre" ADD COLUMN IF NOT EXISTS "eliminacije_botova" jsonb;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_analitika_igre_pocetak_botovi" ON "analitika_igre" USING btree ("pocetak_u","broj_botova");
