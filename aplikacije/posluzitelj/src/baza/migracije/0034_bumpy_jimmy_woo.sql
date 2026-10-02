ALTER TABLE "sudionici_partije" ADD COLUMN "metrike_verzija" smallint;--> statement-breakpoint
ALTER TABLE "sudionici_partije" ADD COLUMN "prihvacene_rijeci" integer;--> statement-breakpoint
ALTER TABLE "sudionici_partije" ADD COLUMN "trajanje_prihvacenih_ms" bigint;--> statement-breakpoint
ALTER TABLE "sudionici_partije" ADD COLUMN "najduzi_niz_rijeci" integer;--> statement-breakpoint
ALTER TABLE "sudionici_partije" ADD COLUMN "najduza_rijec" text;--> statement-breakpoint
ALTER TABLE "sudionici_partije" ADD COLUMN "najduza_rijec_grafemi" integer;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_partije_zavrsene_mod_kraj" ON "partije" USING btree ("mod","kraj","id") WHERE "partije"."status" = 'zavrsena';--> statement-breakpoint
ALTER TABLE "sudionici_partije" ADD CONSTRAINT "chk_sudionici_metrike_v1" CHECK ("sudionici_partije"."metrike_verzija" is null or (
      "sudionici_partije"."metrike_verzija" = 1
      and "sudionici_partije"."prihvacene_rijeci" is not null
      and "sudionici_partije"."trajanje_prihvacenih_ms" is not null
      and "sudionici_partije"."najduzi_niz_rijeci" is not null
      and "sudionici_partije"."prihvacene_rijeci" >= 0
      and "sudionici_partije"."trajanje_prihvacenih_ms" >= 0
      and "sudionici_partije"."najduzi_niz_rijeci" >= 0
      and "sudionici_partije"."najduzi_niz_rijeci" <= "sudionici_partije"."prihvacene_rijeci"
      and (
        ("sudionici_partije"."prihvacene_rijeci" = 0 and "sudionici_partije"."trajanje_prihvacenih_ms" = 0 and "sudionici_partije"."najduzi_niz_rijeci" = 0
          and "sudionici_partije"."najduza_rijec" is null and "sudionici_partije"."najduza_rijec_grafemi" is null)
        or ("sudionici_partije"."prihvacene_rijeci" > 0 and "sudionici_partije"."najduzi_niz_rijeci" >= 1
          and "sudionici_partije"."najduza_rijec" is not null and "sudionici_partije"."najduza_rijec_grafemi" > 0)
      )
    ));