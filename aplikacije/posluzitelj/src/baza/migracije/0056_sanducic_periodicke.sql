ALTER TABLE "igraci" ADD COLUMN "dovrsene_igre" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
-- Best-effort backfill: javne + privatne + trening pobjede. Trening porazi nisu rekonstruibilni (O7).
UPDATE "igraci" AS i
SET "dovrsene_igre" = COALESCE(i."odigrane", 0)
  + COALESCE(i."odigrane_1v1", 0)
  + COALESCE(n."privatne_igre", 0)
  + COALESCE(n."trening_pobjede", 0)
FROM "napredak_dostignuca_igraca" AS n
WHERE n."igrac_id" = i."id";
--> statement-breakpoint
UPDATE "igraci" AS i
SET "dovrsene_igre" = COALESCE(i."odigrane", 0) + COALESCE(i."odigrane_1v1", 0)
WHERE NOT EXISTS (
  SELECT 1 FROM "napredak_dostignuca_igraca" AS n WHERE n."igrac_id" = i."id"
);
--> statement-breakpoint
-- Baseline forma_10 po javnom modu (bez poplave starih poruka).
INSERT INTO "sanducic_prekretnice" ("igrac_id", "kljuc", "ostvareno_at")
SELECT i."id", 'forma_10:cetiri_igraca:' || (g.prag::text), now()
FROM "igraci" AS i
CROSS JOIN generate_series(10, GREATEST((i."odigrane" / 10) * 10, 0), 10) AS g(prag)
WHERE i."upravljac" = 'covjek' AND i."odigrane" >= 10
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "sanducic_prekretnice" ("igrac_id", "kljuc", "ostvareno_at")
SELECT i."id", 'forma_10:dva_igraca:' || (g.prag::text), now()
FROM "igraci" AS i
CROSS JOIN generate_series(10, GREATEST((i."odigrane_1v1" / 10) * 10, 0), 10) AS g(prag)
WHERE i."upravljac" = 'covjek' AND i."odigrane_1v1" >= 10
ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- Baseline gostujućih sažetaka za postojeće goste.
INSERT INTO "sanducic_prekretnice" ("igrac_id", "kljuc", "ostvareno_at")
SELECT i."id", 'gost_sazetak:' || (g.prag::text), now()
FROM "igraci" AS i
CROSS JOIN generate_series(5, GREATEST((i."dovrsene_igre" / 5) * 5, 0), 5) AS g(prag)
WHERE i."upravljac" = 'covjek' AND i."vrsta" = 'gost' AND i."dovrsene_igre" >= 5
ON CONFLICT DO NOTHING;
