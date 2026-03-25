-- Extend ventas table for soft-delete (anulación)
ALTER TABLE ventas
  ADD COLUMN estado_venta TEXT NOT NULL DEFAULT 'activa',
  ADD COLUMN motivo_cancelacion TEXT;

ALTER TABLE ventas
  ADD CONSTRAINT chk_estado_venta CHECK (estado_venta IN ('activa', 'cancelada'));
