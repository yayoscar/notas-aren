CREATE TABLE proveedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  nombre_contacto TEXT,
  telefono TEXT,
  email TEXT,
  notas TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
