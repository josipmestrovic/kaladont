CREATE TYPE "public"."ishod_analitike_igre" AS ENUM('zavrsena', 'prekinuta', 'nepotpuno');--> statement-breakpoint
CREATE TYPE "public"."vrsta_racuna_analitike" AS ENUM('gost', 'registriran');--> statement-breakpoint
CREATE TABLE "analitika_igre" (
	"igra_id" uuid PRIMARY KEY NOT NULL,
	"kontekst" "kontekst_analitike" NOT NULL,
	"mod" "mod_partije" NOT NULL,
	"pocetak_u" timestamp with time zone NOT NULL,
	"kraj_u" timestamp with time zone,
	"ishod" "ishod_analitike_igre"
);
--> statement-breakpoint
CREATE TABLE "analitika_sudjelovanja" (
	"igra_id" uuid NOT NULL,
	"igrac_id" uuid NOT NULL,
	"vrsta_racuna_na_pocetku" "vrsta_racuna_analitike" NOT NULL,
	CONSTRAINT "analitika_sudjelovanja_igra_id_igrac_id_pk" PRIMARY KEY("igra_id","igrac_id")
);
--> statement-breakpoint
ALTER TABLE "analitika_sudjelovanja" ADD CONSTRAINT "analitika_sudjelovanja_igra_id_analitika_igre_igra_id_fk" FOREIGN KEY ("igra_id") REFERENCES "public"."analitika_igre"("igra_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_analitika_igre_pocetak" ON "analitika_igre" USING btree ("pocetak_u","kontekst");--> statement-breakpoint
CREATE INDEX "idx_analitika_igre_kraj" ON "analitika_igre" USING btree ("kraj_u","ishod","kontekst");--> statement-breakpoint
CREATE INDEX "idx_analitika_sudjelovanja_igrac" ON "analitika_sudjelovanja" USING btree ("igrac_id");
