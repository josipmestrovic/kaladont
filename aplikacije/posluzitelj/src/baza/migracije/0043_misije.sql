CREATE TYPE "public"."vrsta_misije" AS ENUM('dnevna', 'tjedna');--> statement-breakpoint
CREATE TYPE "public"."status_dodjele_misije" AS ENUM('aktivna', 'dovrsena', 'zamijenjena', 'istekla');--> statement-breakpoint
CREATE TYPE "public"."status_dotoka_dnevne_misije" AS ENUM('dodijeljeno', 'preskoceno');--> statement-breakpoint
CREATE TYPE "public"."kontekst_izvora_misije" AS ENUM('javna', 'trening');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stanje_misija_igraca" (
	"igrac_id" uuid PRIMARY KEY NOT NULL,
	"inicijalizirano_u" timestamp with time zone NOT NULL,
	"zadnji_obradeni_dnevni_datum" date NOT NULL,
	"verzija_stanja" integer DEFAULT 1 NOT NULL,
	"zadnji_pregled_dnevnih_u" timestamp with time zone,
	"zadnji_pregled_tjednih_u" timestamp with time zone
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dotok_dnevnih_misija" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"igrac_id" uuid NOT NULL,
	"lokalni_datum" date NOT NULL,
	"status" "status_dotoka_dnevne_misije" NOT NULL,
	"stvoreno_u" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ciklusi_tjednih_misija" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"igrac_id" uuid NOT NULL,
	"period_od" timestamp with time zone NOT NULL,
	"period_do" timestamp with time zone NOT NULL,
	"stvoreno_u" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_ciklusi_tjednih_period" CHECK ("period_od" < "period_do")
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dodjele_misija" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"igrac_id" uuid NOT NULL,
	"vrsta" "vrsta_misije" NOT NULL,
	"slot" smallint NOT NULL,
	"ciklus_id" uuid,
	"predlozak_id" text NOT NULL,
	"verzija_definicije" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"napredak" integer DEFAULT 0 NOT NULL,
	"cilj" integer NOT NULL,
	"podstanje" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "status_dodjele_misije" DEFAULT 'aktivna' NOT NULL,
	"dostupna_od" timestamp with time zone NOT NULL,
	"zavrsena_u" timestamp with time zone,
	"istjece_u" timestamp with time zone,
	"stvoreno_u" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_dodjele_misija_slot" CHECK ("slot" between 1 and 3),
	CONSTRAINT "chk_dodjele_misija_napredak" CHECK ("napredak" >= 0 and "napredak" <= "cilj"),
	CONSTRAINT "chk_dodjele_misija_cilj" CHECK ("cilj" > 0),
	CONSTRAINT "chk_dodjele_misija_dnevni_istek" CHECK (("vrsta" = 'dnevna' and "istjece_u" is null) or "vrsta" = 'tjedna'),
	CONSTRAINT "chk_dodjele_misija_tjedni_ciklus" CHECK (("vrsta" = 'tjedna' and "ciklus_id" is not null) or ("vrsta" = 'dnevna' and "ciklus_id" is null))
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "zamjene_misija" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"igrac_id" uuid NOT NULL,
	"vrsta" "vrsta_misije" NOT NULL,
	"zagrebacki_datum" date NOT NULL,
	"stara_dodjela_id" uuid NOT NULL,
	"nova_dodjela_id" uuid NOT NULL,
	"idempotency_key" text NOT NULL,
	"stvoreno_u" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "doprinosi_misijama" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dodjela_id" uuid NOT NULL,
	"igrac_id" uuid NOT NULL,
	"kontekst_izvora" "kontekst_izvora_misije" NOT NULL,
	"izvor_id" uuid NOT NULL,
	"delta" jsonb NOT NULL,
	"stvoreno_u" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "nagrade_misija" (
	"dodjela_id" uuid PRIMARY KEY NOT NULL,
	"igrac_id" uuid NOT NULL,
	"xp_nominalno" integer NOT NULL,
	"xp_stvarno" integer NOT NULL,
	"kontekst_izvora" "kontekst_izvora_misije" NOT NULL,
	"izvor_id" uuid NOT NULL,
	"dodijeljena_u" timestamp with time zone NOT NULL,
	CONSTRAINT "chk_nagrade_misija_xp" CHECK ("xp_nominalno" >= 0 and "xp_stvarno" >= 0 and "xp_stvarno" <= "xp_nominalno")
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ishodi_misija_igara" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"igrac_id" uuid NOT NULL,
	"kontekst_izvora" "kontekst_izvora_misije" NOT NULL,
	"izvor_id" uuid NOT NULL,
	"zavrseno_u" timestamp with time zone NOT NULL,
	"payload" jsonb NOT NULL,
	"stvoreno_u" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stanje_misija_igraca" ADD CONSTRAINT "stanje_misija_igraca_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dotok_dnevnih_misija" ADD CONSTRAINT "dotok_dnevnih_misija_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ciklusi_tjednih_misija" ADD CONSTRAINT "ciklusi_tjednih_misija_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dodjele_misija" ADD CONSTRAINT "dodjele_misija_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dodjele_misija" ADD CONSTRAINT "dodjele_misija_ciklus_id_ciklusi_tjednih_misija_id_fk" FOREIGN KEY ("ciklus_id") REFERENCES "public"."ciklusi_tjednih_misija"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "zamjene_misija" ADD CONSTRAINT "zamjene_misija_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "zamjene_misija" ADD CONSTRAINT "zamjene_misija_stara_dodjela_id_dodjele_misija_id_fk" FOREIGN KEY ("stara_dodjela_id") REFERENCES "public"."dodjele_misija"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "zamjene_misija" ADD CONSTRAINT "zamjene_misija_nova_dodjela_id_dodjele_misija_id_fk" FOREIGN KEY ("nova_dodjela_id") REFERENCES "public"."dodjele_misija"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "doprinosi_misijama" ADD CONSTRAINT "doprinosi_misijama_dodjela_id_dodjele_misija_id_fk" FOREIGN KEY ("dodjela_id") REFERENCES "public"."dodjele_misija"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "doprinosi_misijama" ADD CONSTRAINT "doprinosi_misijama_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "nagrade_misija" ADD CONSTRAINT "nagrade_misija_dodjela_id_dodjele_misija_id_fk" FOREIGN KEY ("dodjela_id") REFERENCES "public"."dodjele_misija"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "nagrade_misija" ADD CONSTRAINT "nagrade_misija_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ishodi_misija_igara" ADD CONSTRAINT "ishodi_misija_igara_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_dotok_dnevnih_misija_igrac_datum" ON "dotok_dnevnih_misija" USING btree ("igrac_id","lokalni_datum");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_ciklusi_tjednih_misija_igrac_period" ON "ciklusi_tjednih_misija" USING btree ("igrac_id","period_od");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_dodjele_dnevna_aktivna_slot" ON "dodjele_misija" USING btree ("igrac_id","slot") WHERE "vrsta" = 'dnevna' and "status" = 'aktivna';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_dodjele_tjedna_trenutna_slot" ON "dodjele_misija" USING btree ("ciklus_id","slot") WHERE "vrsta" = 'tjedna' and "status" in ('aktivna', 'dovrsena');--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_dodjele_dnevna_aktivna_predlozak" ON "dodjele_misija" USING btree ("igrac_id","predlozak_id") WHERE "vrsta" = 'dnevna' and "status" = 'aktivna';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_dodjele_tjedna_ciklus_predlozak" ON "dodjele_misija" USING btree ("ciklus_id","predlozak_id") WHERE "vrsta" = 'tjedna' and "status" in ('aktivna', 'dovrsena', 'zamijenjena');--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_dodjele_misija_igrac_vrsta_status" ON "dodjele_misija" USING btree ("igrac_id","vrsta","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_zamjene_misija_kvota" ON "zamjene_misija" USING btree ("igrac_id","vrsta","zagrebacki_datum");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_zamjene_misija_idempotency" ON "zamjene_misija" USING btree ("igrac_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_doprinosi_misijama_dodjela_izvor" ON "doprinosi_misijama" USING btree ("dodjela_id","kontekst_izvora","izvor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_doprinosi_misijama_izvor" ON "doprinosi_misijama" USING btree ("igrac_id","kontekst_izvora","izvor_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_nagrade_misija_igrac" ON "nagrade_misija" USING btree ("igrac_id","dodijeljena_u");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_ishodi_misija_igara_izvor" ON "ishodi_misija_igara" USING btree ("igrac_id","kontekst_izvora","izvor_id");
