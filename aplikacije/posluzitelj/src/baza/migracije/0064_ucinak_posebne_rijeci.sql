CREATE TYPE "public"."vrsta_mete_posebne_rijeci" AS ENUM('prethodni', 'sljedeci');
--> statement-breakpoint
CREATE TYPE "public"."ishod_ucinak_posebne_rijeci" AS ENUM('eliminacija', 'bez_zrtve');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ucinak_posebne_rijeci" (
	"partija_id" uuid NOT NULL,
	"redni_broj" smallint NOT NULL,
	"rijec" text NOT NULL,
	"uzrocnik_id" uuid,
	"zrtva_id" uuid,
	"vrsta_mete" "vrsta_mete_posebne_rijeci",
	"broj_aktivnih_prije" smallint NOT NULL,
	"ucinak" "ishod_ucinak_posebne_rijeci" NOT NULL,
	"vrijeme" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ucinak_posebne_rijeci_partija_id_redni_broj_pk" PRIMARY KEY("partija_id","redni_broj"),
	CONSTRAINT "chk_ucinak_posebne_broj_aktivnih" CHECK ("broj_aktivnih_prije" >= 0)
);
--> statement-breakpoint
ALTER TABLE "ucinak_posebne_rijeci" ADD CONSTRAINT "ucinak_posebne_rijeci_partija_id_partije_id_fk" FOREIGN KEY ("partija_id") REFERENCES "public"."partije"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ucinak_posebne_rijeci" ADD CONSTRAINT "ucinak_posebne_rijeci_uzrocnik_id_igraci_id_fk" FOREIGN KEY ("uzrocnik_id") REFERENCES "public"."igraci"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ucinak_posebne_rijeci" ADD CONSTRAINT "ucinak_posebne_rijeci_zrtva_id_igraci_id_fk" FOREIGN KEY ("zrtva_id") REFERENCES "public"."igraci"("id") ON DELETE no action ON UPDATE no action;
