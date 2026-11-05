DROP INDEX IF EXISTS "idx_potezi_partija_id_redni_broj";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_potezi_partija_id_redni_broj" ON "potezi" USING btree ("partija_id","redni_broj");
