-- Create cat_ciudad catalog table
CREATE TABLE cat_ciudad (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  activo boolean NOT NULL DEFAULT true
);

-- Enable RLS
ALTER TABLE cat_ciudad ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read cat_ciudad"
  ON cat_ciudad FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert cat_ciudad"
  ON cat_ciudad FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update cat_ciudad"
  ON cat_ciudad FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
