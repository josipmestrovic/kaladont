ALTER TABLE "rijeci" ADD COLUMN "vrste" text[] DEFAULT '{"imenica"}' NOT NULL;--> statement-breakpoint
ALTER TABLE "rijeci" ADD COLUMN "grupe" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
UPDATE "rijeci" SET "grupe" = ARRAY['imenica:' || "rijec"] WHERE "grupe" = '{}';