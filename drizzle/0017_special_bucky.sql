CREATE TABLE "user_notification_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"invitations_email" boolean DEFAULT true NOT NULL,
	"prompts_email" boolean DEFAULT true NOT NULL,
	"system_email" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "first_name" varchar(200);--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "last_name" varchar(200);--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN IF NOT EXISTS "maiden_name" varchar(200);--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ADD CONSTRAINT "user_notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;