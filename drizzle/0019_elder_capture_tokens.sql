CREATE TABLE "elder_capture_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tree_id" uuid NOT NULL,
	"email" varchar(320) NOT NULL,
	"token_hash" text NOT NULL,
	"display_name" varchar(200),
	"associated_person_id" uuid,
	"family_label" varchar(200),
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"last_used_user_agent" text,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "elder_capture_tokens" ADD CONSTRAINT "elder_capture_tokens_tree_id_trees_id_fk" FOREIGN KEY ("tree_id") REFERENCES "public"."trees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elder_capture_tokens" ADD CONSTRAINT "elder_capture_tokens_associated_person_id_people_id_fk" FOREIGN KEY ("associated_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "elder_capture_tokens" ADD CONSTRAINT "elder_capture_tokens_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "elder_capture_tokens_tree_idx" ON "elder_capture_tokens" USING btree ("tree_id");--> statement-breakpoint
CREATE INDEX "elder_capture_tokens_tree_email_idx" ON "elder_capture_tokens" USING btree ("tree_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "elder_capture_tokens_token_hash_unique_idx" ON "elder_capture_tokens" USING btree ("token_hash");
