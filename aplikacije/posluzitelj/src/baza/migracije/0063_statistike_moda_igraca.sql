CREATE TABLE IF NOT EXISTS "statistike_moda_igraca" (
	"igrac_id" uuid NOT NULL,
	"mod" "mod_partije" NOT NULL,
	"odigrane" integer DEFAULT 0 NOT NULL,
	"pobjede" integer DEFAULT 0 NOT NULL,
	"eliminacije" integer DEFAULT 0 NOT NULL,
	"bodovi" integer DEFAULT 0 NOT NULL,
	"azurirano" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "statistike_moda_igraca_igrac_id_mod_pk" PRIMARY KEY("igrac_id","mod")
);
--> statement-breakpoint
ALTER TABLE "statistike_moda_igraca" ADD CONSTRAINT "statistike_moda_igraca_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE cascade ON UPDATE no action;
