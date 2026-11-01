CREATE TABLE IF NOT EXISTS "izmjene_botova" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "izmjene_botova_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"bot_id" uuid,
	"kljuc_seeda" text NOT NULL,
	"akcija" text NOT NULL,
	"aktivan_prije" boolean,
	"aktivan_poslije" boolean,
	"admin_id" uuid,
	"vrijeme" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "izmjene_botova_akcija_dopustena" CHECK ("izmjene_botova"."akcija" in ('stvoren', 'aktiviran', 'deaktiviran'))
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "izmjene_botova" ADD CONSTRAINT "izmjene_botova_bot_id_igraci_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."igraci"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "izmjene_botova" ADD CONSTRAINT "izmjene_botova_admin_id_igraci_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."igraci"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
