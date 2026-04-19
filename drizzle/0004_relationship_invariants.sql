DO $$ BEGIN
  CREATE TYPE "public"."spouse_status" AS ENUM('active', 'former', 'deceased_partner');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "relationships"
  ADD COLUMN IF NOT EXISTS "normalized_person_a_id" uuid,
  ADD COLUMN IF NOT EXISTS "normalized_person_b_id" uuid,
  ADD COLUMN IF NOT EXISTS "spouse_status" "spouse_status";

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'relationships_normalized_person_a_id_people_id_fk'
  ) THEN
    ALTER TABLE "relationships"
      ADD CONSTRAINT "relationships_normalized_person_a_id_people_id_fk"
      FOREIGN KEY ("normalized_person_a_id") REFERENCES "public"."people"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'relationships_normalized_person_b_id_people_id_fk'
  ) THEN
    ALTER TABLE "relationships"
      ADD CONSTRAINT "relationships_normalized_person_b_id_people_id_fk"
      FOREIGN KEY ("normalized_person_b_id") REFERENCES "public"."people"("id")
      ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;

UPDATE "relationships"
SET
  "normalized_person_a_id" = CASE
    WHEN "type" IN ('spouse', 'sibling') THEN LEAST("from_person_id", "to_person_id")
    ELSE NULL
  END,
  "normalized_person_b_id" = CASE
    WHEN "type" IN ('spouse', 'sibling') THEN GREATEST("from_person_id", "to_person_id")
    ELSE NULL
  END,
  "spouse_status" = CASE
    WHEN "type" = 'spouse' AND "end_date_text" IS NOT NULL THEN COALESCE("spouse_status", 'former'::"spouse_status")
    WHEN "type" = 'spouse' THEN COALESCE("spouse_status", 'active'::"spouse_status")
    ELSE NULL
  END;

WITH ranked_parent_child AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "tree_id", "type", "from_person_id", "to_person_id"
      ORDER BY "created_at", "id"
    ) AS rn
  FROM "relationships"
  WHERE "type" = 'parent_child'
),
ranked_undirected AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "tree_id", "type", "normalized_person_a_id", "normalized_person_b_id"
      ORDER BY "created_at", "id"
    ) AS rn
  FROM "relationships"
  WHERE "type" IN ('spouse', 'sibling')
),
dupes AS (
  SELECT "id" FROM ranked_parent_child WHERE rn > 1
  UNION ALL
  SELECT "id" FROM ranked_undirected WHERE rn > 1
)
DELETE FROM "relationships" r
USING dupes d
WHERE r."id" = d."id";

CREATE UNIQUE INDEX IF NOT EXISTS "relationships_unique_normalized_pair_idx"
  ON "relationships" USING btree ("tree_id", "type", "normalized_person_a_id", "normalized_person_b_id");
CREATE INDEX IF NOT EXISTS "relationships_normalized_person_a_idx"
  ON "relationships" USING btree ("normalized_person_a_id");
CREATE INDEX IF NOT EXISTS "relationships_normalized_person_b_idx"
  ON "relationships" USING btree ("normalized_person_b_id");
CREATE INDEX IF NOT EXISTS "relationships_spouse_status_idx"
  ON "relationships" USING btree ("spouse_status");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'relationships_no_self_chk'
  ) THEN
    ALTER TABLE "relationships"
      ADD CONSTRAINT "relationships_no_self_chk"
      CHECK ("from_person_id" <> "to_person_id");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'relationships_undirected_pair_presence_chk'
  ) THEN
    ALTER TABLE "relationships"
      ADD CONSTRAINT "relationships_undirected_pair_presence_chk"
      CHECK (
        "type" = 'parent_child'
        OR ("normalized_person_a_id" IS NOT NULL AND "normalized_person_b_id" IS NOT NULL)
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'relationships_undirected_pair_order_chk'
  ) THEN
    ALTER TABLE "relationships"
      ADD CONSTRAINT "relationships_undirected_pair_order_chk"
      CHECK (
        "type" = 'parent_child'
        OR "normalized_person_a_id" < "normalized_person_b_id"
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'relationships_spouse_status_consistency_chk'
  ) THEN
    ALTER TABLE "relationships"
      ADD CONSTRAINT "relationships_spouse_status_consistency_chk"
      CHECK (
        ("type" = 'spouse' AND "spouse_status" IS NOT NULL)
        OR ("type" <> 'spouse' AND "spouse_status" IS NULL)
      );
  END IF;
END $$;
