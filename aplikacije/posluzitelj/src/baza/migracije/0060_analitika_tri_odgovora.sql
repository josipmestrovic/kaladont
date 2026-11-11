ALTER TYPE "public"."status_otvaranja_analitike" ADD VALUE 'tri_odgovora_ok';--> statement-breakpoint
ALTER TABLE "analitika_otvaranja" ADD COLUMN "odgovor_3" text;--> statement-breakpoint
ALTER TABLE "analitika_otvaranja" DROP CONSTRAINT "chk_analitika_otvaranja_broj_odgovora";--> statement-breakpoint
ALTER TABLE "analitika_otvaranja" DROP CONSTRAINT "chk_analitika_otvaranja_incident_pozicija";--> statement-breakpoint
ALTER TABLE "analitika_otvaranja" ADD CONSTRAINT "chk_analitika_otvaranja_broj_odgovora" CHECK ("broj_odgovora" >= 0 and "broj_odgovora" <= 3);--> statement-breakpoint
ALTER TABLE "analitika_otvaranja" ADD CONSTRAINT "chk_analitika_otvaranja_incident_pozicija" CHECK ("incident_pozicija" is null or "incident_pozicija" in (1, 2, 3));
