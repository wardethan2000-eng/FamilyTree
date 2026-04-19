CREATE TYPE "public"."transcription_status" AS ENUM('none', 'queued', 'processing', 'completed', 'failed');
CREATE TYPE "public"."transcription_job_status" AS ENUM('queued', 'processing', 'completed', 'failed');
CREATE TYPE "public"."prompt_reply_link_status" AS ENUM('pending', 'used', 'revoked', 'expired');

ALTER TABLE "memories"
  ADD COLUMN "transcript_text" text,
  ADD COLUMN "transcript_language" varchar(32),
  ADD COLUMN "transcript_status" "transcription_status" DEFAULT 'none' NOT NULL,
  ADD COLUMN "transcript_error" text,
  ADD COLUMN "transcript_updated_at" timestamp with time zone;

CREATE TABLE "prompt_reply_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tree_id" uuid NOT NULL,
  "prompt_id" uuid NOT NULL,
  "email" varchar(320) NOT NULL,
  "token_hash" text NOT NULL,
  "status" "prompt_reply_link_status" DEFAULT 'pending' NOT NULL,
  "created_by_user_id" text,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "transcription_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tree_id" uuid NOT NULL,
  "memory_id" uuid NOT NULL,
  "status" "transcription_job_status" DEFAULT 'queued' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "run_after" timestamp with time zone DEFAULT now() NOT NULL,
  "locked_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "last_error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "prompt_reply_links"
  ADD CONSTRAINT "prompt_reply_links_tree_id_trees_id_fk"
    FOREIGN KEY ("tree_id") REFERENCES "public"."trees"("id")
    ON DELETE cascade ON UPDATE no action;
ALTER TABLE "prompt_reply_links"
  ADD CONSTRAINT "prompt_reply_links_prompt_id_prompts_id_fk"
    FOREIGN KEY ("prompt_id") REFERENCES "public"."prompts"("id")
    ON DELETE cascade ON UPDATE no action;
ALTER TABLE "prompt_reply_links"
  ADD CONSTRAINT "prompt_reply_links_created_by_user_id_users_id_fk"
    FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id")
    ON DELETE set null ON UPDATE no action;

ALTER TABLE "transcription_jobs"
  ADD CONSTRAINT "transcription_jobs_tree_id_trees_id_fk"
    FOREIGN KEY ("tree_id") REFERENCES "public"."trees"("id")
    ON DELETE cascade ON UPDATE no action;
ALTER TABLE "transcription_jobs"
  ADD CONSTRAINT "transcription_jobs_memory_id_memories_id_fk"
    FOREIGN KEY ("memory_id") REFERENCES "public"."memories"("id")
    ON DELETE cascade ON UPDATE no action;

CREATE INDEX "memories_transcript_status_idx" ON "memories" USING btree ("transcript_status");
CREATE INDEX "prompt_reply_links_tree_idx" ON "prompt_reply_links" USING btree ("tree_id");
CREATE INDEX "prompt_reply_links_prompt_idx" ON "prompt_reply_links" USING btree ("prompt_id");
CREATE INDEX "prompt_reply_links_email_idx" ON "prompt_reply_links" USING btree ("email");
CREATE INDEX "prompt_reply_links_status_idx" ON "prompt_reply_links" USING btree ("status");
CREATE UNIQUE INDEX "prompt_reply_links_token_hash_unique_idx" ON "prompt_reply_links" USING btree ("token_hash");
CREATE UNIQUE INDEX "transcription_jobs_memory_unique_idx" ON "transcription_jobs" USING btree ("memory_id");
CREATE INDEX "transcription_jobs_tree_idx" ON "transcription_jobs" USING btree ("tree_id");
CREATE INDEX "transcription_jobs_status_run_after_idx" ON "transcription_jobs" USING btree ("status","run_after");
