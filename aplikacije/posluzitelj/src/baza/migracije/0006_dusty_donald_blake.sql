CREATE TYPE "public"."mod_partije" AS ENUM('cetiri_igraca', 'dva_igraca');--> statement-breakpoint
ALTER TABLE "igraci" ADD COLUMN "odigrane_1v1" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "igraci" ADD COLUMN "pobjede_1v1" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "igraci" ADD COLUMN "eliminacije_1v1" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "igraci" ADD COLUMN "bodovi_1v1" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "partije" ADD COLUMN "mod" "mod_partije" DEFAULT 'cetiri_igraca' NOT NULL;