CREATE TABLE IF NOT EXISTS "osobni_rekordi_igraca" (
	"igrac_id" uuid PRIMARY KEY NOT NULL,
	"najduza_rijec" text,
	"najduza_rijec_grafemi" integer DEFAULT 0 NOT NULL,
	"najbrzi_prihvaceni_potez_ms" integer
);
--> statement-breakpoint
ALTER TABLE "osobni_rekordi_igraca" ADD CONSTRAINT "osobni_rekordi_igraca_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_otkljucane_grupe_igraca_nedavno" ON "otkljucane_grupe_igraca" USING btree ("igrac_id","otkljucano");
--> statement-breakpoint
INSERT INTO "osobni_rekordi_igraca" ("igrac_id", "najduza_rijec", "najduza_rijec_grafemi")
SELECT DISTINCT ON (s."igrac_id")
  s."igrac_id",
  s."najduza_rijec",
  s."najduza_rijec_grafemi"
FROM "statistike_rijeci_igraca" s
WHERE s."najduza_rijec_grafemi" > 0
ORDER BY s."igrac_id", s."najduza_rijec_grafemi" DESC, s."najduza_rijec" ASC NULLS LAST
ON CONFLICT ("igrac_id") DO UPDATE SET
  "najduza_rijec" = EXCLUDED."najduza_rijec",
  "najduza_rijec_grafemi" = EXCLUDED."najduza_rijec_grafemi";
--> statement-breakpoint
INSERT INTO "osobni_rekordi_igraca" ("igrac_id", "najbrzi_prihvaceni_potez_ms")
SELECT
  po."igrac_id",
  MIN(po."trajanje_ms")::integer
FROM "potezi" po
WHERE po."vrsta" = 'rijec'
  AND po."igrac_id" IS NOT NULL
  AND po."trajanje_ms" > 0
GROUP BY po."igrac_id"
ON CONFLICT ("igrac_id") DO UPDATE SET
  "najbrzi_prihvaceni_potez_ms" = CASE
    WHEN "osobni_rekordi_igraca"."najbrzi_prihvaceni_potez_ms" IS NULL THEN EXCLUDED."najbrzi_prihvaceni_potez_ms"
    ELSE LEAST("osobni_rekordi_igraca"."najbrzi_prihvaceni_potez_ms", EXCLUDED."najbrzi_prihvaceni_potez_ms")
  END;
