ALTER TABLE "napredak_dostignuca_igraca" ADD COLUMN "jezicni_detektivi" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "napredak_dostignuca_igraca" ADD COLUMN "cinkarosi" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "prijave" ADD COLUMN "potvrdena_akcija" text;
--> statement-breakpoint
ALTER TABLE "prijave" ADD COLUMN "izmjena_rjecnika_id" integer;
--> statement-breakpoint
ALTER TABLE "prijave_igraca" ADD COLUMN "potvrdena_akcija" text;
--> statement-breakpoint
ALTER TABLE "prijave_igraca" ADD COLUMN "potvrdeni_razlog" text;
--> statement-breakpoint
ALTER TABLE "prijave" ADD CONSTRAINT "chk_prijave_potvrdena_akcija" CHECK ("potvrdena_akcija" is null or "potvrdena_akcija" in ('dodana', 'reaktivirana', 'deaktivirana'));
--> statement-breakpoint
ALTER TABLE "prijave_igraca" ADD CONSTRAINT "chk_prijave_igraca_potvrdena_akcija" CHECK ("potvrdena_akcija" is null or "potvrdena_akcija" = 'soft_brisanje');
--> statement-breakpoint
ALTER TABLE "prijave_igraca" ADD CONSTRAINT "chk_prijave_igraca_potvrdeni_razlog" CHECK ("potvrdeni_razlog" is null or "potvrdeni_razlog" in ('pogrdan_nadimak', 'neprimjereno_ponasanje', 'drugo'));
--> statement-breakpoint
ALTER TABLE "prijave_igraca" ADD CONSTRAINT "chk_prijave_igraca_potvrda_par" CHECK (("potvrdena_akcija" is null and "potvrdeni_razlog" is null) or ("potvrdena_akcija" is not null and "potvrdeni_razlog" is not null));
--> statement-breakpoint
CREATE TABLE "dokazi_dostignuca_jezicni_detektiv" (
	"igrac_id" uuid NOT NULL,
	"normalizirana_rijec" text NOT NULL,
	CONSTRAINT "dokazi_dostignuca_jezicni_detektiv_pk" PRIMARY KEY("igrac_id","normalizirana_rijec"),
	CONSTRAINT "chk_dokazi_jezicni_detektiv_rijec" CHECK (char_length("normalizirana_rijec") >= 2)
);
--> statement-breakpoint
CREATE TABLE "dokazi_dostignuca_cinkaros" (
	"igrac_id" uuid NOT NULL,
	"prijavljeni_igrac_id" uuid NOT NULL,
	CONSTRAINT "dokazi_dostignuca_cinkaros_pk" PRIMARY KEY("igrac_id","prijavljeni_igrac_id"),
	CONSTRAINT "chk_dokazi_cinkaros_nije_samoprijava" CHECK ("igrac_id" <> "prijavljeni_igrac_id")
);
--> statement-breakpoint
ALTER TABLE "prijave" ADD CONSTRAINT "prijave_izmjena_rjecnika_id_izmjene_rjecnika_id_fk" FOREIGN KEY ("izmjena_rjecnika_id") REFERENCES "public"."izmjene_rjecnika"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dokazi_dostignuca_jezicni_detektiv" ADD CONSTRAINT "dokazi_jezicni_detektiv_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dokazi_dostignuca_cinkaros" ADD CONSTRAINT "dokazi_cinkaros_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dokazi_dostignuca_cinkaros" ADD CONSTRAINT "dokazi_cinkaros_prijavljeni_igrac_id_igraci_id_fk" FOREIGN KEY ("prijavljeni_igrac_id") REFERENCES "public"."igraci"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_prijave_otvorene_rijec" ON "prijave" USING btree ("tip","rijec") WHERE "potvrdena_akcija" is null and "status" in ('nova', 'pregledana');
--> statement-breakpoint
CREATE INDEX "idx_prijave_igraca_otvorene_pogrdne" ON "prijave_igraca" USING btree ("prijavljeni_igrac_id") WHERE "potvrdena_akcija" is null and "razlog" = 'pogrdan_nadimak';
