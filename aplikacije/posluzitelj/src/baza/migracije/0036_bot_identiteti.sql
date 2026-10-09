CREATE TYPE "public"."upravljac_igraca" AS ENUM('covjek', 'bot');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "botovi" (
	"igrac_id" uuid PRIMARY KEY NOT NULL,
	"kljuc_seeda" text NOT NULL,
	"aktivan" boolean DEFAULT true NOT NULL,
	"verzija_profila" smallint DEFAULT 1 NOT NULL,
	"stvoren" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "igraci" ADD COLUMN "upravljac" "upravljac_igraca" DEFAULT 'covjek' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "botovi" ADD CONSTRAINT "botovi_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_botovi_kljuc_seeda" ON "botovi" USING btree ("kljuc_seeda");