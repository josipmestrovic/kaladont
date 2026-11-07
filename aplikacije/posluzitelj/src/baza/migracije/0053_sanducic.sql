CREATE TABLE "sanducic_poruke" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"igrac_id" uuid NOT NULL,
	"tip" text NOT NULL,
	"podaci" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"izvor_tip" text,
	"izvor_id" text,
	"mod" text,
	"deduplikacijski_kljuc" text NOT NULL,
	"stvorena_at" timestamp with time zone DEFAULT now() NOT NULL,
	"procitano_at" timestamp with time zone,
	"najavljeno_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "sanducic_poruke" ADD CONSTRAINT "sanducic_poruke_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_sanducic_poruke_igrac_dedup" ON "sanducic_poruke" USING btree ("igrac_id","deduplikacijski_kljuc");
--> statement-breakpoint
CREATE INDEX "idx_sanducic_poruke_lista" ON "sanducic_poruke" USING btree ("igrac_id","stvorena_at");
--> statement-breakpoint
CREATE INDEX "idx_sanducic_poruke_neprocitane" ON "sanducic_poruke" USING btree ("igrac_id") WHERE "sanducic_poruke"."procitano_at" is null;
--> statement-breakpoint
CREATE INDEX "idx_sanducic_poruke_nenajavljene" ON "sanducic_poruke" USING btree ("igrac_id") WHERE "sanducic_poruke"."najavljeno_at" is null;
--> statement-breakpoint
CREATE INDEX "idx_sanducic_poruke_stvorena" ON "sanducic_poruke" USING btree ("stvorena_at");
