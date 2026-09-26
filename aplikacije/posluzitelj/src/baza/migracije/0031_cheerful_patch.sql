CREATE TABLE IF NOT EXISTS "nizovi_pobjeda_igraca" (
	"igrac_id" uuid NOT NULL,
	"mod" "mod_partije" NOT NULL,
	"trenutni_niz" integer DEFAULT 0 NOT NULL,
	"najbolji_niz" integer DEFAULT 0 NOT NULL,
	"zadnja_obradena_partija_id" uuid,
	"azurirano" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nizovi_pobjeda_igraca_igrac_id_mod_pk" PRIMARY KEY("igrac_id","mod")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "nizovi_pobjeda_igraca" ADD CONSTRAINT "nizovi_pobjeda_igraca_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_nizovi_pobjeda_zadnja_partija" ON "nizovi_pobjeda_igraca" USING btree ("zadnja_obradena_partija_id");