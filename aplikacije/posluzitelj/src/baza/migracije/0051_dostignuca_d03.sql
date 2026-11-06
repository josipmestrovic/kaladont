ALTER TABLE "napredak_dostignuca_igraca" ADD COLUMN "dnevne_desetke" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "napredak_dostignuca_igraca" ADD COLUMN "tjedne_elite" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "napredak_dostignuca_igraca" ADD COLUMN "mjesecne_elite" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "napredak_dostignuca_igraca" ADD COLUMN "na_dvije_fronte" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE "dokazi_top10_ulazaka" (
	"igrac_id" uuid NOT NULL,
	"vrsta_razdoblja" text NOT NULL,
	"kalendarski_pocetak" timestamp with time zone NOT NULL,
	"mod" "mod_partije" NOT NULL,
	"metrika" text NOT NULL,
	"mjesto" smallint NOT NULL,
	"opazeno_u" timestamp with time zone NOT NULL,
	"izvor" text NOT NULL,
	"izvor_partija_id" uuid,
	"obradjeno_u" timestamp with time zone,
	CONSTRAINT "dokazi_top10_ulazaka_pk" PRIMARY KEY("igrac_id","vrsta_razdoblja","kalendarski_pocetak","mod"),
	CONSTRAINT "chk_dokazi_top10_ulazaka_vrsta" CHECK ("vrsta_razdoblja" in ('dnevno', 'tjedno', 'mjesecno')),
	CONSTRAINT "chk_dokazi_top10_ulazaka_metrika" CHECK ("metrika" in ('prosjek_bodova', 'niz_pobjeda')),
	CONSTRAINT "chk_dokazi_top10_ulazaka_mjesto" CHECK ("mjesto" between 1 and 10),
	CONSTRAINT "chk_dokazi_top10_ulazaka_izvor" CHECK ("izvor" in ('partija', 'brisanje'))
);
--> statement-breakpoint
CREATE TABLE "dokazi_dostignuca_top10" (
	"igrac_id" uuid NOT NULL,
	"dostignuce_id" text NOT NULL,
	"kalendarski_pocetak" timestamp with time zone NOT NULL,
	CONSTRAINT "dokazi_dostignuca_top10_pk" PRIMARY KEY("igrac_id","dostignuce_id","kalendarski_pocetak"),
	CONSTRAINT "chk_dokazi_dostignuca_top10_id" CHECK ("dostignuce_id" in ('dnevna_desetka', 'tjedna_elita', 'mjesecna_elita'))
);
--> statement-breakpoint
CREATE TABLE "dokazi_dostignuca_na_dvije_fronte" (
	"igrac_id" uuid NOT NULL,
	"vrsta_razdoblja" text NOT NULL,
	"kalendarski_pocetak" timestamp with time zone NOT NULL,
	CONSTRAINT "dokazi_dostignuca_na_dvije_fronte_pk" PRIMARY KEY("igrac_id","vrsta_razdoblja","kalendarski_pocetak"),
	CONSTRAINT "chk_dokazi_na_dvije_fronte_vrsta" CHECK ("vrsta_razdoblja" in ('dnevno', 'tjedno', 'mjesecno'))
);
--> statement-breakpoint
ALTER TABLE "dokazi_top10_ulazaka" ADD CONSTRAINT "dokazi_top10_ulazaka_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dokazi_top10_ulazaka" ADD CONSTRAINT "dokazi_top10_ulazaka_izvor_partija_id_partije_id_fk" FOREIGN KEY ("izvor_partija_id") REFERENCES "public"."partije"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dokazi_dostignuca_top10" ADD CONSTRAINT "dokazi_dostignuca_top10_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "dokazi_dostignuca_na_dvije_fronte" ADD CONSTRAINT "dokazi_na_dvije_fronte_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_dokazi_top10_ulazaka_neobradeni" ON "dokazi_top10_ulazaka" USING btree ("igrac_id") WHERE "obradjeno_u" is null;
--> statement-breakpoint
CREATE INDEX "idx_dokazi_top10_ulazaka_partija" ON "dokazi_top10_ulazaka" USING btree ("izvor_partija_id") WHERE "obradjeno_u" is null and "izvor_partija_id" is not null;
