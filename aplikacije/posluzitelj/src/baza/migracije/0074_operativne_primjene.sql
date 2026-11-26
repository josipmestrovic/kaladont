CREATE TABLE IF NOT EXISTS "operativne_primjene" (
	"kljuc" text PRIMARY KEY NOT NULL,
	"vrijeme" timestamp with time zone DEFAULT now() NOT NULL,
	"napomena" text
);
--> statement-breakpoint
