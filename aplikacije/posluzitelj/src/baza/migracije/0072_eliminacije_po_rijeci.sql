CREATE TABLE IF NOT EXISTS "eliminacije_po_rijeci" (
	"partija_id" uuid NOT NULL,
	"redni_broj" smallint NOT NULL,
	"kontekst" "kontekst_analitike" NOT NULL,
	"rijec" text NOT NULL,
	"razlog" text NOT NULL,
	"zrtva_id" uuid,
	"vrijeme" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "eliminacije_po_rijeci_pkey" PRIMARY KEY("partija_id","redni_broj")
);
--> statement-breakpoint
ALTER TABLE "eliminacije_po_rijeci" ADD CONSTRAINT "eliminacije_po_rijeci_zrtva_id_igraci_id_fk" FOREIGN KEY ("zrtva_id") REFERENCES "public"."igraci"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_eliminacije_po_rijeci_rijec" ON "eliminacije_po_rijeci" USING btree ("rijec");
