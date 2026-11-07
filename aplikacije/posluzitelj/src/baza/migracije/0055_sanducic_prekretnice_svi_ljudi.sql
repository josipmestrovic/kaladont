-- O7 / Bugbot: trening-only gosti i porazi nemaju red u partije/pobjede_treninga.
-- Označi prvu igru potrošenom za sve postojeće ljudske igrače; novi računi nakon ovoga i dalje mogu dobiti poruku.
INSERT INTO "sanducic_prekretnice" ("igrac_id", "kljuc", "ostvareno_at")
SELECT "id", 'prva_igra', now()
FROM "igraci"
WHERE "upravljac" = 'covjek'
ON CONFLICT DO NOTHING;
