CREATE TYPE "public"."tip_prezentacije_bota" AS ENUM('imenovani', 'gost');--> statement-breakpoint
ALTER TABLE "botovi" ADD COLUMN "tip" "tip_prezentacije_bota" DEFAULT 'imenovani' NOT NULL;