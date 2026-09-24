ALTER TABLE "igraci" ADD COLUMN "email_na_cekanju" text;--> statement-breakpoint
ALTER TABLE "igraci" ADD COLUMN "email_potvrda_zatrazen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "igraci" ADD COLUMN "email_potvrda_poslana_at" timestamp with time zone;