-- Migration: retire legacy connection-era tables after cross-tree backfill
-- Safe on databases that never had these objects or already dropped them.

DROP TABLE IF EXISTS "cross_tree_person_links";
DROP TABLE IF EXISTS "tree_connections";
DROP TYPE IF EXISTS "public"."tree_connection_status";
