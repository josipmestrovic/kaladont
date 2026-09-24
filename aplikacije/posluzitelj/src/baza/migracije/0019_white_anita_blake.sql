CREATE TABLE IF NOT EXISTS "dnk_statistike_igraca" (
	"igrac_id" uuid NOT NULL,
	"mod" "mod_partije" NOT NULL,
	"prihvaceni_potezi" integer DEFAULT 0 NOT NULL,
	"ukupno_trajanje_prihvacenih_poteza_ms" integer DEFAULT 0 NOT NULL,
	"najduzi_streak" integer DEFAULT 0 NOT NULL,
	"duge_rijeci" integer DEFAULT 0 NOT NULL,
	"srednje_duge_rijeci" integer DEFAULT 0 NOT NULL,
	"jako_duge_rijeci" integer DEFAULT 0 NOT NULL,
	"rijetke_rijeci" integer DEFAULT 0 NOT NULL,
	"srednje_rijetke_rijeci" integer DEFAULT 0 NOT NULL,
	"jako_rijetke_rijeci" integer DEFAULT 0 NOT NULL,
	"zbroj_ocjena_igre" integer DEFAULT 0 NOT NULL,
	"broj_ocjena_igre" integer DEFAULT 0 NOT NULL,
	"otkljucan_at" timestamp with time zone,
	CONSTRAINT "dnk_statistike_igraca_igrac_id_mod_pk" PRIMARY KEY("igrac_id","mod")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dostignuca_igraca" (
	"igrac_id" uuid NOT NULL,
	"dostignuce_id" text NOT NULL,
	"razina" smallint DEFAULT 0 NOT NULL,
	"prvo_otkljucano" timestamp with time zone,
	"zadnje_otkljucavanje" timestamp with time zone,
	CONSTRAINT "dostignuca_igraca_igrac_id_dostignuce_id_pk" PRIMARY KEY("igrac_id","dostignuce_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "napredak_dostignuca_igraca" (
	"igrac_id" uuid NOT NULL,
	"valjani_potezi_ukupno" integer DEFAULT 0 NOT NULL,
	"rang" integer DEFAULT 0 NOT NULL,
	"rijetke_leksemske_grupe" integer DEFAULT 0 NOT NULL,
	"duge_rijeci" integer DEFAULT 0 NOT NULL,
	"najduzi_streak" integer DEFAULT 0 NOT NULL,
	"kaladont_izvedbe" integer DEFAULT 0 NOT NULL,
	"kaladont_zrtve" integer DEFAULT 0 NOT NULL,
	"izazvane_eliminacije" integer DEFAULT 0 NOT NULL,
	"mrtva_slova_eliminacije" integer DEFAULT 0 NOT NULL,
	"javne_pobjede" integer DEFAULT 0 NOT NULL,
	"azurirano" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "napredak_dostignuca_igraca_igrac_id_pk" PRIMARY KEY("igrac_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sesije" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"igrac_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"stvorena" timestamp with time zone DEFAULT now() NOT NULL,
	"istek" timestamp with time zone NOT NULL,
	CONSTRAINT "sesije_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dnk_statistike_igraca" ADD CONSTRAINT "dnk_statistike_igraca_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dostignuca_igraca" ADD CONSTRAINT "dostignuca_igraca_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "napredak_dostignuca_igraca" ADD CONSTRAINT "napredak_dostignuca_igraca_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sesije" ADD CONSTRAINT "sesije_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sesije_igrac_id" ON "sesije" USING btree ("igrac_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sesije_istek" ON "sesije" USING btree ("istek");