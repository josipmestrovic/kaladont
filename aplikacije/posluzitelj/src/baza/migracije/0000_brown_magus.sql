CREATE TYPE "public"."akcija_izmjene_rjecnika" AS ENUM('dodana', 'uklonjena', 'vracena');--> statement-breakpoint
CREATE TYPE "public"."nacin_ispadanja" AS ENUM('ne_znam', 'istek', 'mrtva_slova', 'prekid', 'pobjednik');--> statement-breakpoint
CREATE TYPE "public"."status_partije" AS ENUM('u_tijeku', 'zavrsena', 'ponistena');--> statement-breakpoint
CREATE TYPE "public"."status_prijave" AS ENUM('nova', 'pregledana', 'rijesena');--> statement-breakpoint
CREATE TYPE "public"."vrsta_igraca" AS ENUM('gost', 'registriran', 'admin');--> statement-breakpoint
CREATE TYPE "public"."vrsta_poteza" AS ENUM('rijec', 'ne_znam', 'istek', 'prekid', 'auto_kraj');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "igraci" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vrsta" "vrsta_igraca" DEFAULT 'gost' NOT NULL,
	"nadimak" text NOT NULL,
	"email" text,
	"lozinka_hash" text,
	"email_potvrdjen" boolean DEFAULT false NOT NULL,
	"odigrane" integer DEFAULT 0 NOT NULL,
	"pobjede" integer DEFAULT 0 NOT NULL,
	"eliminacije_ukupno" integer DEFAULT 0 NOT NULL,
	"bodovi_ukupno" integer DEFAULT 0 NOT NULL,
	"stvoren" timestamp with time zone DEFAULT now() NOT NULL,
	"zadnja_aktivnost" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "izmjene_rjecnika" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "izmjene_rjecnika_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"rijec" text NOT NULL,
	"akcija" "akcija_izmjene_rjecnika" NOT NULL,
	"razlog" text NOT NULL,
	"prijava_id" integer,
	"admin_id" uuid,
	"vrijeme" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "partije" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pocetak" timestamp with time zone DEFAULT now() NOT NULL,
	"kraj" timestamp with time zone,
	"status" "status_partije" DEFAULT 'u_tijeku' NOT NULL,
	"pobjednik_id" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "potezi" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "potezi_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"partija_id" uuid NOT NULL,
	"runda" smallint NOT NULL,
	"redni_broj" smallint NOT NULL,
	"igrac_id" uuid NOT NULL,
	"vrsta" "vrsta_poteza" NOT NULL,
	"rijec" text,
	"trazena_slova" text,
	"trajanje_ms" integer DEFAULT 0 NOT NULL,
	"vrijeme" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "prijave" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "prijave_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"partija_id" uuid NOT NULL,
	"potez_id" bigint,
	"igrac_id" uuid NOT NULL,
	"poruka" text NOT NULL,
	"status" "status_prijave" DEFAULT 'nova' NOT NULL,
	"vrijeme" timestamp with time zone DEFAULT now() NOT NULL,
	"rijesio_id" uuid,
	"napomena_admina" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rijeci" (
	"rijec" text PRIMARY KEY NOT NULL,
	"prva_dva" text NOT NULL,
	"zadnja_dva" text NOT NULL,
	"frekvencija" integer DEFAULT 0 NOT NULL,
	"aktivna" boolean DEFAULT true NOT NULL,
	"dodana" timestamp with time zone DEFAULT now() NOT NULL,
	"napomena" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sudionici_partije" (
	"partija_id" uuid NOT NULL,
	"igrac_id" uuid NOT NULL,
	"sjedalo" smallint NOT NULL,
	"plasman" smallint,
	"bodovi" smallint DEFAULT 0 NOT NULL,
	"eliminacije" smallint DEFAULT 0 NOT NULL,
	"nacin_ispadanja" "nacin_ispadanja",
	"cekanje_ms" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "sudionici_partije_partija_id_igrac_id_pk" PRIMARY KEY("partija_id","igrac_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "izmjene_rjecnika" ADD CONSTRAINT "izmjene_rjecnika_prijava_id_prijave_id_fk" FOREIGN KEY ("prijava_id") REFERENCES "public"."prijave"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "izmjene_rjecnika" ADD CONSTRAINT "izmjene_rjecnika_admin_id_igraci_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."igraci"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "partije" ADD CONSTRAINT "partije_pobjednik_id_igraci_id_fk" FOREIGN KEY ("pobjednik_id") REFERENCES "public"."igraci"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "potezi" ADD CONSTRAINT "potezi_partija_id_partije_id_fk" FOREIGN KEY ("partija_id") REFERENCES "public"."partije"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "potezi" ADD CONSTRAINT "potezi_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prijave" ADD CONSTRAINT "prijave_partija_id_partije_id_fk" FOREIGN KEY ("partija_id") REFERENCES "public"."partije"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prijave" ADD CONSTRAINT "prijave_potez_id_potezi_id_fk" FOREIGN KEY ("potez_id") REFERENCES "public"."potezi"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prijave" ADD CONSTRAINT "prijave_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prijave" ADD CONSTRAINT "prijave_rijesio_id_igraci_id_fk" FOREIGN KEY ("rijesio_id") REFERENCES "public"."igraci"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sudionici_partije" ADD CONSTRAINT "sudionici_partije_partija_id_partije_id_fk" FOREIGN KEY ("partija_id") REFERENCES "public"."partije"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sudionici_partije" ADD CONSTRAINT "sudionici_partije_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
