CREATE TABLE IF NOT EXISTS "prijave_igraca" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "prijave_igraca_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"partija_id" uuid NOT NULL,
	"prijavitelj_id" uuid NOT NULL,
	"prijavljeni_igrac_id" uuid NOT NULL,
	"razlog" text NOT NULL,
	"poruka" text NOT NULL,
	"status" "status_prijave" DEFAULT 'nova' NOT NULL,
	"vrijeme" timestamp with time zone DEFAULT now() NOT NULL,
	"rijesio_id" uuid,
	"napomena_admina" text
);
--> statement-breakpoint
ALTER TABLE "sudionici_partije" ADD COLUMN "nadimak" text DEFAULT 'Nepoznati igrač' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prijave_igraca" ADD CONSTRAINT "prijave_igraca_partija_id_partije_id_fk" FOREIGN KEY ("partija_id") REFERENCES "public"."partije"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prijave_igraca" ADD CONSTRAINT "prijave_igraca_prijavitelj_id_igraci_id_fk" FOREIGN KEY ("prijavitelj_id") REFERENCES "public"."igraci"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prijave_igraca" ADD CONSTRAINT "prijave_igraca_prijavljeni_igrac_id_igraci_id_fk" FOREIGN KEY ("prijavljeni_igrac_id") REFERENCES "public"."igraci"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prijave_igraca" ADD CONSTRAINT "prijave_igraca_rijesio_id_igraci_id_fk" FOREIGN KEY ("rijesio_id") REFERENCES "public"."igraci"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_prijave_igraca_vrijeme" ON "prijave_igraca" USING btree ("vrijeme");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_prijave_igraca_partija_prijavitelj_igrac" ON "prijave_igraca" USING btree ("partija_id","prijavitelj_id","prijavljeni_igrac_id");