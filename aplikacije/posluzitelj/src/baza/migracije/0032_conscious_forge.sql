CREATE TABLE IF NOT EXISTS "rezultati_forme_igraca" (
	"igrac_id" uuid NOT NULL,
	"partija_id" uuid NOT NULL,
	"mod" "mod_partije" NOT NULL,
	"zavrseno" timestamp with time zone DEFAULT now() NOT NULL,
	"plasman" smallint NOT NULL,
	"bodovi" smallint NOT NULL,
	"eliminacije" smallint NOT NULL,
	CONSTRAINT "rezultati_forme_igraca_igrac_id_partija_id_pk" PRIMARY KEY("igrac_id","partija_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "rezultati_forme_igraca" ADD CONSTRAINT "rezultati_forme_igraca_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_rezultati_forme_igraca_mod_zavrseno" ON "rezultati_forme_igraca" USING btree ("igrac_id","mod","zavrseno");