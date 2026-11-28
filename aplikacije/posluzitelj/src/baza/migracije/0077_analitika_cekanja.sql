CREATE TYPE "public"."ishod_analitike_cekanja" AS ENUM('uparivanje', 'napustanje', 'prekid_veze', 'promjena_reda', 'uklonjen');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "analitika_cekanja" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kljuc_reda" text NOT NULL,
	"mod" "mod_partije" NOT NULL,
	"pravila" "pravilnik_partije" NOT NULL,
	"vrsta_racuna_na_pocetku" "vrsta_racuna_analitike" NOT NULL,
	"pocetak_u" timestamp with time zone NOT NULL,
	"kraj_u" timestamp with time zone NOT NULL,
	"ishod" "ishod_analitike_cekanja" NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_analitika_cekanja_kraj" ON "analitika_cekanja" USING btree ("kraj_u","ishod");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_analitika_cekanja_kraj_vrsta" ON "analitika_cekanja" USING btree ("kraj_u","vrsta_racuna_na_pocetku");
