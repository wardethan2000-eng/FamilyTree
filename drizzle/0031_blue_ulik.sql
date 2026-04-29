CREATE TYPE "public"."collection_item_kind" AS ENUM('person', 'memory', 'place', 'relationship');--> statement-breakpoint
CREATE TYPE "public"."collection_scope_kind" AS ENUM('person', 'couple', 'branch', 'event', 'place', 'theme', 'manual');--> statement-breakpoint
CREATE TYPE "public"."collection_section_kind" AS ENUM('intro', 'chapter', 'gallery', 'timeline', 'drift', 'people', 'custom');--> statement-breakpoint
CREATE TYPE "public"."collection_view_mode" AS ENUM('chapter', 'drift', 'gallery', 'storybook', 'kiosk');--> statement-breakpoint
CREATE TYPE "public"."collection_visibility" AS ENUM('private', 'tree_members', 'stewards');--> statement-breakpoint
CREATE TYPE "public"."export_output_kind" AS ENUM('full_zip', 'mini_zip');--> statement-breakpoint
CREATE TYPE "public"."media_quality" AS ENUM('original', 'web', 'small');--> statement-breakpoint
ALTER TYPE "public"."prompt_reply_link_status" ADD VALUE 'skipped' BEFORE 'revoked';--> statement-breakpoint
CREATE TABLE "archive_collection_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collection_id" uuid NOT NULL,
	"section_id" uuid,
	"person_id" uuid,
	"memory_id" uuid,
	"place_id" uuid,
	"relationship_id" uuid,
	"item_kind" "collection_item_kind" NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"caption_override" text,
	"include_relationships" boolean,
	"include_related_memories" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "archive_collection_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collection_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"body" text,
	"section_kind" "collection_section_kind" DEFAULT 'chapter' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"settings_json" jsonb
);
--> statement-breakpoint
CREATE TABLE "archive_collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tree_id" uuid NOT NULL,
	"created_by_user_id" text,
	"name" varchar(200) NOT NULL,
	"slug" varchar(220) NOT NULL,
	"description" text,
	"scope_kind" "collection_scope_kind" NOT NULL,
	"scope_json" jsonb,
	"intro_text" text,
	"dedication_text" text,
	"default_view_mode" "collection_view_mode" DEFAULT 'chapter' NOT NULL,
	"visibility" "collection_visibility" DEFAULT 'private' NOT NULL,
	"include_relationships" boolean DEFAULT true NOT NULL,
	"include_related_memories" boolean DEFAULT true NOT NULL,
	"include_places" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "archive_exports" ADD COLUMN "collection_id" uuid;--> statement-breakpoint
ALTER TABLE "archive_exports" ADD COLUMN "output_kind" "export_output_kind" DEFAULT 'full_zip' NOT NULL;--> statement-breakpoint
ALTER TABLE "archive_exports" ADD COLUMN "media_quality" "media_quality" DEFAULT 'web' NOT NULL;--> statement-breakpoint
ALTER TABLE "archive_exports" ADD COLUMN "manifest_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "archive_exports" ADD COLUMN "manifest_json" jsonb;--> statement-breakpoint
ALTER TABLE "archive_exports" ADD COLUMN "error_code" varchar(80);--> statement-breakpoint
ALTER TABLE "archive_exports" ADD COLUMN "error_message" text;--> statement-breakpoint
ALTER TABLE "import_batch_items" ADD COLUMN "attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "import_batch_items" ADD COLUMN "locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "import_batch_items" ADD COLUMN "run_after" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "import_batch_items" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "import_batch_items" ADD COLUMN "perceptual_hash" varchar(18);--> statement-breakpoint
ALTER TABLE "memories" ADD COLUMN "search_vector" "tsvector";--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "search_vector" "tsvector";--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "search_vector" "tsvector";--> statement-breakpoint
ALTER TABLE "archive_collection_items" ADD CONSTRAINT "archive_collection_items_collection_id_archive_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."archive_collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "archive_collection_items" ADD CONSTRAINT "archive_collection_items_section_id_archive_collection_sections_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."archive_collection_sections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "archive_collection_items" ADD CONSTRAINT "archive_collection_items_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "archive_collection_items" ADD CONSTRAINT "archive_collection_items_memory_id_memories_id_fk" FOREIGN KEY ("memory_id") REFERENCES "public"."memories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "archive_collection_items" ADD CONSTRAINT "archive_collection_items_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "archive_collection_items" ADD CONSTRAINT "archive_collection_items_relationship_id_relationships_id_fk" FOREIGN KEY ("relationship_id") REFERENCES "public"."relationships"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "archive_collection_sections" ADD CONSTRAINT "archive_collection_sections_collection_id_archive_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."archive_collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "archive_collections" ADD CONSTRAINT "archive_collections_tree_id_trees_id_fk" FOREIGN KEY ("tree_id") REFERENCES "public"."trees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "archive_collections" ADD CONSTRAINT "archive_collections_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "archive_collection_items_collection_idx" ON "archive_collection_items" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX "archive_collection_items_section_idx" ON "archive_collection_items" USING btree ("section_id");--> statement-breakpoint
CREATE INDEX "archive_collection_items_person_idx" ON "archive_collection_items" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "archive_collection_items_memory_idx" ON "archive_collection_items" USING btree ("memory_id");--> statement-breakpoint
CREATE INDEX "archive_collection_items_place_idx" ON "archive_collection_items" USING btree ("place_id");--> statement-breakpoint
CREATE INDEX "archive_collection_items_relationship_idx" ON "archive_collection_items" USING btree ("relationship_id");--> statement-breakpoint
CREATE INDEX "archive_collection_items_collection_sort_idx" ON "archive_collection_items" USING btree ("collection_id","sort_order");--> statement-breakpoint
CREATE INDEX "archive_collection_sections_collection_idx" ON "archive_collection_sections" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX "archive_collection_sections_sort_idx" ON "archive_collection_sections" USING btree ("collection_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "archive_collections_tree_slug_idx" ON "archive_collections" USING btree ("tree_id","slug");--> statement-breakpoint
CREATE INDEX "archive_collections_tree_idx" ON "archive_collections" USING btree ("tree_id");--> statement-breakpoint
CREATE INDEX "archive_collections_created_by_idx" ON "archive_collections" USING btree ("created_by_user_id");--> statement-breakpoint
ALTER TABLE "archive_exports" ADD CONSTRAINT "archive_exports_collection_id_archive_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."archive_collections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "archive_exports_collection_idx" ON "archive_exports" USING btree ("collection_id");--> statement-breakpoint
CREATE INDEX "import_batch_items_locking_idx" ON "import_batch_items" USING btree ("status","run_after");--> statement-breakpoint
CREATE INDEX "import_batch_items_phash_idx" ON "import_batch_items" USING btree ("tree_id","perceptual_hash");--> statement-breakpoint
CREATE INDEX "memories_search_gin_idx" ON "memories" USING btree ("search_vector");--> statement-breakpoint
CREATE INDEX "people_search_gin_idx" ON "people" USING btree ("search_vector");--> statement-breakpoint
CREATE INDEX "places_search_gin_idx" ON "places" USING btree ("search_vector");