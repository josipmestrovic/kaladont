CREATE TABLE IF NOT EXISTS "statistike_rijeci_igraca" (
	"igrac_id" uuid NOT NULL,
	"mod" "mod_partije" NOT NULL,
	"najduzi_streak" integer DEFAULT 0 NOT NULL,
	"otkrivene_jako_rijetke_grupe" integer DEFAULT 0 NOT NULL,
	"otkrivene_srednje_rijetke_grupe" integer DEFAULT 0 NOT NULL,
	"otkrivene_rijetke_grupe" integer DEFAULT 0 NOT NULL,
	"upisane_duge_rijeci" integer DEFAULT 0 NOT NULL,
	"upisane_srednje_duge_rijeci" integer DEFAULT 0 NOT NULL,
	"upisane_jako_duge_rijeci" integer DEFAULT 0 NOT NULL,
	"najduza_rijec" text,
	"najduza_rijec_grafemi" integer DEFAULT 0 NOT NULL,
	"najrjeda_rijec" text,
	"najrjeda_rijec_frekvencija" integer,
	"najrjeda_tier" smallint,
	CONSTRAINT "statistike_rijeci_igraca_igrac_id_mod_pk" PRIMARY KEY("igrac_id", "mod")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "statistike_rijeci_igraca" ADD CONSTRAINT "statistike_rijeci_igraca_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;