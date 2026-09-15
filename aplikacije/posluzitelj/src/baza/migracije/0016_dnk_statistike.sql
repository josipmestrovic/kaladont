CREATE TABLE IF NOT EXISTS "dnk_statistike_igraca" (
  "igrac_id" uuid NOT NULL REFERENCES "igraci"("id"),
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
  "otkljucan_at" timestamp with time zone,
  CONSTRAINT "dnk_statistike_igraca_igrac_id_mod_pk" PRIMARY KEY ("igrac_id", "mod")
);
