ALTER TABLE "napredak_dostignuca_igraca" ADD COLUMN "dvostruke_krune" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "napredak_dostignuca_igraca" ADD COLUMN "ciste_petice" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "napredak_dostignuca_igraca" ADD COLUMN "sve_pohvale" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "napredak_dostignuca_igraca" ADD COLUMN "rijetke_grdosije" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "sudionici_partije" ADD COLUMN "pogresni_unosi" integer;
--> statement-breakpoint
ALTER TABLE "sudionici_partije" ADD CONSTRAINT "chk_sudionici_pogresni_unosi" CHECK ("pogresni_unosi" is null or "pogresni_unosi" >= 0);
--> statement-breakpoint
CREATE TABLE "evidencija_dnevnih_pobjeda_modova" (
	"igrac_id" uuid NOT NULL,
	"lokalni_datum" date NOT NULL,
	"mod" "mod_partije" NOT NULL,
	CONSTRAINT "evidencija_dnevnih_pobjeda_modova_igrac_id_lokalni_datum_mod_pk" PRIMARY KEY("igrac_id","lokalni_datum","mod")
);
--> statement-breakpoint
CREATE TABLE "dokazi_dostignuca_dvostruka_kruna" (
	"igrac_id" uuid NOT NULL,
	"lokalni_datum" date NOT NULL,
	CONSTRAINT "dokazi_dostignuca_dvostruka_kruna_igrac_id_lokalni_datum_pk" PRIMARY KEY("igrac_id","lokalni_datum")
);
--> statement-breakpoint
CREATE TABLE "dokazi_dostignuca_cista_petica" (
	"igrac_id" uuid NOT NULL,
	"partija_id" uuid NOT NULL,
	CONSTRAINT "dokazi_dostignuca_cista_petica_igrac_id_partija_id_pk" PRIMARY KEY("igrac_id","partija_id")
);
--> statement-breakpoint
CREATE TABLE "dokazi_dostignuca_sve_pohvale" (
	"igrac_id" uuid NOT NULL,
	"partija_id" uuid NOT NULL,
	CONSTRAINT "dokazi_dostignuca_sve_pohvale_igrac_id_partija_id_pk" PRIMARY KEY("igrac_id","partija_id")
);
--> statement-breakpoint
CREATE TABLE "dokazi_dostignuca_rijetka_grdosija" (
	"igrac_id" uuid NOT NULL,
	"normalizirani_oblik" text NOT NULL,
	CONSTRAINT "dokazi_dostignuca_rijetka_grdosija_igrac_id_normalizirani_oblik_pk" PRIMARY KEY("igrac_id","normalizirani_oblik")
);
--> statement-breakpoint
ALTER TABLE "evidencija_dnevnih_pobjeda_modova" ADD CONSTRAINT "evidencija_dnevnih_pobjeda_modova_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dokazi_dostignuca_dvostruka_kruna" ADD CONSTRAINT "dokazi_dostignuca_dvostruka_kruna_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dokazi_dostignuca_cista_petica" ADD CONSTRAINT "dokazi_dostignuca_cista_petica_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dokazi_dostignuca_cista_petica" ADD CONSTRAINT "dokazi_dostignuca_cista_petica_partija_id_partije_id_fk" FOREIGN KEY ("partija_id") REFERENCES "public"."partije"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dokazi_dostignuca_sve_pohvale" ADD CONSTRAINT "dokazi_dostignuca_sve_pohvale_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dokazi_dostignuca_sve_pohvale" ADD CONSTRAINT "dokazi_dostignuca_sve_pohvale_partija_id_partije_id_fk" FOREIGN KEY ("partija_id") REFERENCES "public"."partije"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dokazi_dostignuca_rijetka_grdosija" ADD CONSTRAINT "dokazi_dostignuca_rijetka_grdosija_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE cascade ON UPDATE no action;
