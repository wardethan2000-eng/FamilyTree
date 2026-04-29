-- Add locking/retry columns to import_batch_items for robust metadata worker
ALTER TABLE import_batch_items
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS run_after timestamp with time zone NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_error text;

-- Add perceptual hash column for near-duplicate detection (72 bits = 18 hex chars for 9x8 dHash)
ALTER TABLE import_batch_items
  ADD COLUMN IF NOT EXISTS perceptual_hash varchar(18);

CREATE INDEX IF NOT EXISTS import_batch_items_locking_idx
  ON import_batch_items (status, run_after);

CREATE INDEX IF NOT EXISTS import_batch_items_phash_idx
  ON import_batch_items (tree_id, perceptual_hash);