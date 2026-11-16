-- Grupno uklanjanje / zajednički sloj za #75 (#89 nastavlja na istom ugovoru).
CREATE INDEX IF NOT EXISTS "idx_rijeci_grupe_gin" ON "rijeci" USING gin ("grupe");
--> statement-breakpoint
ALTER TABLE "izmjene_rjecnika" ADD COLUMN IF NOT EXISTS "operacija_id" uuid;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_izmjene_rjecnika_operacija_id" ON "izmjene_rjecnika" ("operacija_id") WHERE "operacija_id" is not null;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "operacije_rjecnika" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kljuc" text NOT NULL,
	"smjer" text NOT NULL,
	"otisak" text NOT NULL,
	"otisak_zahtjeva" text NOT NULL,
	"admin_id" uuid,
	"izvorna_rijec" text NOT NULL,
	"prijava_id" integer,
	"ishod" jsonb NOT NULL,
	"stvoreno_u" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_operacije_rjecnika_kljuc" UNIQUE("kljuc"),
	CONSTRAINT "chk_operacije_rjecnika_smjer" CHECK ("smjer" in ('ukloni', 'dodaj'))
);
--> statement-breakpoint
ALTER TABLE "operacije_rjecnika" ADD CONSTRAINT "operacije_rjecnika_admin_id_igraci_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."igraci"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "operacije_rjecnika" ADD CONSTRAINT "operacije_rjecnika_prijava_id_prijave_id_fk" FOREIGN KEY ("prijava_id") REFERENCES "public"."prijave"("id") ON DELETE set null ON UPDATE no action;
