CREATE TYPE "public"."linked_media_provider" AS ENUM('google_drive');--> statement-breakpoint
ALTER TABLE "memories" ADD COLUMN "linked_media_provider" "linked_media_provider";--> statement-breakpoint
ALTER TABLE "memories" ADD COLUMN "linked_media_provider_item_id" varchar(255);--> statement-breakpoint
ALTER TABLE "memories" ADD COLUMN "linked_media_source_url" text;--> statement-breakpoint
ALTER TABLE "memories" ADD COLUMN "linked_media_open_url" text;--> statement-breakpoint
ALTER TABLE "memories" ADD COLUMN "linked_media_preview_url" text;--> statement-breakpoint
ALTER TABLE "memories" ADD COLUMN "linked_media_label" varchar(255);--> statement-breakpoint
CREATE INDEX "memories_linked_media_provider_idx" ON "memories" USING btree ("linked_media_provider");--> statement-breakpoint
CREATE INDEX "memories_linked_media_item_idx" ON "memories" USING btree ("linked_media_provider_item_id");