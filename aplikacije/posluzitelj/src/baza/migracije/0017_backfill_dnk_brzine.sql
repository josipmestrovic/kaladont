INSERT INTO "dnk_statistike_igraca" (
  "igrac_id",
  "mod",
  "prihvaceni_potezi",
  "ukupno_trajanje_prihvacenih_poteza_ms"
)
SELECT
  sp."igrac_id",
  p."mod",
  COUNT(*)::integer,
  COALESCE(SUM(po."trajanje_ms"), 0)::integer
FROM "potezi" po
JOIN "partije" p ON p."id" = po."partija_id"
JOIN "sudionici_partije" sp ON sp."partija_id" = po."partija_id" AND sp."igrac_id" = po."igrac_id"
WHERE po."vrsta" = 'rijec'
  AND po."igrac_id" IS NOT NULL
GROUP BY sp."igrac_id", p."mod"
ON CONFLICT ("igrac_id", "mod") DO UPDATE SET
  "prihvaceni_potezi" = EXCLUDED."prihvaceni_potezi",
  "ukupno_trajanje_prihvacenih_poteza_ms" = EXCLUDED."ukupno_trajanje_prihvacenih_poteza_ms";
