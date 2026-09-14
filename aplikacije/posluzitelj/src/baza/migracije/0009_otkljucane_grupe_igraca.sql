CREATE TABLE IF NOT EXISTS "otkljucane_grupe_igraca" (
	"igrac_id" uuid NOT NULL,
	"grupa" text NOT NULL,
	"tier" smallint,
	"otkljucano" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "otkljucane_grupe_igraca_igrac_id_grupa_pk" PRIMARY KEY("igrac_id", "grupa")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "otkljucane_grupe_igraca" ADD CONSTRAINT "otkljucane_grupe_igraca_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;