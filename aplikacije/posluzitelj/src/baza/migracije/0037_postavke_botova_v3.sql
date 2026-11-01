CREATE TABLE IF NOT EXISTS "izmjene_postavki_botova" (
	"revizija" integer PRIMARY KEY NOT NULL,
	"konfiguracija" jsonb NOT NULL,
	"admin_id" uuid,
	"vrijeme" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "postavke_botova" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"revizija" integer NOT NULL,
	"konfiguracija" jsonb NOT NULL,
	"azurirao_id" uuid,
	"azurirano" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "postavke_botova_jedan_zapis" CHECK ("postavke_botova"."id" = 1),
	CONSTRAINT "postavke_botova_pozitivna_revizija" CHECK ("postavke_botova"."revizija" > 0)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "izmjene_postavki_botova" ADD CONSTRAINT "izmjene_postavki_botova_admin_id_igraci_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."igraci"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "postavke_botova" ADD CONSTRAINT "postavke_botova_azurirao_id_igraci_id_fk" FOREIGN KEY ("azurirao_id") REFERENCES "public"."igraci"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
