CREATE TYPE "public"."kategorija_bot_poola" AS ENUM('pool_1', 'pool_2');
--> statement-breakpoint
CREATE TYPE "public"."stanje_bot_pool_clana" AS ENUM('nerazrijeseno', 'razrijeseno');
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bot_pool_clanovi" (
	"rijec" text PRIMARY KEY NOT NULL,
	"kategorija" "kategorija_bot_poola" NOT NULL,
	"stanje" "stanje_bot_pool_clana" DEFAULT 'nerazrijeseno' NOT NULL,
	"ranije_aktivno" boolean DEFAULT false NOT NULL,
	"dodan" timestamp with time zone DEFAULT now() NOT NULL,
	"azuriran" timestamp with time zone DEFAULT now() NOT NULL
);