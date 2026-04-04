-- Tabla para almacenar los artículos que componen un producto tipo SET
CREATE TABLE set_detalle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  descripcion TEXT NOT NULL,
  cantidad INTEGER NOT NULL DEFAULT 1,
  orden INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_set_detalle_producto_id ON set_detalle(producto_id);

-- RLS: mismo patrón que productos
ALTER TABLE set_detalle ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON set_detalle FOR ALL USING (auth.role() = 'authenticated');
