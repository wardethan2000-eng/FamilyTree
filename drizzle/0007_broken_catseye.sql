-- Migration: cross-tree foundation (phase 1, additive only)
-- Adds transitional columns, scope/visibility tables, and subscription metadata
-- without removing the legacy tree-connection model yet.

DO $$ BEGIN
  CREATE TYPE "public"."tree_scope_visibility" AS ENUM(
    'all_members',
    'family_circle',
    'named_circle'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."memory_visibility_override" AS ENUM(
    'all_members',
    'family_circle',
    'named_circle',
    'hidden'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."tree_subscription_tier" AS ENUM(
    'seedling',
    'hearth',
    'archive'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."tree_subscription_status" AS ENUM(
    'active',
    'grace_period',
    'dormant',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "tree_person_scope" (
  "tree_id" uuid NOT NULL REFERENCES "trees"("id") ON DELETE cascade,
  "person_id" uuid NOT NULL REFERENCES "people"("id") ON DELETE cascade,
  "display_name_override" varchar(200),
  "visibility_default" "tree_scope_visibility" DEFAULT 'all_members' NOT NULL,
  "added_by_user_id" text REFERENCES "users"("id") ON DELETE set null,
  "added_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "tree_person_scope_tree_id_person_id_pk" PRIMARY KEY ("tree_id", "person_id")
);

CREATE TABLE IF NOT EXISTS "tree_relationship_visibility" (
  "tree_id" uuid NOT NULL REFERENCES "trees"("id") ON DELETE cascade,
  "relationship_id" uuid NOT NULL REFERENCES "relationships"("id") ON DELETE cascade,
  "is_visible" boolean DEFAULT true NOT NULL,
  "notes" text,
  CONSTRAINT "tree_relationship_visibility_tree_id_relationship_id_pk"
    PRIMARY KEY ("tree_id", "relationship_id")
);

CREATE TABLE IF NOT EXISTS "memory_person_tags" (
  "memory_id" uuid NOT NULL REFERENCES "memories"("id") ON DELETE cascade,
  "person_id" uuid NOT NULL REFERENCES "people"("id") ON DELETE cascade,
  CONSTRAINT "memory_person_tags_memory_id_person_id_pk" PRIMARY KEY ("memory_id", "person_id")
);

CREATE TABLE IF NOT EXISTS "memory_tree_visibility" (
  "memory_id" uuid NOT NULL REFERENCES "memories"("id") ON DELETE cascade,
  "tree_id" uuid NOT NULL REFERENCES "trees"("id") ON DELETE cascade,
  "visibility_override" "memory_visibility_override" NOT NULL,
  "unlock_date" timestamp with time zone,
  CONSTRAINT "memory_tree_visibility_memory_id_tree_id_pk" PRIMARY KEY ("memory_id", "tree_id")
);

CREATE TABLE IF NOT EXISTS "person_merge_audit" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  "survivor_person_id" uuid NOT NULL,
  "merged_away_person_id" uuid NOT NULL,
  "field_resolutions" jsonb,
  "performed_by_user_id" text REFERENCES "users"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "media"
  ADD COLUMN IF NOT EXISTS "contributing_tree_id" uuid;

ALTER TABLE "memories"
  ADD COLUMN IF NOT EXISTS "contributing_tree_id" uuid;

ALTER TABLE "people"
  ADD COLUMN IF NOT EXISTS "home_tree_id" uuid;

ALTER TABLE "relationships"
  ADD COLUMN IF NOT EXISTS "created_in_tree_id" uuid;

ALTER TABLE "trees"
  ADD COLUMN IF NOT EXISTS "tier" "tree_subscription_tier" DEFAULT 'seedling' NOT NULL;

ALTER TABLE "trees"
  ADD COLUMN IF NOT EXISTS "subscription_status" "tree_subscription_status" DEFAULT 'active' NOT NULL;

ALTER TABLE "trees"
  ADD COLUMN IF NOT EXISTS "subscription_expires_at" timestamp with time zone;

DO $$ BEGIN
  ALTER TABLE "media"
    ADD CONSTRAINT "media_contributing_tree_id_trees_id_fk"
    FOREIGN KEY ("contributing_tree_id") REFERENCES "trees"("id") ON DELETE set null;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "memories"
    ADD CONSTRAINT "memories_contributing_tree_id_trees_id_fk"
    FOREIGN KEY ("contributing_tree_id") REFERENCES "trees"("id") ON DELETE set null;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "people"
    ADD CONSTRAINT "people_home_tree_id_trees_id_fk"
    FOREIGN KEY ("home_tree_id") REFERENCES "trees"("id") ON DELETE set null;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "relationships"
    ADD CONSTRAINT "relationships_created_in_tree_id_trees_id_fk"
    FOREIGN KEY ("created_in_tree_id") REFERENCES "trees"("id") ON DELETE set null;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "tree_person_scope_person_idx"
  ON "tree_person_scope" USING btree ("person_id");

CREATE INDEX IF NOT EXISTS "tree_person_scope_tree_idx"
  ON "tree_person_scope" USING btree ("tree_id");

CREATE INDEX IF NOT EXISTS "tree_person_scope_added_by_idx"
  ON "tree_person_scope" USING btree ("added_by_user_id");

CREATE INDEX IF NOT EXISTS "tree_rel_vis_tree_idx"
  ON "tree_relationship_visibility" USING btree ("tree_id");

CREATE INDEX IF NOT EXISTS "tree_rel_vis_relationship_idx"
  ON "tree_relationship_visibility" USING btree ("relationship_id");

CREATE INDEX IF NOT EXISTS "memory_person_tags_person_idx"
  ON "memory_person_tags" USING btree ("person_id");

CREATE INDEX IF NOT EXISTS "memory_tree_vis_tree_idx"
  ON "memory_tree_visibility" USING btree ("tree_id");

CREATE INDEX IF NOT EXISTS "person_merge_audit_survivor_idx"
  ON "person_merge_audit" USING btree ("survivor_person_id");

CREATE INDEX IF NOT EXISTS "person_merge_audit_merged_away_idx"
  ON "person_merge_audit" USING btree ("merged_away_person_id");

CREATE INDEX IF NOT EXISTS "person_merge_audit_performed_by_idx"
  ON "person_merge_audit" USING btree ("performed_by_user_id");

CREATE INDEX IF NOT EXISTS "media_contributing_tree_idx"
  ON "media" USING btree ("contributing_tree_id");

CREATE INDEX IF NOT EXISTS "memories_contributing_tree_idx"
  ON "memories" USING btree ("contributing_tree_id");

CREATE INDEX IF NOT EXISTS "people_home_tree_idx"
  ON "people" USING btree ("home_tree_id");

CREATE INDEX IF NOT EXISTS "relationships_created_in_tree_idx"
  ON "relationships" USING btree ("created_in_tree_id");

CREATE INDEX IF NOT EXISTS "trees_tier_idx"
  ON "trees" USING btree ("tier");

CREATE INDEX IF NOT EXISTS "trees_subscription_status_idx"
  ON "trees" USING btree ("subscription_status");
