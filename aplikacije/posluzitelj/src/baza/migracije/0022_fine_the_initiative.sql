CREATE TYPE "public"."status_povratne_informacije" AS ENUM('nova', 'pregledana', 'arhivirana');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "povratne_informacije" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "povratne_informacije_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"igrac_id" uuid NOT NULL,
	"poruka" text NOT NULL,
	"pravila" smallint,
	"rjecnik" smallint,
	"vrijeme_poteza" smallint,
	"snalazenje_u_aplikaciji" smallint,
	"brzina_ucitavanja" smallint,
	"gamifikacija" smallint,
	"status" "status_povratne_informacije" DEFAULT 'nova' NOT NULL,
	"vrijeme" timestamp with time zone DEFAULT now() NOT NULL,
	"pregledao_id" uuid,
	"pregledano" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "napredak_dostignuca_igraca" ADD COLUMN "povratne_informacije" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "napredak_dostignuca_igraca" ADD COLUMN "anketa_ispunjena" boolean DEFAULT false NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "povratne_informacije" ADD CONSTRAINT "povratne_informacije_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "povratne_informacije" ADD CONSTRAINT "povratne_informacije_pregledao_id_igraci_id_fk" FOREIGN KEY ("pregledao_id") REFERENCES "public"."igraci"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_povratne_informacije_vrijeme" ON "povratne_informacije" USING btree ("vrijeme");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_povratne_informacije_status" ON "povratne_informacije" USING btree ("status");