-- Saldos a favor de clientes (generados por devoluciones o anulaciones)
CREATE TABLE saldos_favor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id),
  monto DECIMAL(10,2) NOT NULL,
  monto_restante DECIMAL(10,2) NOT NULL,
  origen TEXT NOT NULL CHECK (origen IN ('devolucion', 'anulacion')),
  referencia_id UUID NOT NULL,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_saldos_favor_cliente ON saldos_favor(cliente_id);
CREATE INDEX idx_saldos_favor_activos ON saldos_favor(cliente_id) WHERE monto_restante > 0;
