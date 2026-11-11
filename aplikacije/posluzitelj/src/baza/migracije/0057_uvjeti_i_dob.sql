ALTER TABLE "igraci" ADD COLUMN "potvrda_dob_16" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "igraci" ADD COLUMN "uvjeti_verzija" text;
--> statement-breakpoint
ALTER TABLE "igraci" ADD COLUMN "uvjeti_prihvaceni_at" timestamp with time zone;
