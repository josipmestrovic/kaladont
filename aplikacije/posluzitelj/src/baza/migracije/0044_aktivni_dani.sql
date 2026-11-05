CREATE TABLE IF NOT EXISTS "aktivnost_igraca_dani" (
	"igrac_id" uuid NOT NULL,
	"lokalni_datum" date NOT NULL,
	"zabiljezen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "aktivnost_igraca_dani_igrac_id_lokalni_datum_pk" PRIMARY KEY("igrac_id","lokalni_datum")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "niz_aktivnosti_igraca" (
	"igrac_id" uuid PRIMARY KEY NOT NULL,
	"zadnji_aktivni_datum" date NOT NULL,
	"trenutni_niz" integer NOT NULL,
	"najbolji_niz" integer NOT NULL,
	"azurirano_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_niz_aktivnosti_trenutni" CHECK ("trenutni_niz" >= 1),
	CONSTRAINT "chk_niz_aktivnosti_najbolji" CHECK ("najbolji_niz" >= "trenutni_niz")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "aktivnost_igraca_dani" ADD CONSTRAINT "aktivnost_igraca_dani_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "niz_aktivnosti_igraca" ADD CONSTRAINT "niz_aktivnosti_igraca_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
