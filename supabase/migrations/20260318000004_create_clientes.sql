-- Create clientes table
CREATE TABLE clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  telefono text NOT NULL,
  correo text,
  fecha_nacimiento date,
  ciudad_id uuid NOT NULL REFERENCES cat_ciudad(id),
  direccion text NOT NULL,
  referencia_ubicacion text NOT NULL,
  latitud numeric,
  longitud numeric,
  cliente_referido_id uuid REFERENCES clientes(id),
  limite_credito numeric NOT NULL DEFAULT 1500,
  usuario_id uuid REFERENCES auth.users,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_clientes_ciudad ON clientes(ciudad_id);
CREATE INDEX idx_clientes_referido ON clientes(cliente_referido_id);

-- Enable RLS
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read clientes"
  ON clientes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert clientes"
  ON clientes FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update clientes"
  ON clientes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
