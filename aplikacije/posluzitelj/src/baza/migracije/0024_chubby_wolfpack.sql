DO $$ BEGIN
 CREATE TYPE "public"."vrsta_obracuna_partije" AS ENUM('javna_partija', 'privatna_gamifikacija');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "obracuni_partija" (
	"partija_id" uuid NOT NULL,
	"vrsta" "vrsta_obracuna_partije" NOT NULL,
	"stvoren" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "obracuni_partija_partija_id_vrsta_pk" PRIMARY KEY("partija_id","vrsta")
);
