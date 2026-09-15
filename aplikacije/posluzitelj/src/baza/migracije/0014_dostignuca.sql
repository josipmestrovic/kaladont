CREATE TABLE IF NOT EXISTS "napredak_dostignuca_igraca" (
  "igrac_id" uuid PRIMARY KEY NOT NULL,
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
  "azurirano" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dostignuca_igraca" (
  "igrac_id" uuid NOT NULL,
  "dostignuce_id" text NOT NULL,
  "razina" smallint DEFAULT 0 NOT NULL,
  "prvo_otkljucano" timestamp with time zone,
  "zadnje_otkljucavanje" timestamp with time zone,
  CONSTRAINT "dostignuca_igraca_igrac_id_dostignuce_id_pk" PRIMARY KEY("igrac_id", "dostignuce_id")
);
--> statement-breakpoint
ALTER TABLE "napredak_dostignuca_igraca" ADD CONSTRAINT "napredak_dostignuca_igraca_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dostignuca_igraca" ADD CONSTRAINT "dostignuca_igraca_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE cascade ON UPDATE no action;