-- PR09: univerzalni rang — doprinos po sudioniku + agregat na igraču.
-- Legacy odigrane/bodovi* ostaju (formatne statistike + rollback starog bina).
-- Backfill povijesti: pnpm --filter posluzitelj backfill-univerzalni-rang
ALTER TABLE "igraci" ADD COLUMN IF NOT EXISTS "rang_suma_jedinica" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "igraci" ADD COLUMN IF NOT EXISTS "rang_broj_partija" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sudionici_partije" ADD COLUMN IF NOT EXISTS "rang_doprinos_jedinice" bigint;--> statement-breakpoint
ALTER TABLE "sudionici_partije" ADD COLUMN IF NOT EXISTS "rang_izracun_verzija" smallint;
