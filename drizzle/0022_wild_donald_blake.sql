ALTER TABLE "user_notification_preferences" ALTER COLUMN "system_email" SET DEFAULT false;
--> statement-breakpoint
UPDATE "user_notification_preferences" SET "system_email" = false WHERE "system_email" = true;