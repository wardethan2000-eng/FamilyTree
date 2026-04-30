CREATE TYPE person_public_page_status AS ENUM ('draft', 'published', 'disabled');

CREATE TABLE person_public_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id uuid NOT NULL REFERENCES trees(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  slug varchar(140) NOT NULL,
  status person_public_page_status NOT NULL DEFAULT 'draft',
  title varchar(200),
  subtitle varchar(255),
  obituary_text text,
  service_details text,
  donation_url text,
  contact_email varchar(320),
  allow_search_indexing boolean NOT NULL DEFAULT false,
  show_life_dates boolean NOT NULL DEFAULT true,
  show_places boolean NOT NULL DEFAULT true,
  show_featured_memories boolean NOT NULL DEFAULT true,
  created_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
  updated_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
  published_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX person_public_pages_slug_unique_idx ON person_public_pages(slug);
CREATE UNIQUE INDEX person_public_pages_tree_person_unique_idx ON person_public_pages(tree_id, person_id);
CREATE INDEX person_public_pages_tree_idx ON person_public_pages(tree_id);
CREATE INDEX person_public_pages_person_idx ON person_public_pages(person_id);
CREATE INDEX person_public_pages_status_idx ON person_public_pages(status);
