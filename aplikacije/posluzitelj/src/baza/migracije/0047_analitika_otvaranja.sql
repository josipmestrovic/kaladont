CREATE TYPE "public"."kontekst_analitike" AS ENUM('javna', 'privatna', 'trening');--> statement-breakpoint
CREATE TYPE "public"."izvor_pocetne_analitike" AS ENUM('sigurni_skup', 'rezervni_odabir', 'nema_kandidata');--> statement-breakpoint
CREATE TYPE "public"."status_otvaranja_analitike" AS ENUM('otvoren', 'dva_odgovora_ok', 'rani_incident', 'zatvoren_drugim', 'nepotpuno');--> statement-breakpoint
CREATE TYPE "public"."upravljac_analitike" AS ENUM('covjek', 'bot');--> statement-breakpoint
CREATE TABLE "analitika_otvaranja" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"igra_id" uuid NOT NULL,
	"redni_broj_otvaranja" integer NOT NULL,
	"kontekst" "kontekst_analitike" NOT NULL,
	"mod" "mod_partije" NOT NULL,
	"broj_sudionika" smallint NOT NULL,
	"sustavska_rijec" text,
	"izvor" "izvor_pocetne_analitike" NOT NULL,
	"broj_odgovora" smallint DEFAULT 0 NOT NULL,
	"odgovor_1" text,
	"odgovor_2" text,
	"status" "status_otvaranja_analitike" DEFAULT 'otvoren' NOT NULL,
	"incident_pozicija" smallint,
	"incident_rijec_uzrok" text,
	"incident_razlog" text,
	"incident_autor_upravljac" "upravljac_analitike",
	"incident_zrtva_upravljac" "upravljac_analitike",
	"dodijeljeno_u" timestamp with time zone NOT NULL,
	"zatvoreno_u" timestamp with time zone,
	"verzija_aplikacije" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_analitika_otvaranja_igra_redni" ON "analitika_otvaranja" USING btree ("igra_id","redni_broj_otvaranja");--> statement-breakpoint
CREATE INDEX "idx_analitika_otvaranja_dodijeljeno" ON "analitika_otvaranja" USING btree ("dodijeljeno_u","kontekst");--> statement-breakpoint
CREATE INDEX "idx_analitika_otvaranja_status" ON "analitika_otvaranja" USING btree ("status","dodijeljeno_u");--> statement-breakpoint
ALTER TABLE "analitika_otvaranja" ADD CONSTRAINT "chk_analitika_otvaranja_broj_odgovora" CHECK ("broj_odgovora" >= 0 and "broj_odgovora" <= 2);--> statement-breakpoint
ALTER TABLE "analitika_otvaranja" ADD CONSTRAINT "chk_analitika_otvaranja_incident_pozicija" CHECK ("incident_pozicija" is null or "incident_pozicija" in (1, 2));
