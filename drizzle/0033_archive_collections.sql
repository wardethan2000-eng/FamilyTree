-- Archive collections: curated mini-archive exports
CREATE TYPE collection_scope_kind AS ENUM ('person', 'couple', 'branch', 'event', 'place', 'theme', 'manual');
CREATE TYPE collection_item_kind AS ENUM ('person', 'memory', 'place', 'relationship');
CREATE TYPE section_kind AS ENUM ('intro', 'chapter', 'gallery', 'timeline', 'drift', 'people', 'custom');
CREATE TYPE export_output_kind AS ENUM ('full_zip', 'mini_zip', 'static_html', 'share_link', 'kiosk_package');
CREATE TYPE collection_view_mode AS ENUM ('chapter', 'drift', 'gallery', 'storybook', 'kiosk');
CREATE TYPE collection_visibility AS ENUM ('private', 'tree_members', 'stewards');

CREATE TABLE archive_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id uuid NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
  created_by_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name varchar(200) NOT NULL,
  description text,
  scope_kind collection_scope_kind NOT NULL,
  scope_json text,
  intro_text text,
  dedication_text text,
  default_view_mode collection_view_mode NOT NULL DEFAULT 'chapter',
  visibility collection_visibility NOT NULL DEFAULT 'private',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX archive_collections_tree_idx ON archive_collections(tree_id);
CREATE INDEX archive_collections_created_by_idx ON archive_collections(created_by_user_id);

CREATE TABLE archive_collection_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES archive_collections(id) ON DELETE CASCADE,
  title varchar(200) NOT NULL,
  body text,
  section_kind section_kind NOT NULL DEFAULT 'chapter',
  sort_order integer NOT NULL DEFAULT 0,
  settings_json text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX archive_collection_sections_collection_idx ON archive_collection_sections(collection_id);

CREATE TABLE archive_collection_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES archive_collections(id) ON DELETE CASCADE,
  section_id uuid REFERENCES archive_collection_sections(id) ON DELETE SET NULL,
  item_kind collection_item_kind NOT NULL,
  item_id uuid NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  caption_override text,
  include_context boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX archive_collection_items_collection_idx ON archive_collection_items(collection_id);
CREATE INDEX archive_collection_items_section_idx ON archive_collection_items(section_id);

-- Extend archive_exports with collection reference and output metadata
ALTER TABLE archive_exports
  ADD COLUMN IF NOT EXISTS collection_id uuid REFERENCES archive_collections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS output_kind export_output_kind DEFAULT 'full_zip',
  ADD COLUMN IF NOT EXISTS manifest_version integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS manifest_json text,
  ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS error_message text;

CREATE INDEX IF NOT EXISTS archive_exports_collection_idx ON archive_exports(collection_id);