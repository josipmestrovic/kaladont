INSERT INTO "statistike_rijeci_igraca" (
  "igrac_id", "mod", "najduzi_streak",
  "otkrivene_jako_rijetke_grupe", "otkrivene_srednje_rijetke_grupe", "otkrivene_rijetke_grupe",
  "upisane_duge_rijeci", "upisane_srednje_duge_rijeci", "upisane_jako_duge_rijeci",
  "najduza_rijec", "najduza_rijec_grafemi", "najrjeda_rijec", "najrjeda_rijec_frekvencija", "najrjeda_tier"
)
SELECT
  "igrac_id", 'cetiri_igraca', "najduzi_streak",
  "otkrivene_jako_rijetke_grupe", "otkrivene_srednje_rijetke_grupe", "otkrivene_rijetke_grupe",
  "upisane_duge_rijeci", "upisane_srednje_duge_rijeci", "upisane_jako_duge_rijeci",
  "najduza_rijec", "najduza_rijec_grafemi", "najrjeda_rijec", "najrjeda_rijec_frekvencija", "najrjeda_tier"
FROM "statistike_rijeci_igraca"
WHERE "mod" = 'dva_igraca'
ON CONFLICT ("igrac_id", "mod") DO UPDATE SET
  "najduzi_streak" = greatest("statistike_rijeci_igraca"."najduzi_streak", excluded."najduzi_streak"),
  "otkrivene_jako_rijetke_grupe" = "statistike_rijeci_igraca"."otkrivene_jako_rijetke_grupe" + excluded."otkrivene_jako_rijetke_grupe",
  "otkrivene_srednje_rijetke_grupe" = "statistike_rijeci_igraca"."otkrivene_srednje_rijetke_grupe" + excluded."otkrivene_srednje_rijetke_grupe",
  "otkrivene_rijetke_grupe" = "statistike_rijeci_igraca"."otkrivene_rijetke_grupe" + excluded."otkrivene_rijetke_grupe",
  "upisane_duge_rijeci" = "statistike_rijeci_igraca"."upisane_duge_rijeci" + excluded."upisane_duge_rijeci",
  "upisane_srednje_duge_rijeci" = "statistike_rijeci_igraca"."upisane_srednje_duge_rijeci" + excluded."upisane_srednje_duge_rijeci",
  "upisane_jako_duge_rijeci" = "statistike_rijeci_igraca"."upisane_jako_duge_rijeci" + excluded."upisane_jako_duge_rijeci",
  "najduza_rijec" = CASE WHEN excluded."najduza_rijec_grafemi" > "statistike_rijeci_igraca"."najduza_rijec_grafemi" THEN excluded."najduza_rijec" ELSE "statistike_rijeci_igraca"."najduza_rijec" END,
  "najduza_rijec_grafemi" = greatest("statistike_rijeci_igraca"."najduza_rijec_grafemi", excluded."najduza_rijec_grafemi"),
  "najrjeda_rijec" = CASE WHEN excluded."najrjeda_tier" IS NOT NULL AND ("statistike_rijeci_igraca"."najrjeda_tier" IS NULL OR excluded."najrjeda_tier" <= "statistike_rijeci_igraca"."najrjeda_tier") THEN excluded."najrjeda_rijec" ELSE "statistike_rijeci_igraca"."najrjeda_rijec" END,
  "najrjeda_rijec_frekvencija" = CASE WHEN excluded."najrjeda_tier" IS NOT NULL AND ("statistike_rijeci_igraca"."najrjeda_tier" IS NULL OR excluded."najrjeda_tier" <= "statistike_rijeci_igraca"."najrjeda_tier") THEN excluded."najrjeda_rijec_frekvencija" ELSE "statistike_rijeci_igraca"."najrjeda_rijec_frekvencija" END,
  "najrjeda_tier" = CASE WHEN excluded."najrjeda_tier" IS NOT NULL AND ("statistike_rijeci_igraca"."najrjeda_tier" IS NULL OR excluded."najrjeda_tier" <= "statistike_rijeci_igraca"."najrjeda_tier") THEN excluded."najrjeda_tier" ELSE "statistike_rijeci_igraca"."najrjeda_tier" END;
--> statement-breakpoint
DELETE FROM "statistike_rijeci_igraca" WHERE "mod" = 'dva_igraca';