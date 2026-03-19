-- Create vendedores table
CREATE TABLE vendedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  telefono text NOT NULL,
  usuario text NOT NULL UNIQUE,
  rol text NOT NULL DEFAULT 'vendedor' CHECK (rol IN ('admin', 'vendedor')),
  auth_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id),
  debe_cambiar_password boolean NOT NULL DEFAULT true,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE vendedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read vendedores"
  ON vendedores FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert vendedores"
  ON vendedores FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update vendedores"
  ON vendedores FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
