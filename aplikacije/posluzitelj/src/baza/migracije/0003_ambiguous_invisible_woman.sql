ALTER TYPE "public"."nacin_ispadanja" ADD VALUE 'kaladont';--> statement-breakpoint
ALTER TYPE "public"."vrsta_poteza" ADD VALUE 'kaladont';--> statement-breakpoint
ALTER TYPE "public"."vrsta_poteza" ADD VALUE 'sustav_rijec';--> statement-breakpoint
ALTER TABLE "potezi" ALTER COLUMN "igrac_id" DROP NOT NULL;