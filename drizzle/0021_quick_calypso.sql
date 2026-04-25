-- Account deletion: add deleted_users table, change restrict FKs to set null, make those columns nullable
CREATE TABLE "deleted_users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text,
	"deleted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "archive_exports" DROP CONSTRAINT "archive_exports_requested_by_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "invitations" DROP CONSTRAINT "invitations_invited_by_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "memories" DROP CONSTRAINT "memories_contributor_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "memory_person_suppressions" DROP CONSTRAINT "memory_person_suppressions_suppressed_by_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "memory_perspectives" DROP CONSTRAINT "memory_perspectives_contributor_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "prompts" DROP CONSTRAINT "prompts_from_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "trees" DROP CONSTRAINT "trees_founder_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "archive_exports" ALTER COLUMN "requested_by_user_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "invitations" ALTER COLUMN "invited_by_user_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "memories" ALTER COLUMN "contributor_user_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "memory_person_suppressions" ALTER COLUMN "suppressed_by_user_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "memory_perspectives" ALTER COLUMN "contributor_user_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "prompts" ALTER COLUMN "from_user_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "trees" ALTER COLUMN "founder_user_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "archive_exports" ADD CONSTRAINT "archive_exports_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_contributor_user_id_users_id_fk" FOREIGN KEY ("contributor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "memory_person_suppressions" ADD CONSTRAINT "memory_person_suppressions_suppressed_by_user_id_users_id_fk" FOREIGN KEY ("suppressed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "memory_perspectives" ADD CONSTRAINT "memory_perspectives_contributor_user_id_users_id_fk" FOREIGN KEY ("contributor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "prompts" ADD CONSTRAINT "prompts_from_user_id_users_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "trees" ADD CONSTRAINT "trees_founder_user_id_users_id_fk" FOREIGN KEY ("founder_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;