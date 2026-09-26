ALTER TABLE "sudionici_partije" ALTER COLUMN "nadimak" SET DEFAULT 'Gost';
--> statement-breakpoint
UPDATE "sudionici_partije" AS sudionik
SET "nadimak" = CASE WHEN igrac."vrsta" = 'gost' THEN 'Gost' ELSE igrac."nadimak" END
FROM "igraci" AS igrac
WHERE sudionik."igrac_id" = igrac."id"
	AND sudionik."nadimak" = 'Nepoznati igrač';