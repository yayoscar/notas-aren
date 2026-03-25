-- Extend productos table to support derived products (testers, parcials)
ALTER TABLE productos
  ADD COLUMN producto_origen_id UUID REFERENCES productos(id) ON DELETE SET NULL,
  ADD COLUMN estado_producto TEXT NOT NULL DEFAULT 'nuevo',
  ADD COLUMN porcentaje_precio_parcial DECIMAL;

-- Constraint for valid estados
ALTER TABLE productos
  ADD CONSTRAINT chk_estado_producto CHECK (estado_producto IN ('nuevo', 'tester', 'parcial'));

-- Index for fast lookups of derivados
CREATE INDEX idx_productos_origen ON productos(producto_origen_id) WHERE producto_origen_id IS NOT NULL;
