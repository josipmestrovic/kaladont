ALTER TABLE "igraci" ADD COLUMN "avatar_config" jsonb;
ALTER TABLE "igraci" ADD COLUMN "avatar_revision" integer DEFAULT 0 NOT NULL;