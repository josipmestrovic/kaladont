CREATE TABLE IF NOT EXISTS "pobjede_treninga" (
	"trening_id" uuid PRIMARY KEY NOT NULL,
	"igrac_id" uuid NOT NULL,
	"zavrseno" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trening_rijeci_igraca" (
	"igrac_id" uuid NOT NULL,
	"rijec" text NOT NULL,
	"prvo_trening_id" uuid NOT NULL,
	"otkljucano" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trening_rijeci_igraca_igrac_id_rijec_pk" PRIMARY KEY("igrac_id","rijec")
);
--> statement-breakpoint
ALTER TABLE "napredak_dostignuca_igraca" ADD COLUMN "trening_pobjede" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "otkljucane_grupe_igraca" ADD COLUMN "za_dostignuca" boolean DEFAULT true NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pobjede_treninga" ADD CONSTRAINT "pobjede_treninga_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trening_rijeci_igraca" ADD CONSTRAINT "trening_rijeci_igraca_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_pobjede_treninga_igrac_id" ON "pobjede_treninga" USING btree ("igrac_id","zavrseno");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_trening_rijeci_igraca_rijec" ON "trening_rijeci_igraca" USING btree ("igrac_id","rijec");