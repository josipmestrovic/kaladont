CREATE TABLE "sanducic_prekretnice" (
	"igrac_id" uuid NOT NULL,
	"kljuc" text NOT NULL,
	"ostvareno_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sanducic_prekretnice_igrac_id_kljuc_pk" PRIMARY KEY("igrac_id","kljuc")
);
--> statement-breakpoint
ALTER TABLE "sanducic_prekretnice" ADD CONSTRAINT "sanducic_prekretnice_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "sanducic_prekretnice" ("igrac_id", "kljuc", "ostvareno_at")
SELECT DISTINCT izvor.igrac_id, 'prva_igra', now()
FROM (
	SELECT "id" AS igrac_id FROM "igraci" WHERE "odigrane" > 0 OR "odigrane_1v1" > 0
	UNION
	SELECT DISTINCT "igrac_id" FROM "sudionici_partije" sp
		INNER JOIN "partije" p ON p."id" = sp."partija_id"
		WHERE p."status" = 'zavrsena'
	UNION
	SELECT DISTINCT "igrac_id" FROM "pobjede_treninga"
) AS izvor
ON CONFLICT DO NOTHING;
