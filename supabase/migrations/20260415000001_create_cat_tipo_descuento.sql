-- Catálogo de tipos de descuento aplicables a ítems de venta.
-- Soft-delete vía flag `activo` (preserva trazabilidad histórica en ventas_detalle_descuento).
CREATE TABLE cat_tipo_descuento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  activo BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE cat_tipo_descuento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access" ON cat_tipo_descuento
FOR ALL USING (auth.role() = 'authenticated');

-- Seeds iniciales
INSERT INTO cat_tipo_descuento (nombre) VALUES
  ('Mayoreo'),
  ('Recomendación')
ON CONFLICT (nombre) DO NOTHING;
