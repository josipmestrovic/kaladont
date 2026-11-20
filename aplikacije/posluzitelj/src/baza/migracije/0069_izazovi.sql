ALTER TYPE "public"."kontekst_analitike" ADD VALUE 'izazov';--> statement-breakpoint
ALTER TYPE "public"."kontekst_izvora_misije" ADD VALUE 'izazov';--> statement-breakpoint
CREATE TYPE "public"."status_pokusaja_izazova" AS ENUM('rezerviran', 'u_tijeku', 'uspjeh', 'neuspjeh', 'tehnicki_prekinuto');--> statement-breakpoint
CREATE TYPE "public"."razlog_neuspjeha_izazova" AS ENUM('cilj_neispunjen', 'eliminiran', 'nevaljana_rijec', 'odustao', 'prekid_veze');--> statement-breakpoint
CREATE TYPE "public"."status_spremanja_izazova" AS ENUM('nije_potrebno', 'spremanje_u_tijeku', 'spremljeno');--> statement-breakpoint
CREATE TYPE "public"."vrsta_racuna_izazova" AS ENUM('gost', 'registriran');--> statement-breakpoint
CREATE TABLE "pokusaji_izazova" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"igrac_id" uuid NOT NULL,
	"challenge_id" text NOT NULL,
	"request_id" text NOT NULL,
	"definition_version" integer NOT NULL,
	"bot_profile_version" integer,
	"dictionary_version" integer,
	"snapshot" jsonb NOT NULL,
	"partija_id" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"terminal_at" timestamp with time zone,
	"results_visible_at" timestamp with time zone,
	"status" "status_pokusaja_izazova" DEFAULT 'rezerviran' NOT NULL,
	"reason" "razlog_neuspjeha_izazova",
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"game_won" boolean,
	"seed" text,
	"settlement_state" "status_spremanja_izazova" DEFAULT 'nije_potrebno' NOT NULL,
	"account_type_at_start" "vrsta_racuna_izazova" NOT NULL
);--> statement-breakpoint
CREATE TABLE "zavrseci_izazova" (
	"igrac_id" uuid NOT NULL,
	"challenge_id" text NOT NULL,
	"first_success_attempt_id" uuid NOT NULL,
	"vrijeme" timestamp with time zone NOT NULL,
	"nominal_xp" integer NOT NULL,
	"awarded_xp" integer NOT NULL,
	"reward_epoch" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "zavrseci_izazova_pkey" PRIMARY KEY("igrac_id","challenge_id"),
	CONSTRAINT "chk_zavrseci_izazova_xp" CHECK ("nominal_xp" >= 0 AND "awarded_xp" >= 0 AND "awarded_xp" <= "nominal_xp"),
	CONSTRAINT "chk_zavrseci_izazova_reward_epoch" CHECK ("reward_epoch" >= 1)
);--> statement-breakpoint
ALTER TABLE "pokusaji_izazova" ADD CONSTRAINT "pokusaji_izazova_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zavrseci_izazova" ADD CONSTRAINT "zavrseci_izazova_igrac_id_igraci_id_fk" FOREIGN KEY ("igrac_id") REFERENCES "public"."igraci"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zavrseci_izazova" ADD CONSTRAINT "zavrseci_izazova_first_success_attempt_id_pokusaji_izazova_id_fk" FOREIGN KEY ("first_success_attempt_id") REFERENCES "public"."pokusaji_izazova"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_pokusaji_izazova_igrac_request" ON "pokusaji_izazova" USING btree ("igrac_id","request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_pokusaji_izazova_aktivan_igrac" ON "pokusaji_izazova" USING btree ("igrac_id") WHERE "status" IN ('rezerviran', 'u_tijeku');--> statement-breakpoint
CREATE INDEX "idx_pokusaji_izazova_challenge_verzija_start" ON "pokusaji_izazova" USING btree ("challenge_id","definition_version","started_at");--> statement-breakpoint
CREATE INDEX "idx_pokusaji_izazova_igrac_status" ON "pokusaji_izazova" USING btree ("igrac_id","status");--> statement-breakpoint
CREATE INDEX "idx_zavrseci_izazova_vrijeme" ON "zavrseci_izazova" USING btree ("vrijeme");
