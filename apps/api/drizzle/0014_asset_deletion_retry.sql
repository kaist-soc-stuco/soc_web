CREATE TABLE "asset_deletion_job" (
	"storage_key" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
