-- Phase 3: Prompt & Elder Reply system

CREATE TYPE "public"."prompt_status" AS ENUM('pending', 'answered', 'dismissed');

CREATE TABLE "prompts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tree_id" uuid NOT NULL,
  "from_user_id" text NOT NULL,
  "to_person_id" uuid NOT NULL,
  "question_text" text NOT NULL,
  "status" "prompt_status" DEFAULT 'pending' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "memories" ADD COLUMN "prompt_id" uuid;

ALTER TABLE "prompts" ADD CONSTRAINT "prompts_tree_id_trees_id_fk" FOREIGN KEY ("tree_id") REFERENCES "public"."trees"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_to_person_id_people_id_fk" FOREIGN KEY ("to_person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "memories" ADD CONSTRAINT "memories_prompt_id_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."prompts"("id") ON DELETE set null ON UPDATE no action;

CREATE INDEX "prompts_tree_idx" ON "prompts" USING btree ("tree_id");
CREATE INDEX "prompts_from_user_idx" ON "prompts" USING btree ("from_user_id");
CREATE INDEX "prompts_to_person_idx" ON "prompts" USING btree ("to_person_id");
CREATE INDEX "prompts_status_idx" ON "prompts" USING btree ("status");
CREATE INDEX "memories_prompt_idx" ON "memories" USING btree ("prompt_id");
