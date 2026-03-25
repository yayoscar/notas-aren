-- Add 'devolucion' to pagos.tipo_pago and add reference to devoluciones
ALTER TABLE pagos DROP CONSTRAINT IF EXISTS pagos_tipo_pago_check;
ALTER TABLE pagos ADD CONSTRAINT pagos_tipo_pago_check CHECK (tipo_pago IN ('efectivo', 'transferencia', 'retiro_sin_tarjeta', 'devolucion'));

-- Add reference to the devolucion that generated this payment
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS referencia_devolucion_id UUID REFERENCES devoluciones(id);
