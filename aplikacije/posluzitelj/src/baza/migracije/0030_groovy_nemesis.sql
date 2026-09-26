CREATE TABLE IF NOT EXISTS "vlastita_imena" (
	"rijec" text PRIMARY KEY NOT NULL,
	"leme" text[] DEFAULT '{}' NOT NULL,
	"frekvencija" integer DEFAULT 0 NOT NULL
);
