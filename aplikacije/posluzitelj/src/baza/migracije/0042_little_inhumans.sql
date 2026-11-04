CREATE TYPE "public"."vrsta_pohvale_igre" AS ENUM('najduzi_niz', 'najvise_xp');--> statement-breakpoint
CREATE TABLE "pohvale_igre" (
	"igra_id" uuid NOT NULL,
	"igrac_id" uuid NOT NULL,
	"vrsta" "vrsta_pohvale_igre" NOT NULL,
	"vrijednost" integer NOT NULL,
	"stvoreno" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pohvale_igre_igra_id_igrac_id_vrsta_pk" PRIMARY KEY("igra_id","igrac_id","vrsta")
);
--> statement-breakpoint
ALTER TABLE "napredak_dostignuca_igraca" ADD COLUMN "pohvale_niz_ukupno" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "napredak_dostignuca_igraca" ADD COLUMN "pohvale_xp_ukupno" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "pohvale_igre" ADD CONSTRAINT "pohvale_igre_igra_id_partije_id_fk" FOREIGN KEY ("igra_id") REFERENCES "public"."partije"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pohvale_igre" ADD CONSTRAINT "pohvale_igre_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_pohvale_igre_igrac" ON "pohvale_igre" USING btree ("igrac_id","stvoreno");