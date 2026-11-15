CREATE TYPE "public"."pravilnik_partije" AS ENUM('klasicni', 'ka_zna', 'dokazi_nastavak');--> statement-breakpoint
ALTER TABLE "partije" ADD COLUMN "pravila" "pravilnik_partije" DEFAULT 'ka_zna' NOT NULL;--> statement-breakpoint
ALTER TABLE "partije" ADD COLUMN "spojeni_dvoboj" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sudionici_partije" ADD COLUMN "odabrana_pravila" "pravilnik_partije" DEFAULT 'ka_zna' NOT NULL;
