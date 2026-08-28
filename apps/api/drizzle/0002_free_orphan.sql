CREATE TABLE "vote_ballot" (
	"ballot_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vote_id" uuid NOT NULL,
	"ciphertext" text NOT NULL,
	"iv" varchar(32) NOT NULL,
	"auth_tag" varchar(32) NOT NULL,
	"receipt_hash" varchar(64) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vote_item" (
	"item_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vote_id" uuid NOT NULL,
	"title_ko" text NOT NULL,
	"title_en" text,
	"description_ko" text,
	"description_en" text,
	"type" varchar(30) NOT NULL,
	"max_selections" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "vote_item_type_check" CHECK ("vote_item"."type" in ('YES_NO_ABSTAIN', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE')),
	CONSTRAINT "vote_item_max_selection_check" CHECK ("vote_item"."max_selections" >= 1)
);
--> statement-breakpoint
CREATE TABLE "vote_option" (
	"option_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"label_ko" varchar(255) NOT NULL,
	"label_en" varchar(255),
	"description_ko" text,
	"description_en" text,
	"image_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vote_tally" (
	"vote_id" uuid PRIMARY KEY NOT NULL,
	"result" jsonb NOT NULL,
	"total_ballots" integer NOT NULL,
	"tallied_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vote_voter" (
	"vote_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name_ko" varchar(100) NOT NULL,
	"student_number" varchar(20),
	"email" varchar(255) NOT NULL,
	"primary_major" varchar(100),
	"academic_status" varchar(30),
	"fee_status" varchar(20),
	"status" varchar(20) DEFAULT 'ELIGIBLE' NOT NULL,
	"source" varchar(20) DEFAULT 'FILTER' NOT NULL,
	"has_voted" boolean DEFAULT false NOT NULL,
	"voted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vote_voter_vote_id_user_id_pk" PRIMARY KEY("vote_id","user_id"),
	CONSTRAINT "vote_voter_status_check" CHECK ("vote_voter"."status" in ('ELIGIBLE', 'EXCLUDED')),
	CONSTRAINT "vote_voter_source_check" CHECK ("vote_voter"."source" in ('FILTER', 'MANUAL', 'IMPORT'))
);
--> statement-breakpoint
CREATE TABLE "vote" (
	"vote_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_id" uuid,
	"title_ko" varchar(255) NOT NULL,
	"title_en" varchar(255),
	"description_ko" text,
	"description_en" text,
	"status" varchar(20) DEFAULT 'DRAFT' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"academic_statuses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fee_payers_only" boolean DEFAULT false NOT NULL,
	"student_number_from" varchar(20),
	"student_number_to" varchar(20),
	"encrypted_ballot_key" text,
	"key_iv" varchar(32),
	"key_tag" varchar(32),
	"voter_snapshot_at" timestamp with time zone,
	"results_published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vote_status_check" CHECK ("vote"."status" in ('DRAFT', 'PUBLISHED', 'CLOSED', 'TALLIED')),
	CONSTRAINT "vote_schedule_check" CHECK ("vote"."ends_at" > "vote"."starts_at")
);
--> statement-breakpoint
ALTER TABLE "vote_ballot" ADD CONSTRAINT "vote_ballot_vote_id_vote_vote_id_fk" FOREIGN KEY ("vote_id") REFERENCES "public"."vote"("vote_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_item" ADD CONSTRAINT "vote_item_vote_id_vote_vote_id_fk" FOREIGN KEY ("vote_id") REFERENCES "public"."vote"("vote_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_option" ADD CONSTRAINT "vote_option_item_id_vote_item_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."vote_item"("item_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_tally" ADD CONSTRAINT "vote_tally_vote_id_vote_vote_id_fk" FOREIGN KEY ("vote_id") REFERENCES "public"."vote"("vote_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_voter" ADD CONSTRAINT "vote_voter_vote_id_vote_vote_id_fk" FOREIGN KEY ("vote_id") REFERENCES "public"."vote"("vote_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote_voter" ADD CONSTRAINT "vote_voter_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vote" ADD CONSTRAINT "vote_creator_id_users_user_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."users"("user_id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vote_ballot_vote_idx" ON "vote_ballot" USING btree ("vote_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vote_ballot_receipt_unique_idx" ON "vote_ballot" USING btree ("receipt_hash");--> statement-breakpoint
CREATE INDEX "vote_item_vote_sort_idx" ON "vote_item" USING btree ("vote_id","sort_order");--> statement-breakpoint
CREATE INDEX "vote_option_item_sort_idx" ON "vote_option" USING btree ("item_id","sort_order");--> statement-breakpoint
CREATE INDEX "vote_voter_vote_status_idx" ON "vote_voter" USING btree ("vote_id","status","has_voted");--> statement-breakpoint
CREATE INDEX "vote_status_schedule_idx" ON "vote" USING btree ("status","starts_at","ends_at");