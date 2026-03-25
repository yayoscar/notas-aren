-- Auditoría de cambios en ventas (ediciones, anulaciones, devoluciones, cambios)
CREATE TABLE ventas_historial (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id UUID NOT NULL REFERENCES ventas(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('edicion', 'anulacion', 'devolucion', 'cambio')),
  usuario_id UUID NOT NULL REFERENCES vendedores(id),
  datos_anteriores JSONB,
  datos_nuevos JSONB,
  motivo TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ventas_historial_venta ON ventas_historial(venta_id);
