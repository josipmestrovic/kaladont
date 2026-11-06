CREATE EXTENSION IF NOT EXISTS pgcrypto;
--> statement-breakpoint
ALTER TABLE "napredak_dostignuca_igraca" ADD COLUMN "dovrsene_misije" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "napredak_dostignuca_igraca" ADD COLUMN "privatne_igre" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "napredak_dostignuca_igraca" ADD COLUMN "tjedni_paketi" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE "dokazi_dostignuca_misija" (
	"igrac_id" uuid NOT NULL,
	"dodjela_id" uuid NOT NULL,
	CONSTRAINT "dokazi_dostignuca_misija_igrac_id_dodjela_id_pk" PRIMARY KEY("igrac_id","dodjela_id")
);
--> statement-breakpoint
CREATE TABLE "dokazi_dostignuca_privatnik" (
	"igrac_id" uuid NOT NULL,
	"partija_id" uuid NOT NULL,
	CONSTRAINT "dokazi_dostignuca_privatnik_igrac_id_partija_id_pk" PRIMARY KEY("igrac_id","partija_id")
);
--> statement-breakpoint
CREATE TABLE "dokazi_dostignuca_tjedni_paket" (
	"igrac_id" uuid NOT NULL,
	"ciklus_id" uuid NOT NULL,
	CONSTRAINT "dokazi_dostignuca_tjedni_paket_igrac_id_ciklus_id_pk" PRIMARY KEY("igrac_id","ciklus_id")
);
--> statement-breakpoint
CREATE TABLE "obavijesti_igraca" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"igrac_id" uuid NOT NULL,
	"vrsta" text NOT NULL,
	"dostignuce_id" text,
	"nova_razina" smallint,
	"maksimalna_razina" smallint,
	"izvor" text,
	"kontekst" jsonb,
	"stvoreno_u" timestamp with time zone DEFAULT now() NOT NULL,
	"prikazano_u" timestamp with time zone,
	CONSTRAINT "uq_obavijesti_igraca_dostignuce_razina" UNIQUE("igrac_id","dostignuce_id","nova_razina")
);
--> statement-breakpoint
ALTER TABLE "dokazi_dostignuca_misija" ADD CONSTRAINT "dokazi_dostignuca_misija_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dokazi_dostignuca_misija" ADD CONSTRAINT "dokazi_dostignuca_misija_dodjela_id_dodjele_misija_id_fk" FOREIGN KEY ("dodjela_id") REFERENCES "public"."dodjele_misija"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dokazi_dostignuca_privatnik" ADD CONSTRAINT "dokazi_dostignuca_privatnik_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dokazi_dostignuca_privatnik" ADD CONSTRAINT "dokazi_dostignuca_privatnik_partija_id_partije_id_fk" FOREIGN KEY ("partija_id") REFERENCES "public"."partije"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dokazi_dostignuca_tjedni_paket" ADD CONSTRAINT "dokazi_dostignuca_tjedni_paket_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dokazi_dostignuca_tjedni_paket" ADD CONSTRAINT "dokazi_dostignuca_tjedni_paket_ciklus_id_ciklusi_tjednih_misija_id_fk" FOREIGN KEY ("ciklus_id") REFERENCES "public"."ciklusi_tjednih_misija"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "obavijesti_igraca" ADD CONSTRAINT "obavijesti_igraca_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_obavijesti_igraca_neprikazane" ON "obavijesti_igraca" USING btree ("igrac_id") WHERE "prikazano_u" IS NULL;
