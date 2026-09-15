ALTER TABLE "dnk_statistike_igraca"
  ADD COLUMN IF NOT EXISTS "zbroj_ocjena_igre" integer DEFAULT 0 NOT NULL;
ALTER TABLE "dnk_statistike_igraca"
  ADD COLUMN IF NOT EXISTS "broj_ocjena_igre" integer DEFAULT 0 NOT NULL;
