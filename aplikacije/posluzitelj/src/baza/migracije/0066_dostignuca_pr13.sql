-- HINT PR13: nova dostignuća kreću od novih događaja; nema backfilla pobjeda/dokaza iz povijesti.
ALTER TABLE "napredak_dostignuca_igraca" ADD COLUMN "troboj_pobjede" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "napredak_dostignuca_igraca" ADD COLUMN "igre_s_dokazom" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "napredak_dostignuca_igraca" ADD COLUMN "kaladont_sljedeci" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "napredak_dostignuca_igraca" ADD COLUMN "stara_skola_pobjede" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE "dokazi_dostignuca_treca_sreca" (
	"igrac_id" uuid NOT NULL,
	"partija_id" uuid NOT NULL,
	CONSTRAINT "dokazi_dostignuca_treca_sreca_pk" PRIMARY KEY("igrac_id","partija_id")
);
--> statement-breakpoint
CREATE TABLE "dokazi_dostignuca_imam_nastavak" (
	"igrac_id" uuid NOT NULL,
	"partija_id" uuid NOT NULL,
	CONSTRAINT "dokazi_dostignuca_imam_nastavak_pk" PRIMARY KEY("igrac_id","partija_id")
);
--> statement-breakpoint
-- HINT: više događaja po igri — PK uključuje redni_broj iz ucinak_posebne_rijeci.
CREATE TABLE "dokazi_dostignuca_salji_dalje" (
	"igrac_id" uuid NOT NULL,
	"partija_id" uuid NOT NULL,
	"redni_broj" smallint NOT NULL,
	CONSTRAINT "dokazi_dostignuca_salji_dalje_pk" PRIMARY KEY("igrac_id","partija_id","redni_broj")
);
--> statement-breakpoint
CREATE TABLE "dokazi_dostignuca_stara_skola" (
	"igrac_id" uuid NOT NULL,
	"partija_id" uuid NOT NULL,
	CONSTRAINT "dokazi_dostignuca_stara_skola_pk" PRIMARY KEY("igrac_id","partija_id")
);
--> statement-breakpoint
ALTER TABLE "dokazi_dostignuca_treca_sreca" ADD CONSTRAINT "dokazi_treca_sreca_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dokazi_dostignuca_treca_sreca" ADD CONSTRAINT "dokazi_treca_sreca_partija_id_partije_id_fk" FOREIGN KEY ("partija_id") REFERENCES "public"."partije"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dokazi_dostignuca_imam_nastavak" ADD CONSTRAINT "dokazi_imam_nastavak_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dokazi_dostignuca_imam_nastavak" ADD CONSTRAINT "dokazi_imam_nastavak_partija_id_partije_id_fk" FOREIGN KEY ("partija_id") REFERENCES "public"."partije"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dokazi_dostignuca_salji_dalje" ADD CONSTRAINT "dokazi_salji_dalje_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dokazi_dostignuca_salji_dalje" ADD CONSTRAINT "dokazi_salji_dalje_partija_id_partije_id_fk" FOREIGN KEY ("partija_id") REFERENCES "public"."partije"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dokazi_dostignuca_stara_skola" ADD CONSTRAINT "dokazi_stara_skola_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dokazi_dostignuca_stara_skola" ADD CONSTRAINT "dokazi_stara_skola_partija_id_partije_id_fk" FOREIGN KEY ("partija_id") REFERENCES "public"."partije"("id") ON DELETE cascade ON UPDATE no action;
