CREATE TABLE IF NOT EXISTS "otkljucane_rijeci_igraca" (
	"igrac_id" uuid NOT NULL,
	"rijec" text NOT NULL,
	"jako_duga" boolean DEFAULT false NOT NULL,
	"jako_rijetka" boolean DEFAULT false NOT NULL,
	"otkljucano" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "otkljucane_rijeci_igraca_igrac_id_rijec_pk" PRIMARY KEY("igrac_id", "rijec")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "otkljucane_rijeci_igraca" ADD CONSTRAINT "otkljucane_rijeci_igraca_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;