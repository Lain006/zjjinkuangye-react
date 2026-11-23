CREATE TABLE documents (
  id text PRIMARY KEY,
  title text NOT NULL,
  source_name text NOT NULL,
  source_url text NOT NULL UNIQUE,
  source_type text NOT NULL,
  region text NOT NULL,
  category text NOT NULL,
  publish_date date,
  collected_at timestamptz NOT NULL,
  summary text NOT NULL,
  excerpt text NOT NULL,
  analysis text NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
  legacy_id integer UNIQUE,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX documents_listing ON documents (status, collected_at DESC, id DESC);
CREATE INDEX documents_published_date ON documents (publish_date) WHERE status = 'published';

CREATE TABLE document_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  document_id text NOT NULL REFERENCES documents (id),
  action text NOT NULL CHECK (action IN ('create', 'update', 'publish', 'archive')),
  before_document jsonb,
  after_document jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE admin_sessions (
  token_hash text PRIMARY KEY,
  expires_at timestamptz NOT NULL
);

CREATE INDEX admin_sessions_expiry ON admin_sessions (expires_at);
