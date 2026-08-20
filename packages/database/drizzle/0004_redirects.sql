CREATE TABLE public.redirects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_path text NOT NULL,
  to_path text NOT NULL,
  status_code integer NOT NULL DEFAULT 301 CHECK (status_code IN (301, 302, 307, 308)),
  is_active boolean NOT NULL DEFAULT true,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT redirects_from_path_format CHECK (from_path LIKE '/%'),
  CONSTRAINT redirects_to_path_format CHECK (to_path LIKE '/%' OR to_path LIKE 'https://%' OR to_path LIKE 'http://%'),
  CONSTRAINT redirects_from_ne_to CHECK (from_path <> to_path)
);

CREATE UNIQUE INDEX redirects_from_path_active_idx
  ON public.redirects (from_path)
  WHERE is_active = true;

CREATE INDEX redirects_active_idx ON public.redirects (is_active);

ALTER TABLE public.redirects ENABLE ROW LEVEL SECURITY;

-- Server uses DATABASE_URL (bypasses RLS). No anon/authenticated policies:
-- redirects are not exposed via the Supabase Data API.
